// @vitest-environment jsdom
/**
 * De modellen schrijven Markdown, of we er nu om vragen of niet. Als dat
 * ongewijzigd als "platte tekst" wordt opgeslagen, ziet de gebruiker de
 * markering terug als codetaal in de editor, de samenvatting en de exports.
 */
import { describe, it, expect } from 'vitest'
import { plainTextToHtml } from './llmService'

describe('plainTextToHtml', () => {
  it('maakt van een opsomming een echte lijst', () => {
    expect(plainTextToHtml('- IT: twee ontwikkelaars\n- Business: een proceseigenaar')).toBe(
      '<ul><li><p>IT: twee ontwikkelaars</p></li><li><p>Business: een proceseigenaar</p></li></ul>',
    )
  })

  it('zet **vet** om in opmaak in plaats van sterretjes', () => {
    expect(plainTextToHtml('Er is **geen** budget')).toBe('<p>Er is <strong>geen</strong> budget</p>')
  })

  it('houdt alinea’s gescheiden', () => {
    expect(plainTextToHtml('Eerste alinea.\n\nTweede alinea.')).toBe(
      '<p>Eerste alinea.</p><p>Tweede alinea.</p>',
    )
  })

  it('escapet ruwe HTML uit het model', () => {
    expect(plainTextToHtml('<img src=x onerror=alert(1)>')).toBe(
      '<p>&lt;img src=x onerror=alert(1)&gt;</p>',
    )
  })
})
