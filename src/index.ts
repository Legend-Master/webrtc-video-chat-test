import './styleHelper/icon'
import './styleHelper/iconButton'
import './styleHelper/touchResponse'
import './styleHelper/dialog'
import './styleHelper/video'

import './roomEdit'
import './iceServerData'
import './selectDevice'
import './peerConnection'
import './keyBoardControls'
import './remoteVideo'

import { createRoom } from './util/room'
import { startPeerConnection } from './peerConnection'

const startBtn = document.getElementById('start-button') as HTMLButtonElement

async function updateHideStyle() {
	document.documentElement.classList.add('call-started')
}

startBtn.addEventListener('click', () => {
	if (document.startViewTransition) {
		document.startViewTransition(updateHideStyle)
	} else {
		updateHideStyle()
	}

	// createRoom()
	// startPeerConnection()
})
