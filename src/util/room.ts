import { push, ref } from 'firebase/database'
import { db } from '../firebaseInit'

const DB_PATH = 'room'

export let roomId: string
export let room: string

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
			throw new Error("Can't get a new unique room id");
		}
	}
	return roomId
}

function setRoom(id: string) {
	roomId = id
	room = `${DB_PATH}/${roomId}`
}
