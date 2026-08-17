import { computed, ref, watch, onUnmounted, type Ref } from 'vue'
import { useAssessmentStore } from '../stores/assessmentStore'
import { onAiBusy, type AiBusyPeer } from './dossierTransport'

/** Whether AI Modus — anyone's, on this dossier — is working on this question
 *  right now, and the label to show for it. Question ids repeat across forms,
 *  so the active form has to match too. */
export function useAiBusy(questionId: Ref<string>) {
  const store = useAssessmentStore()
  const peers = ref<AiBusyPeer[]>([])
  let unsub: (() => void) | null = null

  watch(
    () => store.activeDossierId,
    (id) => {
      unsub?.()
      unsub = null
      peers.value = []
      if (id) unsub = onAiBusy(id, (p) => (peers.value = p))
    },
    { immediate: true },
  )
  onUnmounted(() => unsub?.())

  // Our own run wins over a collaborator's: seeing "AI is aan het nadenken…" for
  // the run you started is more useful than being told whose it is.
  const peer = computed(() => {
    const here = peers.value.filter(
      (p) => p.questionId === questionId.value && p.formId === store.activeFormId,
    )
    return here.find((p) => p.isSelf) ?? here[0] ?? null
  })

  const label = computed(() => {
    if (!peer.value) return ''
    if (peer.value.isSelf || !peer.value.name) return 'AI is aan het nadenken…'
    return `AI van ${peer.value.name} is aan het nadenken…`
  })

  return { busy: computed(() => peer.value !== null), label }
}
