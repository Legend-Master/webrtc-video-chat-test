const touchResponse = document.getElementsByClassName(
	'touch-response'
) as HTMLCollectionOf<HTMLElement>

for (const el of touchResponse) {
	el.addEventListener(
		'touchstart',
		() => {
			el.classList.add('ontouch')
		},
		{ passive: true }
	)
	el.addEventListener(
		'touchend',
		() => {
			el.classList.remove('ontouch')
		},
		{ passive: true }
	)
}
