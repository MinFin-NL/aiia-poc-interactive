// @vitest-environment jsdom
/**
 * The type-to-confirm gate on ConfirmDialog — the only thing standing between
 * a stray click and an irreversible delete (dossier or user account). Worth a
 * test on its own: a regression here is silent, and the damage is unrecoverable.
 */
import { describe, it, expect, afterEach, beforeAll } from 'vitest'
import { createApp, nextTick } from 'vue'
import ConfirmDialog from './ConfirmDialog.vue'

// jsdom implementeert <dialog> zonder showModal/close — de modal-mechanica is
// hier niet wat we testen, alleen de gate erbinnen.
beforeAll(() => {
  const proto = window.HTMLDialogElement.prototype
  proto.showModal = function () { this.setAttribute('open', '') }
  proto.close = function () { this.removeAttribute('open') }
})

const mounted: (() => void)[] = []

function mount(props: Record<string, unknown>) {
  const host = document.createElement('div')
  document.body.appendChild(host)
  const app = createApp(ConfirmDialog, props)
  const vm = app.mount(host) as unknown as { open: (initial?: string) => Promise<void> }
  mounted.push(() => {
    app.unmount()
    host.remove()
  })
  return { host, vm }
}

afterEach(() => {
  while (mounted.length) mounted.pop()!()
})

async function type(host: HTMLElement, value: string) {
  const input = host.querySelector<HTMLInputElement>('input[type="text"]')!
  input.value = value
  input.dispatchEvent(new Event('input'))
  await nextTick()
}

const confirmButton = (host: HTMLElement) =>
  host.querySelector<HTMLButtonElement>('button[type="submit"]')!

describe('ConfirmDialog met confirmPhrase', () => {
  it('houdt bevestigen geblokkeerd tot de naam exact is overgetypt', async () => {
    let confirmed = 0
    const { host, vm } = mount({
      title: 'Dossier verwijderen',
      confirmPhrase: 'Project Alfa',
      onConfirm: () => confirmed++,
    })
    await vm.open()

    expect(confirmButton(host).disabled).toBe(true)

    await type(host, 'Project')
    expect(confirmButton(host).disabled).toBe(true)

    await type(host, 'project alfa') // hoofdletters tellen mee
    expect(confirmButton(host).disabled).toBe(true)

    await type(host, '  Project Alfa  ') // randspaties niet
    expect(confirmButton(host).disabled).toBe(false)

    host.querySelector('form')!.dispatchEvent(new Event('submit'))
    expect(confirmed).toBe(1)
  })

  it('negeert een submit zolang de naam niet klopt', async () => {
    let confirmed = 0
    const { host, vm } = mount({
      title: 'Dossier verwijderen',
      confirmPhrase: 'Project Alfa',
      onConfirm: () => confirmed++,
    })
    await vm.open()
    await type(host, 'iets anders')

    // Enter in het tekstveld submit het formulier langs de :disabled-knop heen.
    host.querySelector('form')!.dispatchEvent(new Event('submit'))
    expect(confirmed).toBe(0)
  })

  it('reset het veld bij een volgende opening', async () => {
    const { host, vm } = mount({ title: 'Weg ermee', confirmPhrase: 'Project Alfa' })
    await vm.open()
    await type(host, 'Project Alfa')
    expect(confirmButton(host).disabled).toBe(false)

    host.querySelector<HTMLDialogElement>('dialog')!.close()
    await vm.open()
    expect(confirmButton(host).disabled).toBe(true)
  })

  it('laat een gewone bevestiging ongemoeid', async () => {
    let confirmed = 0
    const { host, vm } = mount({ title: 'Doorgaan?', onConfirm: () => confirmed++ })
    await vm.open()
    expect(confirmButton(host).disabled).toBe(false)
    host.querySelector('form')!.dispatchEvent(new Event('submit'))
    expect(confirmed).toBe(1)
  })
})
