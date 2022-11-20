const touchResponse = document.getElementsByClassName(
	'touch-response'
) as HTMLCollectionOf<HTMLElement>

for (const el of touchResponse) {
	el.addEventListener('touchstart', () => {
		el.classList.add('ontouch')
	})
	el.addEventListener('touchend', () => {
		el.classList.remove('ontouch')
	})
}
