<template>
  <nav style="width: 240px; flex-shrink: 0; background: white; border-right: 1px solid #e0e0e0; padding: 24px 16px; overflow-y: auto; height: calc(100vh - 100px); position: sticky; top: 100px;">
    <div class="rvo-layout-column" style="gap: 4px;">

      <!-- Progress -->
      <div style="margin-bottom: 16px;">
        <div class="rvo-text rvo-text--sm" style="color: #666; margin-bottom: 4px;">
          Voortgang: {{ completedCount }}/{{ totalCount }}
        </div>
        <div style="background: #e0e0e0; border-radius: 3px; height: 6px;">
          <div class="progress-bar-fill" :style="{ width: `${progressPct}%` }"></div>
        </div>
      </div>

      <!-- Home -->
      <div
        :class="['nav-section', store.currentView === 'home' ? 'active' : '']"
        @click="store.setCurrentView('home')"
        style="font-size: 0.875rem; margin-bottom: 8px;"
      >
        Introductie
      </div>

      <!-- AIIA nav -->
      <template v-if="!isDpia">
        <!-- Deel A -->
        <div style="font-size: 0.7rem; color: #999; text-transform: uppercase; letter-spacing: 0.5px; padding: 8px 8px 4px; margin-top: 8px;">
          Deel A – Afweging
        </div>
        <div
          v-for="sub in aiiaPartASubs"
          :key="sub.id"
          :class="['nav-section', store.currentView === sub.id ? 'active' : '', store.isSectionCompleted(sub.id) ? 'completed' : '']"
          @click="navigate(sub.id)"
          style="font-size: 0.825rem; padding-left: 12px;"
        >
          <span v-if="store.isSectionCompleted(sub.id)" style="color: #27ae60; margin-right: 4px;">✓</span>
          {{ sub.title }}
        </div>

        <!-- Risk -->
        <div style="font-size: 0.7rem; color: #999; text-transform: uppercase; letter-spacing: 0.5px; padding: 8px 8px 4px; margin-top: 8px;">
          Bijlage 1
        </div>
        <div
          :class="['nav-section', store.currentView === 'risk' ? 'active' : '', store.isSectionCompleted('risk') ? 'completed' : '']"
          @click="navigate('risk')"
          style="font-size: 0.825rem; padding-left: 12px;"
        >
          <span v-if="store.isSectionCompleted('risk')" style="color: #27ae60; margin-right: 4px;">✓</span>
          Risicoclassificatie
          <span v-if="store.riskLevel" :class="`risk-badge risk-${store.riskLevel}`" style="font-size: 0.7rem; padding: 2px 6px; margin-left: 4px;">
            {{ riskLabels[store.riskLevel!] }}
          </span>
        </div>

        <!-- Decision -->
        <div
          :class="['nav-section', store.currentView === 'decision' ? 'active' : '', store.isSectionCompleted('3') ? 'completed' : '']"
          @click="navigate('decision')"
          style="font-size: 0.825rem; padding-left: 12px;"
        >
          <span v-if="store.isSectionCompleted('3')" style="color: #27ae60; margin-right: 4px;">✓</span>
          3. Afweging &amp; beslissing
        </div>

        <!-- Deel B -->
        <template v-if="store.goDecision !== false">
          <div style="font-size: 0.7rem; color: #999; text-transform: uppercase; letter-spacing: 0.5px; padding: 8px 8px 4px; margin-top: 8px;">
            Deel B – Implementatie
          </div>
          <div
            v-for="sub in aiiaPartBSubs"
            :key="sub.id"
            :class="['nav-section', store.currentView === sub.id ? 'active' : '', store.isSectionCompleted(sub.id) ? 'completed' : '']"
            @click="navigate(sub.id)"
            style="font-size: 0.825rem; padding-left: 12px;"
          >
            <span v-if="store.isSectionCompleted(sub.id)" style="color: #27ae60; margin-right: 4px;">✓</span>
            {{ sub.title }}
          </div>
        </template>
      </template>

      <!-- DPIA nav -->
      <template v-else>
        <template v-for="section in assessmentData.sections" :key="section.id">
          <div style="font-size: 0.7rem; color: #999; text-transform: uppercase; letter-spacing: 0.5px; padding: 8px 8px 4px; margin-top: 8px;">
            {{ section.title }}
          </div>
          <div
            v-for="sub in section.subsections"
            :key="sub.id"
            :class="['nav-section', store.currentView === sub.id ? 'active' : '', store.isSectionCompleted(sub.id) ? 'completed' : '']"
            @click="navigate(sub.id)"
            style="font-size: 0.825rem; padding-left: 12px;"
          >
            <span v-if="store.isSectionCompleted(sub.id)" style="color: #27ae60; margin-right: 4px;">✓</span>
            {{ sub.title }}
          </div>
        </template>
      </template>

      <!-- Summary -->
      <div style="margin-top: 16px; border-top: 1px solid #e0e0e0; padding-top: 12px;">
        <div
          :class="['nav-section', store.currentView === 'summary' ? 'active' : '']"
          @click="navigate('summary')"
          style="font-size: 0.875rem; font-weight: 600; color: #154273;"
        >
          Samenvatting &amp; export
        </div>
      </div>

    </div>
  </nav>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { assessmentData as aiiaData } from '../data/assessment'
import { useAssessmentStore } from '../stores/assessmentStore'
import type { AssessmentData } from '../models/Assessment'

const props = defineProps<{
  assessmentData: AssessmentData
}>()

const store = useAssessmentStore()
const isDpia = computed(() => store.activeAssessment === 'dpia')

// AIIA-specific
const aiiaPartA = aiiaData.sections.find((s) => s.id === 'deel_a')
const aiiaPartB = aiiaData.sections.find((s) => s.id === 'deel_b')

const aiiaPartASubs = computed(() =>
  (aiiaPartA?.subsections ?? []).filter((s) => s.id !== '3'),
)
const aiiaPartBSubs = computed(() => aiiaPartB?.subsections ?? [])

const riskLabels: Record<string, string> = {
  onaanvaardbaar: 'Verboden',
  hoog: 'Hoog',
  beperkt: 'Beperkt',
  minimaal: 'Minimaal',
}

// Progress tracking
const allNavItems = computed(() => {
  if (isDpia.value) {
    const items: string[] = ['home']
    for (const section of props.assessmentData.sections) {
      for (const sub of section.subsections) {
        items.push(sub.id)
      }
    }
    items.push('summary')
    return items
  }
  const items = ['home', ...aiiaPartASubs.value.map((s) => s.id), 'risk', 'decision']
  if (store.goDecision !== false) items.push(...aiiaPartBSubs.value.map((s) => s.id))
  items.push('summary')
  return items
})

const completedCount = computed(() => store.completedSections.length)
const totalCount = computed(() => allNavItems.value.length - 1)
const progressPct = computed(() =>
  totalCount.value > 0 ? Math.round((completedCount.value / totalCount.value) * 100) : 0,
)

function navigate(id: string) {
  store.setCurrentView(id)
}
</script>
