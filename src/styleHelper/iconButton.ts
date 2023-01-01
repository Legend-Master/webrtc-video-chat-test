import { createIcon } from './icon'
import { addTouchResponse } from './touchResponse'

function animteFadeOutBorder(this: HTMLElement) {
	this.animate(
		[
			{
				borderColor: 'rgba(0, 0, 0, 0.2)',
			},
			{
				borderColor: 'transparent',
			},
		],
		300
	)
	// Refresh focus to remove active state on touch screen
	this.blur()
	this.focus()
}

export default function createIconButton(icon: string) {
	const button = document.createElement('button')
	button.classList.add('icon-button')
	addTouchResponse(button)
	button.appendChild(createIcon(icon))
	button.addEventListener('click', animteFadeOutBorder)
	return button
}

const buttons = document.getElementsByClassName(
	'icon-button'
) as HTMLCollectionOf<HTMLButtonElement>
for (const button of buttons) {
	button.addEventListener('click', animteFadeOutBorder)
}
