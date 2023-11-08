import './copyButton.css'

export function attachCopyButton(button: HTMLButtonElement, getCopyText: () => string) {
	button.addEventListener('click', async () => {
		navigator.clipboard.writeText(getCopyText())

		if (button.classList.contains('success')) {
			return
		}
		button.classList.add('success')
		// Remove success class on any animation cancel event (most likely from closing the dialog)
		// or after all animations have finished
		const animationCancelPromise = new Promise<void>((resolve) => {
			button.addEventListener('animationcancel', () => resolve(), { once: true })
		})
		await Promise.any([
			animationCancelPromise,
			Promise.all(button.firstElementChild!.getAnimations().map((animation) => animation.finished)),
		])
		button.classList.remove('success')
	})
}

// <button class="icon-button copy-button">
// <span></span>
// </button>
