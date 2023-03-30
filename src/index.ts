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

const debugLogDiv = document.getElementById('debug-info-log') as HTMLElement
function log(thing: any) {
	const logString = typeof thing === 'string' ? thing : JSON.stringify(thing, undefined, 4)
	const preString = debugLogDiv.innerText ? `${debugLogDiv.innerText}\n` : debugLogDiv.innerText
	debugLogDiv.innerText = `${preString}${logString}`
}

// for (const video of document.getElementsByTagName('video')) {
// 	video.addEventListener('fullscreenchange', async (ev) => {
// 		log(ev)
// 		if (!document.fullscreenElement) {
// 			await video.play()
// 		}
// 	})
// }

for (const video of document.getElementsByTagName('video')) {
	video.addEventListener('webkitfullscreenchange', (ev) => {
		const date = new Date()
		const infoToLog: any = {
			time: `${date.getHours()}:${date.getMinutes()}:${date.getSeconds()}:${date.getMilliseconds()}`,
			target: ev.target instanceof HTMLVideoElement ? ev.target.id : ev.target,
			fullscreen: Boolean(document.fullscreenElement),
			paused: video.paused,
		}
		// for (const video of document.getElementsByTagName('video')) {
		// 	infoToLog[`${video.id} paused`] = video.paused
		// }
		log(infoToLog)
	})
	video.addEventListener('webkitenterfullscreen', (ev) => {
		const date = new Date()
		const infoToLog: any = {
			enter: true,
			time: `${date.getHours()}:${date.getMinutes()}:${date.getSeconds()}:${date.getMilliseconds()}`,
			target: ev.target instanceof HTMLVideoElement ? ev.target.id : ev.target,
			fullscreen: Boolean(document.fullscreenElement),
			paused: video.paused,
		}
		// for (const video of document.getElementsByTagName('video')) {
		// 	infoToLog[`${video.id} paused`] = video.paused
		// }
		log(infoToLog)
	})
	video.addEventListener('webkitexitfullscreen', (ev) => {
		const date = new Date()
		const infoToLog: any = {
			exit: true,
			time: `${date.getHours()}:${date.getMinutes()}:${date.getSeconds()}:${date.getMilliseconds()}`,
			target: ev.target instanceof HTMLVideoElement ? ev.target.id : ev.target,
			fullscreen: Boolean(document.fullscreenElement),
			paused: video.paused,
		}
		// for (const video of document.getElementsByTagName('video')) {
		// 	infoToLog[`${video.id} paused`] = video.paused
		// }
		log(infoToLog)
	})
}
// log(1)
// log({
// 	a: 1
// })
