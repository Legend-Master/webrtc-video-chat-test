import { startPeerConnection } from './peerConnection'
import { createRoom } from './room'

const currentIce = document.getElementById('current-ice') as HTMLButtonElement

const startBtn = document.getElementById('start-button') as HTMLButtonElement

const hiddenAfterCall = document.getElementsByClassName(
	'hidden-after-call'
) as HTMLCollectionOf<HTMLElement>

function startChat() {
	return async () => {
		for (const el of hiddenAfterCall) {
			el.hidden = true
		}
		currentIce.disabled = true
		createRoom()
		startPeerConnection()
	}
}
startBtn.addEventListener('click', startChat())
