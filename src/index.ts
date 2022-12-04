import { createRoom } from './util/room'
import { startPeerConnection } from './peerConnection'

const startBtn = document.getElementById('start-button') as HTMLButtonElement

const hiddenAfterCall = document.getElementsByClassName(
	'hidden-after-call'
) as HTMLCollectionOf<HTMLElement>
const shownAfterCall = document.getElementsByClassName(
	'shown-after-call'
) as HTMLCollectionOf<HTMLElement>

function startChat() {
	return async () => {
		for (const el of hiddenAfterCall) {
			el.hidden = true
		}
		for (const el of shownAfterCall) {
			el.hidden = false
		}
		createRoom()
		startPeerConnection()
	}
}
startBtn.addEventListener('click', startChat())
