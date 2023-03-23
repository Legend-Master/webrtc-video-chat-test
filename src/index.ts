import './styleHelper/icon'
import './styleHelper/iconButton'
import './styleHelper/touchResponse'
import './styleHelper/dialog'

import './iceServerData'
import './selectDevice'
import './peerConnection'

import { createRoom } from './util/room'
import { startPeerConnection } from './peerConnection'

const startBtn = document.getElementById('start-button') as HTMLButtonElement

const hiddenAfterCall = document.getElementsByClassName(
	'hidden-after-call'
) as HTMLCollectionOf<HTMLElement>
const shownAfterCall = document.getElementsByClassName(
	'shown-after-call'
) as HTMLCollectionOf<HTMLElement>

startBtn.addEventListener('click', () => {
	for (const el of hiddenAfterCall) {
		el.hidden = true
	}
	for (const el of shownAfterCall) {
		el.hidden = false
	}
	createRoom()
	startPeerConnection()
})

// for (const video of document.getElementsByTagName('video')) {
// 	video.addEventListener('fullscreenchange', () => {
// 		console.log('fullscreen change')
// 	})
// }
// screen.orientation.addEventListener('change', () => {
// 	for (const video of document.getElementsByTagName('video')) {
// 		video.controls = false
// 	}
// 	console.log('orientation change')
// })

// const debugLogDiv = document.getElementById('debug-info-log') as HTMLDivElement
// function log(thing: any) {
// 	debugLogDiv.innerText = `${debugLogDiv.innerText}\n${JSON.stringify(thing, undefined, 2)}`
// }

// for (const video of document.getElementsByTagName('video')) {
// 	video.addEventListener('fullscreenchange', async (ev) => {
// 		log(ev)
// 		if (!document.fullscreenElement) {
// 			await video.play()
// 		}
// 	})
// }

// document.addEventListener('fullscreenchange', (ev) => {
// 	log(ev)
// })
// log(1)
// log(2)
;(async function play() {
	if (!document.fullscreenElement) {
		for (const video of document.getElementsByTagName('video')) {
			if (video.srcObject && video.paused) {
				console.log('play')
				await video.play()
			}
		}
		requestAnimationFrame(play)
	}
})()
