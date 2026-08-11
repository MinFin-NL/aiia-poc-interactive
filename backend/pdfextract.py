"""
Structured PDF extraction: text, tables and figures as ordered blocks.

Replaces the old browser-side pdfjs path, which mapped every text item to a
bare string and collapsed all whitespace — destroying paragraph breaks (so
chunking degenerated to page boundaries) and turning every table into one
run-on line the model could not read.

pdfplumber gives us ruling-line table detection plus per-line bounding boxes,
so we can (a) lift tables out as pipe-delimited rows, (b) keep the surrounding
prose free of the garbled table text, and (c) associate a caption with each
figure. No OCR — scanned PDFs still raise PdfNoTextError, matching the
deliberate "upload a text PDF or the original Word file" stance in the UI.

A figure block also carries a rasterised PNG of its region, so the caller can
persist the actual image and hand it to AI Modus as a question attachment
instead of only its caption. Rendering goes through pdfplumber's to_image(),
i.e. pypdfium2 — only *embedded raster* images are detected, so a diagram
drawn as vector art (Visio/Archi/PowerPoint export) is still invisible here.

pdfplumber is MIT (on pdfminer.six, MIT) and pypdfium2 is BSD-3/Apache-2.0;
deliberately not PyMuPDF, which is AGPL-3.0.

All functions are synchronous; callers wrap them in asyncio.to_thread().
"""

from __future__ import annotations

import io
import re
from typing import Any

import pdfplumber

# A figure smaller than this in either dimension (PDF points, 72 per inch) is
# almost always a bullet glyph, rule or logo fragment — not worth a chunk.
MIN_FIGURE_SIDE = 80

# How far above/below a figure we look for its caption.
CAPTION_MAX_GAP = 40

# A caption runs on until the paragraph ends; this stops a figure that happens
# to sit right above the body text from swallowing the whole section.
CAPTION_MAX_CHARS = 300

# Rasterisation of a figure region. 150 dpi is sharp enough to paste into a
# Word/PDF export at print size; the pixel cap keeps a full-page diagram from
# turning into a multi-megabyte attachment.
FIGURE_RESOLUTION = 150
FIGURE_MAX_PX = 1600

# A vertical gap larger than this multiple of the running line height starts a
# new paragraph. 1.6 keeps normal leading together while splitting real breaks.
PARAGRAPH_GAP_RATIO = 1.6

# A paragraph that is nothing but a number is a page number, not content.
_PAGE_NUMBER_RE = re.compile(r"\d{1,4}")

Block = dict[str, Any]
"""{"type": "text"|"table"|"figure", "page": int, "text": str,
    "bbox": [x0, top, x1, bottom], "rows": list[list[str]] | None}

Figure blocks additionally carry "image": {"png": bytes, "width": int,
"height": int} — absent when rendering failed or was switched off."""

# Prefix _figures() puts in front of a figure's caption. figure_caption()
# strips it back off for callers that want the caption on its own.
_FIGURE_PREFIX_RE = re.compile(r"^\[Afbeelding op pagina \d+\]\s*")


class PdfNoTextError(Exception):
    """The PDF carries no extractable text layer (scanned/image-only)."""


class PdfUnreadableError(Exception):
    """The bytes could not be opened as a PDF at all (corrupt or encrypted)."""


def _clean_cell(value: Any) -> str:
    if value is None:
        return ""
    # Cells routinely wrap across lines; a table row must stay one line.
    return re.sub(r"\s+", " ", str(value)).strip()


def render_table(rows: list[list[str]]) -> str:
    """Render extracted rows as pipe-delimited lines, one row per line.

    Matches the wire format the LLM already produces for table questions
    (see parsePipeSuggestion in src/utils/tableAnswer.ts), so a retrieved
    table fragment and a generated answer look the same to the model.
    """
    lines = []
    for row in rows:
        cells = [_clean_cell(c) for c in row]
        if any(cells):
            lines.append(" | ".join(cells))
    return "\n".join(lines)


def _overlaps(a0: float, a1: float, b0: float, b1: float) -> bool:
    return a0 < b1 and b0 < a1


def _inside_any(obj: dict, boxes: list[tuple[float, float, float, float]]) -> bool:
    cx = (obj["x0"] + obj["x1"]) / 2
    cy = (obj["top"] + obj["bottom"]) / 2
    return any(x0 <= cx <= x1 and top <= cy <= bottom for x0, top, x1, bottom in boxes)


def _paragraphs_from_lines(lines: list[dict]) -> list[tuple[str, list[float]]]:
    """Group text lines into paragraphs. Returns (text, bbox) per paragraph."""
    paragraphs: list[tuple[str, list[float]]] = []
    buf: list[dict] = []

    def flush() -> None:
        if not buf:
            return
        text = " ".join(line["text"].strip() for line in buf if line["text"].strip())
        if text.strip():
            paragraphs.append(
                (
                    text.strip(),
                    [
                        min(line["x0"] for line in buf),
                        min(line["top"] for line in buf),
                        max(line["x1"] for line in buf),
                        max(line["bottom"] for line in buf),
                    ],
                )
            )
        buf.clear()

    for line in lines:
        if buf:
            prev = buf[-1]
            height = max(prev["bottom"] - prev["top"], 1.0)
            if line["top"] - prev["bottom"] > height * PARAGRAPH_GAP_RATIO:
                flush()
        buf.append(line)
    flush()
    return paragraphs


def _join_lines(texts: list[str]) -> str:
    """Join wrapped lines into one string, healing the line-break hyphen.

    "… Azure West-" + "Europa." must not become "West- Europa". The hyphen is
    kept rather than dropped: it cannot be told apart from a real one
    ("NAW-gegevens" wraps the same way), and keeping it only misreads a
    genuinely soft-hyphenated word, which stays legible.
    """
    joined = ""
    for text in (t.strip() for t in texts):
        if not text:
            continue
        if not joined:
            joined = text
        elif joined.endswith("-"):
            joined += text
        else:
            joined = f"{joined} {text}"
    return joined


def _caption_run(ordered: list[dict], start: int, step: int) -> str:
    """Grow a caption from ordered[start] through the rest of its paragraph.

    A caption nearly always wraps ("Figuur 1 — … in Apeldoorn en Azure West-" /
    "Europa."); taking only the line nearest the figure leaves it cut off
    mid-word. Lines are joined while the leading between them stays normal,
    using the same gap rule as _paragraphs_from_lines, so the run stops at the
    blank line that separates the caption from the body text.
    """
    picked = [ordered[start]]
    total = len(picked[0]["text"])
    index = start + step
    while 0 <= index < len(ordered):
        candidate, anchor = ordered[index], picked[-1]
        # step > 0 reads downwards (caption below the figure), step < 0 upwards.
        upper, lower = (anchor, candidate) if step > 0 else (candidate, anchor)
        height = max(upper["bottom"] - upper["top"], 1.0)
        if lower["top"] - upper["bottom"] > height * PARAGRAPH_GAP_RATIO:
            break
        text = candidate["text"].strip()
        if total + len(text) > CAPTION_MAX_CHARS:
            break
        picked.append(candidate)
        total += len(text)
        index += step
    if step < 0:
        picked.reverse()
    return _join_lines([line["text"] for line in picked])


def _caption_for(figure: dict, lines: list[dict]) -> str:
    """The caption paragraph below the figure, else above. '' when there is none."""
    ordered = sorted(lines, key=lambda line: line["top"])
    aligned = [
        index
        for index, line in enumerate(ordered)
        if _overlaps(line["x0"], line["x1"], figure["x0"], figure["x1"])
    ]
    below = [
        index
        for index in aligned
        if ordered[index]["top"] >= figure["bottom"] - 1
        and ordered[index]["top"] - figure["bottom"] < CAPTION_MAX_GAP
    ]
    if below:
        return _caption_run(ordered, below[0], 1)  # ordered by top: first is nearest
    above = [
        index
        for index in aligned
        if ordered[index]["bottom"] <= figure["top"] + 1
        and figure["top"] - ordered[index]["bottom"] < CAPTION_MAX_GAP
    ]
    if above:
        return _caption_run(ordered, above[-1], -1)
    return ""


def figure_caption(text: str) -> str:
    """The caption of a rendered figure block, without its page prefix."""
    return _FIGURE_PREFIX_RE.sub("", text).strip()


def _render_figure(page: Any, bbox: tuple[float, float, float, float]) -> dict[str, Any] | None:
    """Rasterise one figure region to PNG bytes.

    Returns {"png", "width", "height"} or None when the region cannot be
    rendered — a figure without its bytes must still survive as a caption
    chunk, so callers treat None as "caption only", never as an error.
    """
    x0, top, x1, bottom = bbox
    # An image object may stick out past the page (bleed); crop() rejects that.
    x0, top = max(x0, 0.0), max(top, 0.0)
    x1, bottom = min(x1, float(page.width)), min(bottom, float(page.height))
    if x1 - x0 < 1 or bottom - top < 1:
        return None
    # Keep the long side under FIGURE_MAX_PX: a full-page diagram at 150 dpi
    # would otherwise dwarf the 5 MB attachment budget.
    longest_pt = max(x1 - x0, bottom - top)
    resolution = min(FIGURE_RESOLUTION, FIGURE_MAX_PX * 72 / longest_pt)
    try:
        image = page.crop((x0, top, x1, bottom)).to_image(resolution=resolution)
        buffer = io.BytesIO()
        image.original.save(buffer, format="PNG")
    except Exception as e:
        print(f"[pdfextract] figuur niet gerenderd: {type(e).__name__}: {e}")
        return None
    return {
        "png": buffer.getvalue(),
        "width": image.original.width,
        "height": image.original.height,
    }


def _figures(page: Any, lines: list[dict], page_no: int, render: bool) -> list[Block]:
    blocks: list[Block] = []
    accepted: list[tuple[float, float, float, float]] = []
    for img in sorted(page.images, key=lambda i: (i["top"], i["x0"])):
        x0, top, x1, bottom = img["x0"], img["top"], img["x1"], img["bottom"]
        if (x1 - x0) < MIN_FIGURE_SIDE or (bottom - top) < MIN_FIGURE_SIDE:
            continue
        # Masks and their base image arrive as separate objects on the same
        # spot; one figure block per region is enough.
        if _inside_any({"x0": x0, "x1": x1, "top": top, "bottom": bottom}, accepted):
            continue
        accepted.append((x0, top, x1, bottom))
        caption = _caption_for(img, lines)
        text = f"[Afbeelding op pagina {page_no}]"
        if caption:
            text = f"{text} {caption}"
        block: Block = {
            "type": "figure",
            "page": page_no,
            "text": text,
            "bbox": [x0, top, x1, bottom],
            "rows": None,
        }
        image = _render_figure(page, (x0, top, x1, bottom)) if render else None
        if image:
            block["image"] = image
        blocks.append(block)
    return blocks


def _extract_page(page: Any, page_no: int, render_figures: bool) -> list[Block]:
    blocks: list[Block] = []

    tables = page.find_tables()
    table_boxes = [t.bbox for t in tables]
    for table in tables:
        rows = [[_clean_cell(c) for c in row] for row in table.extract()]
        text = render_table(rows)
        if not text:
            continue
        blocks.append(
            {
                "type": "table",
                "page": page_no,
                "text": text,
                "bbox": list(table.bbox),
                "rows": [row for row in rows if any(row)],
            }
        )

    # Prose is read from everything *outside* the tables, so table content is
    # not duplicated in its unreadable flattened form.
    source = page.filter(lambda obj: not _inside_any(obj, table_boxes)) if table_boxes else page
    try:
        lines = source.extract_text_lines()
    except Exception:
        lines = []

    for text, bbox in _paragraphs_from_lines(lines):
        if _PAGE_NUMBER_RE.fullmatch(text):  # running header/footer, pure noise in a chunk
            continue
        blocks.append({"type": "text", "page": page_no, "text": text, "bbox": bbox, "rows": None})

    blocks.extend(_figures(page, lines, page_no, render_figures))

    # Reading order within the page: top to bottom, then left to right.
    blocks.sort(key=lambda b: (round(b["bbox"][1], 1), b["bbox"][0]))
    return blocks


def extract_pdf(data: bytes, render_figures: bool = True) -> dict[str, Any]:
    """Extract ordered text/table/figure blocks from PDF bytes.

    Returns {"blocks": [Block, ...], "page_count": int}.
    Raises PdfNoTextError when nothing textual could be read (scanned PDF)
    and PdfUnreadableError when the bytes are not a usable PDF.

    render_figures=False skips rasterisation for callers that only need the
    text (rendering is the expensive part of the extraction).
    """
    blocks: list[Block] = []
    try:
        with pdfplumber.open(io.BytesIO(data)) as pdf:
            page_count = len(pdf.pages)
            for index, page in enumerate(pdf.pages, start=1):
                try:
                    blocks.extend(_extract_page(page, index, render_figures))
                except Exception as e:
                    # One malformed page must not lose the rest of the document.
                    print(f"[pdfextract] pagina {index} overgeslagen: {type(e).__name__}: {e}")
                finally:
                    page.flush_cache()
    except (PdfNoTextError, PdfUnreadableError):
        raise
    except Exception as e:
        raise PdfUnreadableError(str(e)) from e

    if not any(b["type"] in ("text", "table") for b in blocks):
        raise PdfNoTextError("Geen tekstlaag gevonden.")

    return {"blocks": blocks, "page_count": page_count}


def render_blocks(blocks: list[Block]) -> list[Block]:
    """Bake each block's display text into `text`, giving tables a header line.

    Chunking and the document text shown in the UI are both built from the
    result, so a chunk always stays a substring of the document (modulo
    whitespace) — which is what DocumentViewerModal relies on to locate and
    highlight a cited fragment.
    """
    rendered = []
    for block in blocks:
        text = block["text"]
        if block["type"] == "table":
            text = f"Tabel — pagina {block['page']}\n{text}"
        if text.strip():
            rendered.append({**block, "text": text})
    return rendered


def render_content(rendered: list[Block]) -> str:
    """Join rendered blocks into the single document text stored per document."""
    return "\n\n".join(b["text"] for b in rendered)
