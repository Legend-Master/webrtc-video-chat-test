import { push, ref } from 'firebase/database'
import { db } from './util/firebaseInit'

const DB_PATH = 'multi-room'
const RECENTLY_USED_ROOMS_SAVE_KEY = 'recently-used-rooms'

const MAX_RECENTLY_USED_ROOMS = 6

export let roomId: string
export let room: string

const saved = localStorage.getItem(RECENTLY_USED_ROOMS_SAVE_KEY)
export const recentlyUsedRooms: string[] = saved ? JSON.parse(saved) : []

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
	addRecentlyUsedRoom()
}

function addRecentlyUsedRoom() {
	for (const [i, id] of recentlyUsedRooms.entries()) {
		if (id === roomId) {
			recentlyUsedRooms.splice(i, 1)
			recentlyUsedRooms.unshift(id)
			saveRecentlyUsedRooms()
			return
		}
	}
	recentlyUsedRooms.unshift(roomId)
	if (recentlyUsedRooms.length > MAX_RECENTLY_USED_ROOMS) {
		recentlyUsedRooms.pop()
	}
	saveRecentlyUsedRooms()
}

function saveRecentlyUsedRooms() {
	localStorage.setItem(RECENTLY_USED_ROOMS_SAVE_KEY, JSON.stringify(recentlyUsedRooms))
}
