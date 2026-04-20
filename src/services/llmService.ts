export interface ImproveResponse {
  suggestion: string
  rationale: string
}

export interface SynthesizeRequest {
  aiiaAnswers: { [questionId: string]: string }
  aiiaQuestions: { [questionId: string]: string }
  dpiaQuestion: string
  synthesisHint?: string
}

export async function synthesizeFromAiia(req: SynthesizeRequest): Promise<ImproveResponse> {
  const response = await fetch('/api/synthesize', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      aiia_answers: req.aiiaAnswers,
      aiia_questions: req.aiiaQuestions,
      dpia_question: req.dpiaQuestion,
      synthesis_hint: req.synthesisHint ?? '',
    }),
  })

  if (!response.ok) {
    const err = await response.json().catch(() => ({ detail: 'Onbekende fout' }))
    throw new Error(err.detail ?? `HTTP ${response.status}`)
  }

  return response.json()
}

export async function improveText(text: string, questionContext: string): Promise<ImproveResponse> {
  const response = await fetch('/api/improve', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text, question_context: questionContext }),
  })

  if (!response.ok) {
    const err = await response.json().catch(() => ({ detail: 'Onbekende fout' }))
    throw new Error(err.detail ?? `HTTP ${response.status}`)
  }

  return response.json()
}
