import { start } from './startHandler'
import { RecentRoomData, saveRecentRooms, setRoom } from './room'

import mdiPin from 'iconify-icon:mdi/pin'
import mdiPinOff from 'iconify-icon:mdi/pin-off'

import './recentRoom.css'

export class RecentRoom {
	rootElement: HTMLDivElement

	private startButton: HTMLButtonElement
	private pinButton: HTMLButtonElement
	private separator: HTMLDivElement

	constructor(public data: RecentRoomData) {
		this.rootElement = document.createElement('div')
		this.rootElement.classList.add('recent-room')

		this.startButton = document.createElement('button')
		this.startButton.classList.add('start-button')
		this.startButton.addEventListener('click', () => {
			setRoom(this.data.id, true)
			start()
		})
		this.setRoomId(data.id)

		this.pinButton = document.createElement('button')
		this.pinButton.classList.add('pin-button')
		this.pinButton.addEventListener('click', () => this.togglePinned())
		this.setPinned(data.pinned)

		this.separator = document.createElement('div')
		this.separator.classList.add('separator')

		this.rootElement.append(this.startButton, this.separator, this.pinButton)
	}

	setRoomId = (roomId: string) => {
		this.data.id = roomId
		this.startButton.innerText = roomId
	}

	setPinned = (pinned: boolean, save = false) => {
		this.data.pinned = pinned
		if (save) {
			saveRecentRooms()
		}
		this.updatePinnedStyle()
	}

	togglePinned() {
		this.setPinned(!this.data.pinned, true)
	}

	private updatePinnedStyle() {
		if (this.data.pinned) {
			this.pinButton.innerHTML = mdiPin
			this.rootElement.classList.add('pinned')
		} else {
			this.pinButton.innerHTML = mdiPinOff
			this.rootElement.classList.remove('pinned')
		}
	}
}
