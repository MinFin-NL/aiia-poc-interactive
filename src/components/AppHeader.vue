<template>
  <header ref="headerEl" data-rvo-on-dark class="invulhulp-header">
    <div class="rvo-max-width-layout rvo-max-width-layout--lg rvo-max-width-layout-inline-padding--sm">
      <!-- Top bar: logo + reset button -->
      <div class="rvo-layout-row rvo-layout-gap--md invulhulp-header__topbar">
        <button
          type="button"
          @click="goHome"
          class="invulhulp-header__logo-btn"
          aria-label="Ga naar startpagina"
        >
          <div class="rvo-logo invulhulp-header__logo">
            <img class="rvo-logo__emblem" :src="emblemUrl" alt="" />
            <div class="rvo-logo__wordmark">
              <p class="rvo-logo__title">Ministerie van&#10;Financiën</p>
            </div>
          </div>
        </button>
        <div class="invulhulp-header__actions">
          <button
            v-if="showResetButton"
            @click="openResetDialog"
            class="rvo-button rvo-button--secondary rvo-button--size-sm"
          >
            Opnieuw beginnen
          </button>
          <button
            v-if="auth.isAdmin"
            @click="auth.userManagementOpen = !auth.userManagementOpen"
            class="invulhulp-header__ghost-btn"
            :aria-pressed="auth.userManagementOpen"
          >
            {{ auth.userManagementOpen ? 'Terug naar dossiers' : 'Gebruikersbeheer' }}
          </button>
          <span v-if="auth.isAdmin" class="invulhulp-header__divider" aria-hidden="true" />
          <span v-if="auth.user" class="invulhulp-header__user">
            {{ auth.user.name ?? auth.user.email }}
          </span>
          <button
            @click="auth.logout()"
            class="invulhulp-header__ghost-btn invulhulp-header__logout"
          >
            <span class="invulhulp-header__logout-icon" aria-hidden="true" />
            Uitloggen
          </button>
        </div>
      </div>

      <!-- Breadcrumb: dossier › formulier -->
      <nav v-if="showBreadcrumb" class="invulhulp-header__breadcrumb" aria-label="Kruimelpad">
        <button
          v-if="store.activeFormId !== null"
          type="button"
          class="invulhulp-header__crumb invulhulp-header__crumb--link"
          @click="store.goToPortal()"
        >
          <span class="invulhulp-header__crumb-icon" aria-hidden="true" />
          {{ store.activeDossier.name }}
        </button>
        <span v-else class="invulhulp-header__crumb invulhulp-header__crumb--current" aria-current="page">
          <span class="invulhulp-header__crumb-icon" aria-hidden="true" />
          {{ store.activeDossier.name }}
        </span>
        <!-- Lifecycle phase of the open form. Not a link: there is no
             per-phase destination, the phase only exists as a grouping. -->
        <template v-if="activePhaseLabel">
          <span class="invulhulp-header__crumb-sep invulhulp-header__crumb-sep--phase" aria-hidden="true">›</span>
          <span class="invulhulp-header__crumb invulhulp-header__crumb--phase">
            {{ activePhaseLabel }}
          </span>
        </template>
        <template v-if="activeFormTitle">
          <span class="invulhulp-header__crumb-sep" aria-hidden="true">›</span>
          <span class="invulhulp-header__crumb invulhulp-header__crumb--current" aria-current="page">
            {{ activeFormTitle }}
          </span>
        </template>
        <PresenceBar :dossier-id="store.activeDossierId" class="invulhulp-header__presence" />
      </nav>
    </div>
  </header>

  <ConfirmDialog
    ref="resetDialog"
    :title="resetTitle"
    :message="`Al uw antwoorden in dit formulier worden gewist.`"
    confirm-label="Opnieuw beginnen"
    cancel-label="Annuleren"
    variant="warning"
    @confirm="store.resetActive()"
  />
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import emblemUrl from '@nl-rvo/assets/images/emblem.svg'
import { useAssessmentStore } from '../stores/assessmentStore'
import { useAuthStore } from '../stores/authStore'
import { loadAvailableForms, type FormIndexEntry } from '../services/formLoader'
import { trackIdFor, trackLabel } from '../utils/tracks'
import ConfirmDialog from './ConfirmDialog.vue'
import PresenceBar from './PresenceBar.vue'

const store = useAssessmentStore()
const auth = useAuthStore()
const availableForms = ref<FormIndexEntry[]>([])
const resetDialog = ref<InstanceType<typeof ConfirmDialog> | null>(null)
const headerEl = ref<HTMLElement | null>(null)

onMounted(async () => {
  availableForms.value = await loadAvailableForms()
})

// The header is not a fixed height: the breadcrumb row wraps, the phase crumb
// drops out below 640px, and the presence bar appears only in a shared dossier.
// The form sidebar sticks right under it, so publish the measured height as a
// custom property instead of letting every consumer hardcode a guess.
let headerObserver: ResizeObserver | null = null

onMounted(() => {
  if (!headerEl.value) return
  headerObserver = new ResizeObserver(([entry]) => {
    // Border-box, not contentRect: the header may grow padding or a border
    // later and the sidebar has to clear all of it.
    const height = entry.target.getBoundingClientRect().height
    document.documentElement.style.setProperty(
      '--invulhulp-header-height',
      `${Math.round(height)}px`,
    )
  })
  headerObserver.observe(headerEl.value)
})

onBeforeUnmount(() => {
  headerObserver?.disconnect()
  headerObserver = null
  document.documentElement.style.removeProperty('--invulhulp-header-height')
})

// Reset applies to a single form, so only offer it while a form is actually
// open — not on the dossier list or dossier detail page, where activeFormId
// can still hold a stale value from the last visited form.
const showResetButton = computed(
  () =>
    store.screen === 'dossier' &&
    !auth.userManagementOpen &&
    store.activeFormId !== null &&
    store.currentView !== 'home',
)

const showBreadcrumb = computed(
  () => store.screen === 'dossier' && !auth.userManagementOpen && store.activeDossier.name !== '',
)

const activeFormTitle = computed(() => {
  if (store.activeFormId === null) return null
  return availableForms.value.find((f) => f.id === store.activeFormId)?.title ?? null
})

const activePhaseLabel = computed(() => {
  if (store.activeFormId === null) return null
  const track = availableForms.value.find((f) => f.id === store.activeFormId)?.track
  // A form with a typo'd track is already surfaced on the dossier page; don't
  // repeat "Niet ingedeeld" in the breadcrumb of every one of its views.
  if (!track || trackIdFor(track, store.activeFormId) === 'onbekend') return null
  return trackLabel(track)
})

const resetTitle = computed(() => {
  const label = availableForms.value.find((f) => f.id === store.activeFormId)?.title ?? 'dit formulier'
  return `"${label}" opnieuw beginnen?`
})

function goHome() {
  auth.userManagementOpen = false
  store.goToDossierList()
}

function openResetDialog() {
  resetDialog.value?.open()
}
</script>

<style scoped>
.invulhulp-header {
  background-color: var(--rvo-color-lintblauw);
  color: var(--rvo-color-wit);
  padding: 0;
  /* Stays put: the form sidebar sticks to the header's underside via
     --invulhulp-header-height, which only lines up if the header itself never
     leaves. Above the AI banner (z-index 20); native <dialog> modals render in
     the top layer and are unaffected by this. */
  position: sticky;
  top: 0;
  z-index: 30;
}

/* Push the "who's here" avatars to the trailing edge of the breadcrumb row. */
.invulhulp-header__presence {
  margin-inline-start: auto;
}

/* The bar renders on the dark header — lighten its label + avatar rings. */
.invulhulp-header__presence :deep(.presence-label) {
  color: rgba(255, 255, 255, 0.85);
}

.invulhulp-header__presence :deep(.presence-avatar) {
  border-color: var(--rvo-color-lintblauw);
}

.invulhulp-header__topbar {
  padding-block: var(--rvo-space-sm);
  align-items: center;
  justify-content: space-between;
}

.invulhulp-header__actions {
  display: inline-flex;
  align-items: center;
  gap: var(--rvo-space-sm);
}

/* Ghost-style buttons for secondary header actions (gebruikersbeheer, uitloggen):
   plain translucent text like the user-name label and tab links, instead of a
   bordered rvo-button that reads as the primary action on the dark header. */
.invulhulp-header__ghost-btn {
  display: inline-flex;
  align-items: center;
  gap: var(--rvo-space-xs);
  border: 0;
  background: transparent;
  color: rgb(255 255 255 / 0.75);
  font: inherit;
  font-size: var(--rvo-font-size-sm);
  font-weight: var(--rvo-font-weight-semibold);
  white-space: nowrap;
  padding: var(--rvo-space-3xs) var(--rvo-space-xs);
  border-radius: var(--rvo-radius-md, 4px);
  cursor: pointer;
  transition: background var(--invulhulp-duration-fast), color var(--invulhulp-duration-fast);
}

.invulhulp-header__ghost-btn:hover {
  background: rgb(255 255 255 / 0.12);
  color: var(--rvo-color-wit);
}

.invulhulp-header__ghost-btn:focus-visible {
  outline: 2px solid var(--rvo-color-wit);
  outline-offset: 2px;
}

.invulhulp-header__logout {
  gap: var(--rvo-space-xs);
}

/* Mirror the "inloggen" glyph so the arrow points out the door = uitloggen.
   The mask URL is a static stylesheet reference so Vite resolves and encodes
   the NL Design System icon correctly in the production build (a runtime
   `url(${dataUri})` breaks once Vite inlines the SVG). */
.invulhulp-header__logout-icon {
  display: inline-block;
  inline-size: 1.125rem;
  block-size: 1.125rem;
  flex-shrink: 0;
  background-color: currentColor;
  -webkit-mask: url('@nl-rvo/assets/icons/functioneel/inloggen.svg') center / contain no-repeat;
  mask: url('@nl-rvo/assets/icons/functioneel/inloggen.svg') center / contain no-repeat;
  transform: scaleX(-1);
}

.invulhulp-header__divider {
  inline-size: 1px;
  block-size: 1.25rem;
  background: rgb(255 255 255 / 0.25);
}

.invulhulp-header__user {
  font-size: var(--rvo-font-size-sm);
  font-weight: var(--rvo-font-weight-semibold);
  color: rgb(255 255 255 / 0.9);
  white-space: nowrap;
}

.invulhulp-header__logo-btn {
  background: none;
  border: 0;
  padding: 0;
  cursor: pointer;
  color: inherit;
}

.invulhulp-header__logo {
  --rvo-logo-color: var(--rvo-color-wit);
  --rvo-logo-font-family: inherit;
  --rvo-logo-font-weight: bold;
}

.invulhulp-header__breadcrumb {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: var(--rvo-space-2xs);
  border-block-start: 1px solid rgb(255 255 255 / 0.15);
  padding-block: var(--rvo-space-xs) var(--rvo-space-sm);
}

.invulhulp-header__crumb {
  display: inline-flex;
  align-items: center;
  gap: var(--rvo-space-xs);
  font-size: var(--rvo-font-size-sm);
  font-weight: var(--rvo-font-weight-semibold);
  white-space: nowrap;
  padding: var(--rvo-space-3xs) var(--rvo-space-xs);
  border-radius: var(--rvo-radius-md, 4px);
}

.invulhulp-header__crumb--current {
  color: var(--rvo-color-wit);
}

.invulhulp-header__crumb--link {
  border: 0;
  background: transparent;
  color: rgb(255 255 255 / 0.75);
  font: inherit;
  font-size: var(--rvo-font-size-sm);
  font-weight: var(--rvo-font-weight-semibold);
  cursor: pointer;
  transition: background var(--invulhulp-duration-fast), color var(--invulhulp-duration-fast);
}

.invulhulp-header__crumb--link:hover {
  background: rgb(255 255 255 / 0.12);
  color: var(--rvo-color-wit);
}

.invulhulp-header__crumb--link:focus-visible {
  outline: 2px solid var(--rvo-color-wit);
  outline-offset: 2px;
}

/* Static mask URL so Vite resolves the NLDS icon in the production build —
   a runtime url(...) binding renders as a white square. */
.invulhulp-header__crumb-icon {
  display: inline-block;
  inline-size: 1.125rem;
  block-size: 1.125rem;
  flex-shrink: 0;
  background-color: currentColor;
  -webkit-mask: url('@nl-rvo/assets/icons/op-kantoor/map-vol-documenten.svg') center / contain no-repeat;
  mask: url('@nl-rvo/assets/icons/op-kantoor/map-vol-documenten.svg') center / contain no-repeat;
}

.invulhulp-header__crumb-sep {
  color: rgb(255 255 255 / 0.4);
  user-select: none;
}

/* The phase is context, not a destination — quieter than the two crumbs it
   sits between, and the first thing to go when the row gets tight. */
.invulhulp-header__crumb--phase {
  color: rgb(255 255 255 / 0.75);
  font-weight: var(--rvo-font-weight-normal);
}

@media (max-width: 640px) {
  .invulhulp-header__crumb--phase,
  .invulhulp-header__crumb-sep--phase {
    display: none;
  }
}
</style>
