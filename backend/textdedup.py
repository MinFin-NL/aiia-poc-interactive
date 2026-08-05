"""
Deterministic text helpers for the smoothing pass.

No LLM, no I/O — pure functions over (id, text) pairs, so the eval harness can
pin their behavior in milliseconds without a model. `main.py` uses them to pick
which earlier answers to send as read-only context for a batch.

Not to be confused with rag.chunk_document: that merges paragraphs up to a
target size and re-splits oversize ones on hard character boundaries, which is
right for retrieval and wrong here — we need paragraph identity preserved.
"""

import re
import unicodedata

# Dutch function words carry no signal for overlap and would inflate every
# score. Small on purpose: over-filtering hides real repetition.
_STOPWORDS = frozenset(
    """
    de het een en of maar want dus als dan die dat deze dit er is zijn was waren wordt
    worden werd werden heeft hebben had hadden kan kunnen kon konden zal zullen zou
    zouden moet moeten mag mogen van voor naar met bij op in uit aan om te ten ter door
    over onder tussen tot per niet ook nog al reeds wel geen meer minder zeer heel
    hij zij ze we wij jullie u men zich hun haar hem ons onze uw mijn je jij ik
    """.split()
)

_WORD_RE = re.compile(r"[\w-]+", re.UNICODE)
_PARAGRAPH_RE = re.compile(r"\n\s*\n")


def normalize_words(text: str) -> list[str]:
    """Lowercased, accent-stripped content words — the unit every score is
    computed over."""
    folded = unicodedata.normalize("NFKD", text.lower())
    folded = "".join(c for c in folded if not unicodedata.combining(c))
    return [w for w in _WORD_RE.findall(folded) if w not in _STOPWORDS and len(w) > 1]


def shingles(words: list[str], n: int = 4) -> frozenset[str]:
    """Overlapping n-word sequences. Word order matters for near-verbatim
    restatement, which is what this pass is up against — a bag of words would
    score two unrelated paragraphs on the same topic just as highly."""
    if len(words) < n:
        return frozenset([" ".join(words)]) if words else frozenset()
    return frozenset(" ".join(words[i : i + n]) for i in range(len(words) - n + 1))


def containment(a: frozenset[str], b: frozenset[str]) -> float:
    """Overlap relative to the smaller set. Deliberately not Jaccard: a short
    paragraph fully restated inside a long one is exactly the case we care
    about, and Jaccard would score it low."""
    if not a or not b:
        return 0.0
    return len(a & b) / min(len(a), len(b))


def split_paragraphs(text: str) -> list[str]:
    """Blank-line separated paragraphs, no merging and no re-splitting."""
    return [p.strip() for p in _PARAGRAPH_RE.split(text) if p.strip()]


def _paragraph_shingles(text: str) -> list[tuple[str, frozenset[str]]]:
    return [(p, shingles(normalize_words(p))) for p in split_paragraphs(text)]


def relevance(text: str, targets: list[frozenset[str]]) -> float:
    """How much of `text` reappears in any target paragraph — the best score
    over all paragraph pairs."""
    best = 0.0
    for _, sh in _paragraph_shingles(text):
        for target in targets:
            score = containment(sh, target)
            if score > best:
                best = score
    return best


def extract_paragraphs(text: str, targets: list[frozenset[str]], budget: int) -> str:
    """Fit `text` into `budget` chars by keeping its most relevant paragraphs,
    in original order, joined by an ellipsis. A head truncation would cut away
    exactly the tail paragraphs that tend to be the repeated ones."""
    if len(text) <= budget:
        return text
    scored = [
        (max((containment(sh, t) for t in targets), default=0.0), i, p)
        for i, (p, sh) in enumerate(_paragraph_shingles(text))
    ]
    kept: list[tuple[int, str]] = []
    used = 0
    for _, i, p in sorted(scored, key=lambda s: -s[0]):
        if used + len(p) > budget:
            continue
        kept.append((i, p))
        used += len(p)
    if not kept:
        return text[:budget].rstrip() + "…"
    kept.sort()
    return " … ".join(p for _, p in kept)


def select_context(
    batch_texts: list[str],
    candidates: list[tuple[str, str]],
    budget_chars: int,
    per_answer_chars: int,
    min_score: float = 0.05,
) -> list[tuple[str, str]]:
    """Pick the earlier answers worth sending as read-only context for a batch.

    `candidates` is (id, text) in document order — the answers already smoothed.
    Returns the same shape, in document order, within `budget_chars`. Answers
    with no measurable overlap with the batch are dropped entirely: they cost
    prompt space and give the model nothing to deduplicate against.
    """
    targets = [sh for text in batch_texts for _, sh in _paragraph_shingles(text)]
    scored = [(relevance(text, targets), i, qid, text) for i, (qid, text) in enumerate(candidates)]
    # Highest overlap first; ties go to the earlier answer, which owns the fact.
    scored.sort(key=lambda s: (-s[0], s[1]))

    selected: list[tuple[int, str, str]] = []
    used = 0
    for score, i, qid, text in scored:
        if score < min_score or used >= budget_chars:
            continue
        room = min(per_answer_chars, budget_chars - used)
        if room <= 0:
            break
        trimmed = extract_paragraphs(text, targets, room)
        selected.append((i, qid, trimmed))
        used += len(trimmed)

    selected.sort()
    return [(qid, text) for _, qid, text in selected]
