import { push, ref } from 'firebase/database'
import { db } from '../firebaseInit'

const searchParams = new URLSearchParams(location.search)

export let room = searchParams.get('room')

export function createRoom() {
	if (!room) {
		room = push(ref(db)).key
		history.pushState(null, '', `?room=${room}`)
	}
	return room
}
