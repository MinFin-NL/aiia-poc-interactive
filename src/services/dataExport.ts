import type { Answers, AssessmentData, RiskLevelValue } from '../models/Assessment'
import type { AssessmentType } from '../stores/assessmentStore'

export interface ExportData {
  version: '1'
  exportedAt: string
  assessmentType: AssessmentType
  systemName: string
  answers: Answers
  riskLevel: RiskLevelValue
  goDecision: boolean | null
  completedSections: string[]
}

function triggerDownload(content: string, filename: string, mimeType: string): void {
  const blob = new Blob([content], { type: mimeType })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

function timestamp(): string {
  const now = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}`
}

export function exportToJson(
  answers: Answers,
  assessmentType: AssessmentType,
  riskLevel: RiskLevelValue,
  goDecision: boolean | null,
  completedSections: string[],
  systemName: string,
): void {
  const data: ExportData = {
    version: '1',
    exportedAt: new Date().toISOString(),
    assessmentType,
    systemName,
    answers,
    riskLevel,
    goDecision,
    completedSections,
  }
  const label = assessmentType === 'dpia' ? 'DPIA' : 'AIIA'
  const filename = `${label}-${timestamp()}.json`

  triggerDownload(JSON.stringify(data, null, 2), filename, 'application/json')
}

export function importFromJson(file: File): Promise<ExportData> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const data = JSON.parse(e.target?.result as string) as ExportData
        if (data.version !== '1' || !data.assessmentType || !data.answers) {
          reject(new Error('Ongeldig bestandsformaat'))
          return
        }
        resolve(data)
      } catch {
        reject(new Error('Bestand kon niet worden gelezen'))
      }
    }
    reader.onerror = () => reject(new Error('Bestand kon niet worden gelezen'))
    reader.readAsText(file)
  })
}

function formatAnswerMd(value: string | string[] | undefined): string {
  if (!value) return '*(niet ingevuld)*'
  if (Array.isArray(value)) return value.length > 0 ? value.join(', ') : '*(niet ingevuld)*'
  const clean = value.replace(/\n---\n/g, '\n\n---\n\n').trim()
  return clean || '*(niet ingevuld)*'
}

export function exportToMarkdown(
  answers: Answers,
  assessmentType: AssessmentType,
  assessmentData: AssessmentData,
  riskLevel: RiskLevelValue,
  goDecision: boolean | null,
  systemName: string,
): void {
  const isDpia = assessmentType === 'dpia'
  const today = new Date().toLocaleDateString('nl-NL', { day: 'numeric', month: 'long', year: 'numeric' })
  const docTitle = isDpia ? 'Data Protection Impact Assessment' : 'AI Impact Assessment'

  const lines: string[] = []
  lines.push(`# ${docTitle}`)
  lines.push(`**Ministerie van Financiën** | ${today}`)
  if (systemName) lines.push(`**Systeem/project:** ${systemName}`)
  if (!isDpia && riskLevel) lines.push(`**Risicoclassificatie:** ${riskLevel}`)
  if (!isDpia && goDecision !== null) lines.push(`**Go-beslissing:** ${goDecision ? 'Ja' : 'Nee'}`)
  lines.push('')

  const showPartB = !isDpia && goDecision === true

  for (const section of assessmentData.sections) {
    if (!isDpia && section.part === 'B' && !showPartB) continue

    lines.push(`## ${section.title}`)
    lines.push('')

    for (const subsection of section.subsections) {
      lines.push(`### ${subsection.title}`)
      lines.push('')

      for (const question of subsection.questions) {
        lines.push(`**${question.id}** — ${question.text}`)
        lines.push('')
        lines.push(formatAnswerMd(answers[question.id]))
        lines.push('')
      }
    }
  }

  const label = isDpia ? 'DPIA' : 'AIIA'
  const filename = `${label}-${timestamp()}.md`

  triggerDownload(lines.join('\n'), filename, 'text/markdown')
}
