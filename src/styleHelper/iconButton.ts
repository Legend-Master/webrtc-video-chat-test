import { createIcon } from './icon'
import { addTouchResponse } from './touchResponse'

function onClick(this: HTMLElement) {
	// Refresh focus to remove active state on touch screen
	this.blur()
	this.focus()
}

function addIconButtonListeners(button: HTMLButtonElement) {
	button.addEventListener('click', onClick)
}

export function createIconButton(icon: string) {
	const button = document.createElement('button')
	button.classList.add('icon-button')
	addTouchResponse(button)
	button.appendChild(createIcon(icon))
	addIconButtonListeners(button)
	return button
}

const buttons = document.getElementsByClassName(
	'icon-button'
) as HTMLCollectionOf<HTMLButtonElement>
for (const button of buttons) {
	addIconButtonListeners(button)
}
