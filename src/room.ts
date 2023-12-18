import { push, ref } from 'firebase/database'
import { db } from './util/firebaseInit'
import { RecentRoom } from './recentRoom'

export type RecentRoomData = {
	id: string
	pinned: boolean
}

const DB_PATH = 'multi-room'
const RECENT_ROOMS_SAVE_KEY = 'recently-used-rooms'

const MAX_RECENT_ROOMS = 6

export let roomId: string
export let room: string

const saved = localStorage.getItem(RECENT_ROOMS_SAVE_KEY)
export const recentRooms: RecentRoomData[] = saved ? JSON.parse(saved) : []

const searchParams = new URLSearchParams(location.search)
const roomParam = searchParams.get('room')
if (roomParam) {
	setRoom(roomParam)
}

const container = document.getElementById('recent-room-container') as HTMLDivElement
for (const [i, data] of recentRooms.entries()) {
	const recentRoom = new RecentRoom(data)
	container.children[i]?.replaceWith(recentRoom.rootElement)
}

export function createRoom() {
	if (!roomId) {
		const id = push(ref(db, DB_PATH)).key
		if (id) {
			setRoom(id, true)
		} else {
			throw new Error("Can't get a new unique room id")
		}
	}
	return roomId
}

export function setRoom(id: string, pushHistory = false) {
	roomId = id
	room = `${DB_PATH}/${roomId}`
	if (pushHistory) {
		history.pushState(null, '', `?room=${roomId}`)
	}
	addRecentRoom()
}

function addRecentRoom() {
	const wasFull = recentRooms.length === MAX_RECENT_ROOMS
	const unpinnedSameIdIndex = recentRooms.findIndex((data) => !data.pinned && data.id === roomId)
	if (unpinnedSameIdIndex !== -1) {
		recentRooms.splice(unpinnedSameIdIndex, 1)
	}

	if (recentRooms.length === 0) {
		recentRooms.push({ id: roomId, pinned: false })
		saveRecentRooms()
		return
	}

	const firstUnpinnedIndex = recentRooms.findIndex((data) => !data.pinned)
	if (firstUnpinnedIndex !== -1) {
		let lastData = recentRooms[firstUnpinnedIndex]!
		function fn(startingIndex: number) {
			for (let index = startingIndex + 1; index < recentRooms.length; index++) {
				const data = recentRooms[index]!
				if (!data.pinned) {
					recentRooms[index] = lastData
					lastData = data
					fn(index)
				}
			}
		}
		fn(firstUnpinnedIndex)
		recentRooms[firstUnpinnedIndex] = { id: roomId, pinned: false }
		if (!wasFull) {
			recentRooms.push(lastData)
		}
	}
	saveRecentRooms()
}

export function saveRecentRooms() {
	localStorage.setItem(RECENT_ROOMS_SAVE_KEY, JSON.stringify(recentRooms))
}
