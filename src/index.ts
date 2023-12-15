import './styleHelper/icon'
import './styleHelper/iconButton'
import './styleHelper/touchResponse'
import './styleHelper/dialog'
import './styleHelper/video'

import './custom-video'

import './iceServerData'
import './selectDevice'
import './peerConnection'
import './keyBoardControls'

import { createRoom } from './util/room'
import { startPeerConnection } from './peerConnectionsManager'
import { setVideoState, welcomeDone } from './selectDevice'

const startBtn = document.getElementById('start-button') as HTMLButtonElement

const hiddenAfterCall = document.getElementsByClassName(
	'hidden-after-call'
) as HTMLCollectionOf<HTMLElement>
const shownAfterCall = document.getElementsByClassName(
	'shown-after-call'
) as HTMLCollectionOf<HTMLElement>

async function updateHideStyle() {
	for (const el of hiddenAfterCall) {
		el.hidden = true
	}
	for (const el of shownAfterCall) {
		el.hidden = false
	}
}

function start() {
	if (document.startViewTransition) {
		document.startViewTransition(updateHideStyle)
	} else {
		updateHideStyle()
	}

	createRoom()
	startPeerConnection()
}
startBtn.addEventListener('click', start)

async function handleAutoStart() {
	const searchParams = new URLSearchParams(location.search)
	const shouldAutoStart = searchParams.get('auto-start') === 'true'
	if (shouldAutoStart) {
		setVideoState(false)
		await welcomeDone
		start()
	}
}
handleAutoStart()
