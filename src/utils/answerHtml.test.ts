// @vitest-environment jsdom
/**
 * De samenvatting rendert antwoorden als echte HTML in plaats van ze plat te
 * slaan met een regex. Dat mag alleen met een allowlist ertussen: antwoorden
 * komen van gebruikers, medebewerkers en het LLM.
 */
import { describe, it, expect } from 'vitest'
import { answerToSafeHtml, sanitizeAnswerHtml, plainTextToSafeHtml } from './answerHtml'

describe('sanitizeAnswerHtml', () => {
  it('behoudt de opmaak die Tiptap kan produceren', () => {
    const html = '<p>Eerste <strong>vet</strong> en <em>cursief</em>.</p><ul><li><p>Punt een</p></li><li><p>Punt twee</p></li></ul>'
    expect(sanitizeAnswerHtml(html)).toBe(html)
  })

  it('verwijdert attributen, ook event handlers', () => {
    expect(sanitizeAnswerHtml('<p onclick="alert(1)" style="color:red">Tekst</p>')).toBe('<p>Tekst</p>')
  })

  it('pakt onbekende tags uit maar houdt hun tekst', () => {
    expect(sanitizeAnswerHtml('<div><a href="http://x">link</a>tekst</div>')).toBe('linktekst')
  })

  it('gooit script- en style-inhoud helemaal weg', () => {
    expect(sanitizeAnswerHtml('<p>ok</p><script>alert(1)</script>')).toBe('<p>ok</p>')
  })

  it('escapet tekst die op markup lijkt in plaats van hem uit te voeren', () => {
    expect(sanitizeAnswerHtml('<p>a &lt;b&gt; c &amp; d</p>')).toBe('<p>a &lt;b&gt; c &amp; d</p>')
  })
})

describe('plainTextToSafeHtml', () => {
  it('maakt van lege regels alinea’s en van enkele regels een <br>', () => {
    expect(plainTextToSafeHtml('een\ntwee\n\ndrie')).toBe('<p>een<br>twee</p><p>drie</p>')
  })
})

describe('answerToSafeHtml', () => {
  it('laat een leeg antwoord leeg', () => {
    expect(answerToSafeHtml('   ')).toBe('')
  })

  it('behandelt een legacy plaintext-antwoord als tekst, niet als HTML', () => {
    expect(answerToSafeHtml('2 < 3 & 4 > 1')).toBe('<p>2 &lt; 3 &amp; 4 &gt; 1</p>')
  })
})
