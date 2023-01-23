const shouldReduceMotion = window.matchMedia('(prefers-reduced-motion)')

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

// TODO: make sure this is the last handler to run or use something else to do this
function closeProxy(this: HTMLDialogElement, ev: Event) {
	if (!ev.defaultPrevented) {
		ev.preventDefault()
		closeDialog(this)
	}
}

const dialogs = document.getElementsByTagName('dialog')
for (const dialog of dialogs) {
	dialog.classList.add('closed')
	dialog.addEventListener('cancel', closeProxy)
	dialog.addEventListener('submit', closeProxy)
}
