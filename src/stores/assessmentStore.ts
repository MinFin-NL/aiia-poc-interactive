import { defineStore } from 'pinia'
import type { Answers, RiskLevelValue } from '../models/Assessment'

export type AssessmentType = 'aiia' | 'dpia'

interface AiiaState {
  answers: Answers
  currentView: string
  riskLevel: RiskLevelValue
  goDecision: boolean | null
  completedSections: string[]
}

interface DpiaState {
  answers: Answers
  currentView: string
  completedSections: string[]
}

export const useAssessmentStore = defineStore('assessment', {
  state: () => ({
    activeAssessment: 'aiia' as AssessmentType,
    aiia: {
      answers: {} as Answers,
      currentView: 'home' as string,
      riskLevel: null as RiskLevelValue,
      goDecision: null as boolean | null,
      completedSections: [] as string[],
    } as AiiaState,
    dpia: {
      answers: {} as Answers,
      currentView: 'home' as string,
      completedSections: [] as string[],
    } as DpiaState,
  }),

  getters: {
    answers: (state): Answers => state[state.activeAssessment].answers,
    currentView: (state): string => state[state.activeAssessment].currentView,
    completedSections: (state): string[] => state[state.activeAssessment].completedSections,
    riskLevel: (state): RiskLevelValue => state.activeAssessment === 'aiia' ? state.aiia.riskLevel : null,
    goDecision: (state): boolean | null => state.activeAssessment === 'aiia' ? state.aiia.goDecision : null,
    showPartB: (state): boolean => state.activeAssessment === 'aiia' && state.aiia.goDecision === true,

    getAnswer: (state) => (questionId: string): string | string[] => {
      return state[state.activeAssessment].answers[questionId] ?? ''
    },
    isSectionCompleted: (state) => (sectionId: string): boolean => {
      return state[state.activeAssessment].completedSections.includes(sectionId)
    },
  },

  actions: {
    setActiveAssessment(type: AssessmentType) {
      this.activeAssessment = type
    },

    setAnswer(questionId: string, value: string | string[]) {
      this[this.activeAssessment].answers[questionId] = value
    },

    setCurrentView(view: string) {
      this[this.activeAssessment].currentView = view
    },

    setRiskLevel(level: RiskLevelValue) {
      if (this.activeAssessment === 'aiia') {
        this.aiia.riskLevel = level
      }
    },

    setGoDecision(decision: boolean) {
      if (this.activeAssessment === 'aiia') {
        this.aiia.goDecision = decision
      }
    },

    markSectionCompleted(sectionId: string) {
      const sections = this[this.activeAssessment].completedSections
      if (!sections.includes(sectionId)) {
        sections.push(sectionId)
      }
    },

    resetActive() {
      if (this.activeAssessment === 'aiia') {
        this.aiia.answers = {}
        this.aiia.currentView = 'home'
        this.aiia.riskLevel = null
        this.aiia.goDecision = null
        this.aiia.completedSections = []
      } else {
        this.dpia.answers = {}
        this.dpia.currentView = 'home'
        this.dpia.completedSections = []
      }
    },

    reset() {
      this.aiia.answers = {}
      this.aiia.currentView = 'home'
      this.aiia.riskLevel = null
      this.aiia.goDecision = null
      this.aiia.completedSections = []
      this.dpia.answers = {}
      this.dpia.currentView = 'home'
      this.dpia.completedSections = []
    },
  },

  persist: true,
})
