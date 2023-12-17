import { start } from './startHandler'
import mdiPin from 'iconify-icon:mdi/pin'

import './recentRoom.css'

export class RecentRoom {
	rootElement: HTMLDivElement

	private startButton: HTMLButtonElement
	private pinButton: HTMLButtonElement
	private separator: HTMLDivElement
	private pinned = false

	constructor() {
		this.rootElement = document.createElement('div')
		this.rootElement.classList.add('recent-room')

		this.startButton = document.createElement('button')
		this.startButton.classList.add('start-button')
		this.startButton.addEventListener('click', () => start())

		this.pinButton = document.createElement('button')
		this.pinButton.innerHTML = mdiPin
		this.pinButton.classList.add('pin-button')
		this.pinButton.addEventListener('click', () => this.togglePinned())

		this.separator = document.createElement('div')
		this.separator.classList.add('separator')

		this.rootElement.append(this.startButton, this.separator, this.pinButton)
	}

	setRoomId = (roomId: string) => {
		this.startButton.innerText = roomId
	}

	setPinned = (pinned: boolean) => {
		this.pinned = pinned
		this.updatePinnedStyle()
	}

	togglePinned() {
		this.pinned = !this.pinned
		this.updatePinnedStyle()
	}

	private updatePinnedStyle() {
		if (this.pinned) {
			this.rootElement.classList.add('pinned')
		} else {
			this.rootElement.classList.remove('pinned')
		}
	}
}
