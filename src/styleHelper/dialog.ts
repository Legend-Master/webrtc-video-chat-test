const shouldReduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)')

export function closeDialog(dialog: HTMLDialogElement) {
	dialog.classList.add('closed')
	if (shouldReduceMotion.matches) {
		dialog.close()
	} else {
		dialog.addEventListener(
			'transitionend',
			() => {
				dialog.close()
			},
			{ once: true }
		)
	}
}

export function openDialogModal(dialog: HTMLDialogElement) {
	dialog.showModal()
	dialog.classList.remove('closed')
}

function dialogOnMouseDown(this: HTMLDialogElement, ev: MouseEvent) {
	if (ev.target === this) {
		closeDialog(this)
	}
}
export function closeDialogOnClickOutside(dialog: HTMLDialogElement) {
	dialog.addEventListener('mousedown', dialogOnMouseDown)
}

function closeProxy(this: HTMLDialogElement, ev: Event) {
	if (ev.isTrusted && ev.target) {
		ev.preventDefault()
		ev.stopImmediatePropagation()
		// How to do this in typescript?
		// const fakeEvent = new ev.constructor(ev.type, ev)
		// const fakeEvent = new (ev.constructor as any)(ev.type, ev)
		const ctor = ev instanceof SubmitEvent ? SubmitEvent : Event
		const fakeEvent = new ctor(ev.type, ev)
		ev.target.dispatchEvent(fakeEvent)
		if (!fakeEvent.defaultPrevented) {
			fakeEvent.preventDefault()
			closeDialog(this)
		}
	}
}

const dialogs = document.getElementsByTagName('dialog')
for (const dialog of dialogs) {
	dialog.classList.add('closed')
	dialog.addEventListener('cancel', closeProxy, { capture: true })
	dialog.addEventListener('submit', closeProxy, { capture: true })
}
