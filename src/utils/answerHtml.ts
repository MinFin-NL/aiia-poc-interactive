// Answers are stored as Tiptap HTML (or legacy plain text) and are written by
// users, collaborators and the LLM alike. Anything that renders an answer as
// real HTML — instead of flattening it to one lump of text — has to run it
// through this allowlist first.

// The node set Tiptap's StarterKit can produce, plus the few tags an older
// answer may carry. Everything else is unwrapped (its text survives, the tag
// does not). All attributes are dropped: no href, no style, no event handlers.
const ALLOWED_TAGS = new Set([
  'P', 'BR', 'STRONG', 'B', 'EM', 'I', 'U', 'S', 'CODE',
  'UL', 'OL', 'LI', 'BLOCKQUOTE', 'PRE',
  'H1', 'H2', 'H3', 'H4', 'H5', 'H6',
])

const HTML_RE = /<[a-z][\s\S]*>/i

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

function sanitizeNode(node: Node, out: string[]): void {
  for (const child of Array.from(node.childNodes)) {
    if (child.nodeType === Node.TEXT_NODE) {
      out.push(escapeHtml(child.textContent ?? ''))
      continue
    }
    if (child.nodeType !== Node.ELEMENT_NODE) continue
    const el = child as Element
    const tag = el.tagName
    if (!ALLOWED_TAGS.has(tag)) {
      // Unknown/unsafe element: keep the words, drop the wrapper. <script> and
      // <style> hold no user-visible text, so they vanish entirely.
      if (tag !== 'SCRIPT' && tag !== 'STYLE') sanitizeNode(el, out)
      continue
    }
    const lower = tag.toLowerCase()
    if (tag === 'BR') {
      out.push('<br>')
      continue
    }
    out.push(`<${lower}>`)
    sanitizeNode(el, out)
    out.push(`</${lower}>`)
  }
}

/** Tiptap HTML → the same markup with only allowlisted tags and no attributes. */
export function sanitizeAnswerHtml(html: string): string {
  const doc = new DOMParser().parseFromString(html, 'text/html')
  const out: string[] = []
  sanitizeNode(doc.body, out)
  return out.join('')
}

/** Legacy plain-text answer → paragraphs, so blank lines and line breaks keep
 *  the shape the author typed. */
export function plainTextToSafeHtml(text: string): string {
  return text
    .split(/\n{2,}/)
    .map((block) => block.trim())
    .filter((block) => block !== '')
    .map((block) => `<p>${escapeHtml(block).replace(/\n/g, '<br>')}</p>`)
    .join('')
}

/** Any single-value answer (Tiptap HTML or legacy plain text) → HTML that is
 *  safe to render with v-html and keeps its paragraphs, lists and emphasis. */
export function answerToSafeHtml(value: string): string {
  const trimmed = value.trim()
  if (!trimmed) return ''
  return HTML_RE.test(trimmed) ? sanitizeAnswerHtml(trimmed) : plainTextToSafeHtml(trimmed)
}
