import { roomId, setRoom } from './util/room'

const roomInput = document.getElementById('room-input') as HTMLInputElement

if (roomInput.value === '') {
	roomInput.value = roomId ?? ''
}

roomInput.addEventListener('change', () => {
	if (roomInput.reportValidity()) {
		setRoom(roomInput.value)
	} else {
        roomInput.setCustomValidity(`Only letter, number, '-', '_' are allowed`)
    }
})

roomInput.addEventListener('input', () => {
    roomInput.setCustomValidity('')
})
