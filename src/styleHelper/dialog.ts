const shouldReduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)')
const supportsDiscreteTransition = CSS.supports('transition-behavior', 'allow-discrete')

export function closeDialog(dialog: HTMLDialogElement) {
	dialog.classList.add('closed')
	if (shouldReduceMotion.matches || supportsDiscreteTransition) {
		dialog.close()
	} else {
		dialog.addEventListener('transitionend', () => dialog.close(), { once: true })
	}
}

export function openDialogModal(dialog: HTMLDialogElement, nonModal = false) {
	if (nonModal) {
		dialog.show()
	} else {
		dialog.showModal()
	}
	dialog.classList.remove('closed')
}

const preventClickCloseMap = new Set<HTMLDialogElement>()

function onMouseDown(this: HTMLDialogElement, ev: MouseEvent) {
	if (ev.target !== this) {
		preventClickCloseMap.add(this)
	} else {
		preventClickCloseMap.delete(this)
	}
}

function onMouseUp(this: HTMLDialogElement, ev: MouseEvent) {
	if (ev.target !== this) {
		preventClickCloseMap.add(this)
	}
}

export function closeDialogOnClickOutside(dialog: HTMLDialogElement) {
	dialog.addEventListener('mousedown', onMouseDown)
	dialog.addEventListener('mouseup', onMouseUp)
	// Document level for clicking outside of the window/dialog
	document.addEventListener('click', (ev) => {
		if (ev.target === dialog && !preventClickCloseMap.has(dialog)) {
			closeDialog(dialog)
		}
		preventClickCloseMap.delete(dialog)
	})
}

function closeProxy(this: HTMLDialogElement, ev: Event) {
	if (!ev.defaultPrevented) {
		ev.preventDefault()
		closeDialog(this)
	}
}

function makeCloseProxyLastEventListener(this: HTMLDialogElement, ev: Event) {
	this.addEventListener(ev.type, closeProxy, { once: true })
}

const dialogs = document.getElementsByTagName('dialog')
for (const dialog of dialogs) {
	dialog.classList.add('closed')
	dialog.addEventListener('cancel', makeCloseProxyLastEventListener, { capture: true })
	dialog.addEventListener('submit', makeCloseProxyLastEventListener, { capture: true })
	dialog.addEventListener('close', () => dialog.classList.add('closed'))
}
