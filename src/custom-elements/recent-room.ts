import { start } from '../startHandler'
import mdiPin from 'iconify-icon:mdi/pin'

import './recent-room.css'

class RecentRoom extends HTMLElement {
	private startButton!: HTMLButtonElement
	private pinButton!: HTMLButtonElement
	private separator!: HTMLDivElement
	private pinned = false

	constructor() {
		super()
	}

	connectedCallback() {
		this.startButton = document.createElement('button')
		this.startButton.classList.add('start-button')
		this.startButton.addEventListener('click', () => start())

		this.pinButton = document.createElement('button')
		this.pinButton.innerHTML = mdiPin
		this.pinButton.classList.add('pin-button')
		this.pinButton.addEventListener('click', () => this.togglePinned())

		this.separator = document.createElement('div')
		this.separator.classList.add('separator')

		this.append(this.startButton, this.separator, this.pinButton)
	}

	disconnectedCallback() {}

	setRoomId(roomId: string) {
		this.startButton.innerText = roomId
	}

	setPinned(pinned: boolean) {
		this.pinned = pinned
		this.updatePinnedStyle()
	}

	togglePinned() {
		this.pinned = !this.pinned
		this.updatePinnedStyle()
	}

	private updatePinnedStyle() {
		if (this.pinned) {
			this.classList.add('pinned')
		} else {
			this.classList.remove('pinned')
		}
	}
}
customElements.define('recent-room', RecentRoom)
declare global {
	interface HTMLElementTagNameMap {
		'recent-room': RecentRoom
	}
}
