/**
 * The kernvragen transcript is what AI Modus retrieves from when nobody has
 * uploaded anything. Two properties matter and neither is obvious from reading
 * renderKernvragen: an unanswered question must not reach the index (a heading
 * promising an answer that holds none is worse than silence), and the question
 * text must travel with the answer (the retriever matches on words, and "Ja,
 * maar alleen als hulpmiddel" retrieves nothing on its own).
 *
 * Plain-text answers throughout: the real ones are Tiptap HTML, but stripping
 * that needs a DOM, and a jsdom pragma here would make these tests silently not
 * run in this repo's setup. The stripping itself is answerPlainText's job.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { renderKernvragen } from './kernvragenSource'
import type { Answers, FormConfig } from '../models/Assessment'

const form: FormConfig = JSON.parse(
  readFileSync(fileURLToPath(new URL('../../public/forms/kernvragen.json', import.meta.url)), 'utf8'),
)

function render(answers: Answers): string {
  return renderKernvragen(form, (id) => answers[id] ?? '')
}

describe('renderKernvragen', () => {
  it('is empty when nothing has been answered', () => {
    expect(render({})).toBe('')
  })

  it('carries the question text alongside the answer', () => {
    const text = render({ 'kern.aanleiding': 'Handhaving loopt vast op papieren dossiers.' })
    expect(text).toContain('Welk probleem lost dit project op')
    expect(text).toContain('Handhaving loopt vast op papieren dossiers.')
  })

  it('leaves out the blocks nobody answered', () => {
    const text = render({ 'kern.aanleiding': 'Iets.' })
    expect(text).toContain('1. Waarom en waartoe?')
    expect(text).not.toContain('10. Wie is eigenaar')
  })

  it('flattens a checkbox answer to something retrievable', () => {
    const text = render({
      'kern.gedrag': ['Genereert tekst, beeld, geluid of code', 'Herkent patronen, beelden, spraak of tekst'],
    })
    expect(text).toContain('Genereert tekst, beeld, geluid of code; Herkent patronen')
  })
})
