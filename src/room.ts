import { push, ref } from 'firebase/database'
import { db } from './util/firebaseInit'
import { RecentRoom } from './recentRoom'
import { start } from './startHandler'

export type RecentRoomData = {
	id: string
	pinned: boolean
}

const DB_PATH = 'multi-room'
const RECENT_ROOMS_SAVE_KEY = 'recently-used-rooms'

const MAX_RECENT_ROOMS = 6

export let roomId = ''
export let room = ''

const saved = localStorage.getItem(RECENT_ROOMS_SAVE_KEY)
export const recentRooms: RecentRoomData[] = saved ? JSON.parse(saved) : []

const searchParams = new URLSearchParams(location.search)
const roomParam = searchParams.get('room')
if (roomParam) {
	setRoom(roomParam, false, true)
}

const container = document.getElementById('recent-room-container') as HTMLDivElement
for (const [i, data] of recentRooms.entries()) {
	const recentRoom = new RecentRoom(data)
	container.children[i]?.replaceWith(recentRoom.rootElement)
}

const roomInput = document.getElementById('room-input') as HTMLInputElement
const startButton = document.getElementById('start-button') as HTMLButtonElement

startButton.addEventListener('click', () => {
	if (!roomInput.reportValidity()) {
		roomInput.setCustomValidity(`Only letter, number, '-', '_' are allowed`)
		return
	}
	if (roomInput.value === '') {
		createRoom()
	} else {
		setRoom(roomInput.value, true)
	}
	start()
})

roomInput.value = roomId ?? ''

roomInput.addEventListener('change', () => {
	if (!roomInput.reportValidity()) {
		roomInput.setCustomValidity(`Only letter, number, '-', '_' are allowed`)
	}
})

roomInput.addEventListener('input', () => {
	roomInput.setCustomValidity('')
})

roomInput.addEventListener('keydown', (ev) => {
	if (ev.key === 'Enter') {
		startButton.click()
	}
})

function createRoom() {
	const id = push(ref(db, DB_PATH)).key
	if (id) {
		setRoom(id, true)
	} else {
		throw new Error("Can't get a new unique room id")
	}
}

export function setRoom(id: string, changeHistory = false, noSave = false) {
	roomId = id
	room = `${DB_PATH}/${roomId}`
	if (changeHistory) {
		history.replaceState(null, '', `?room=${roomId}`)
	}
	if (!noSave) {
		addRecentRoom()
	}
}

function addRecentRoom() {
	const unpinnedSameIdIndex = recentRooms.findIndex((data) => !data.pinned && data.id === roomId)
	if (unpinnedSameIdIndex !== -1) {
		recentRooms.splice(unpinnedSameIdIndex, 1)
	}

	const wasFull = recentRooms.length === MAX_RECENT_ROOMS

	let lastData: RecentRoomData = { id: roomId, pinned: false }
	for (let index = 0; index < recentRooms.length; index++) {
		const data = recentRooms[index]!
		if (data.pinned) {
			continue
		}
		recentRooms[index] = lastData
		lastData = data
	}
	if (!wasFull) {
		recentRooms.push(lastData)
	}
	saveRecentRooms()
}

export function saveRecentRooms() {
	localStorage.setItem(RECENT_ROOMS_SAVE_KEY, JSON.stringify(recentRooms))
}
