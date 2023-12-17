import { push, ref } from 'firebase/database'
import { db } from './util/firebaseInit'
import { RecentRoom } from './recentRoom'

type RecentRoomData = {
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

const container = document.createElement('div')
for (const data of recentRooms) {
	const recentRoom = new RecentRoom()
	recentRoom.setRoomId(data.id)
	recentRoom.setPinned(data.pinned)
	container.append(recentRoom.rootElement)
}
document.body.append(container)

const searchParams = new URLSearchParams(location.search)
const roomParam = searchParams.get('room')
if (roomParam) {
	setRoom(roomParam)
}

export function createRoom() {
	if (!roomId) {
		const id = push(ref(db, DB_PATH)).key
		if (id) {
			setRoom(id)
			history.pushState(null, '', `?room=${roomId}`)
		} else {
			throw new Error("Can't get a new unique room id")
		}
	}
	return roomId
}

function setRoom(id: string) {
	roomId = id
	room = `${DB_PATH}/${roomId}`
	addRecentRoom()
}

function addRecentRoom() {
	for (const [i, data] of recentRooms.entries()) {
		if (data.id === roomId) {
			recentRooms.splice(i, 1)
			recentRooms.unshift({ id: roomId, pinned: false })
			saveRecentRooms()
			return
		}
	}
	recentRooms.unshift({ id: roomId, pinned: false })
	if (recentRooms.length > MAX_RECENT_ROOMS) {
		recentRooms.pop()
	}
	saveRecentRooms()
}

function saveRecentRooms() {
	localStorage.setItem(RECENT_ROOMS_SAVE_KEY, JSON.stringify(recentRooms))
}

function pinRoom() {}

function unpinRoom() {}
