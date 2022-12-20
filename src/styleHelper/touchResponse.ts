const elements = [
	document.getElementsByClassName('touch-response') as HTMLCollectionOf<HTMLElement>,
	document.getElementsByTagName('button'),
]

function addTouchClass(this: HTMLElement) {
	this.classList.add('ontouch')
}

function removeTouchClass(this: HTMLElement) {
	this.classList.remove('ontouch')
}

export function addTouchResponse<T extends HTMLElement>(el: T) {
	el.addEventListener('touchstart', addTouchClass, { passive: true })
	el.addEventListener('touchend', removeTouchClass, { passive: true })
	el.addEventListener('touchmove', removeTouchClass, { passive: true })
	return el
}

for (const group of elements) {
	for (const el of group) {
		addTouchResponse(el)
	}
}
