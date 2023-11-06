import { roomId, setRoom } from './util/room'

const roomInput = document.getElementById('room-input') as HTMLInputElement

if (roomInput.value === '') {
	roomInput.value = roomId ?? ''
}

roomInput.addEventListener('change', () => {
    setRoom(roomInput.value)
})
