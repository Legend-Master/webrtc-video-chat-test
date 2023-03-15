import { openDialogModal } from './styleHelper/dialog'

import mdiVideo from 'iconify-icon:mdi/video'
import mdiVideoOff from 'iconify-icon:mdi/video-off'

const VIDEO_DEVICE_SAVE_KEY = 'video-device-select'
const VIDEO_DISABLED_SAVE_KEY = 'video-disabled'
// const AUDIO_DEVICE_SAVE_KEY = 'audio-device-select'

const SCREEN_CAPTURE = 'screen-capture'

const VIDEO_SETTING: MediaTrackConstraints = {
	frameRate: 60,
	width: 10_000,
	height: 10_000,
	// suppressLocalAudioPlayback: true,
}

const welcomeDialog = document.getElementById('welcome-dialog') as HTMLDialogElement
// const requestPermission = document.getElementById('request-permission') as HTMLButtonElement

const videoToggle = document.getElementById('toggle-video') as HTMLButtonElement
const videoSelect = document.getElementById('video-select') as HTMLSelectElement
// const audioSelect = document.getElementById('audio-select') as HTMLSelectElement

;(async function () {
	let shouldPopulate = true
	let hasPermission = false
	try {
		// Firefox doesn't have camera query
		// Lower version Safari and Android WebView doesn't have navigator.permissions
		const status = await navigator.permissions.query({ name: 'camera' as PermissionName })
		if (status.state === 'prompt') {
			openDialogModal(welcomeDialog)
			shouldPopulate = false
		}
		hasPermission = status.state === 'granted'
	} catch {}
	if (shouldPopulate) {
		await populateMediaSelection(hasPermission)
	}
})()
welcomeDialog.addEventListener('cancel', (ev) => {
	ev.preventDefault()
})
welcomeDialog.addEventListener('submit', () => populateMediaSelection())

export let videoState: boolean
type StateChangeListener = (state: boolean) => void
const videoStateChangeListeners: StateChangeListener[] = []
function setVideoState(state: boolean) {
	videoState = state
	videoToggle.innerHTML = videoState ? mdiVideo : mdiVideoOff
	videoToggle.title = videoState ? 'Turn off camera' : 'Turn on camera'
	videoState
		? localStorage.removeItem(VIDEO_DISABLED_SAVE_KEY)
		: localStorage.setItem(VIDEO_DISABLED_SAVE_KEY, '1')
	for (const fn of videoStateChangeListeners) {
		fn(videoState)
	}
}
export function onVideoStateChange(fn: StateChangeListener) {
	videoStateChangeListeners.push(fn)
}
setVideoState(!localStorage.getItem(VIDEO_DISABLED_SAVE_KEY))
videoToggle.addEventListener('click', () => {
	setVideoState(!videoState)
})

export function onDeviceSelectChange(listener: EventListener) {
	videoSelect.addEventListener('change', listener)
}
onDeviceSelectChange(() => {
	localStorage.setItem(VIDEO_DEVICE_SAVE_KEY, videoSelect.value)
})

async function getMediaPermission() {
	try {
		const stream = await navigator.mediaDevices.getUserMedia({
			video: true,
			// audio: true,
		})
		for (const track of stream.getTracks()) {
			track.stop()
		}
		return true
	} catch {
		return false
	}
}

export async function getUserMedia() {
	if (!videoState || !videoSelect.value) {
		return
	}
	try {
		if (videoSelect.value === SCREEN_CAPTURE) {
			return await navigator.mediaDevices.getDisplayMedia({
				video: VIDEO_SETTING,
				audio: true,
			})
		} else {
			return await navigator.mediaDevices.getUserMedia({
				video: {
					...VIDEO_SETTING,
					deviceId: videoSelect.value,
				},
			})
		}
	} catch (error) {
		if (error instanceof DOMException) {
			if (error.name !== 'NotAllowedError') {
				alert(
					`${error}\n\nVideo capture failed, but you can still see another user's video, or click the refresh icon after 'Video Source' to try again`
				)
			}
		} else {
			throw error
		}
	}
}

function selectLastMediaOption() {
	const videoId = localStorage.getItem(VIDEO_DEVICE_SAVE_KEY)
	// const audioId = localStorage.getItem(AUDIO_DEVICE_SAVE_KEY)

	for (const [index, option] of Object.entries(videoSelect)) {
		if (option instanceof HTMLOptionElement) {
			if (option.value === videoId) {
				videoSelect.selectedIndex = Number(index)
				break
			}
		}
	}
}

async function populateMediaSelection(hadPermission?: boolean) {
	// Mobile don't have getDisplayMedia capability yet
	if (typeof navigator.mediaDevices.getDisplayMedia === 'function') {
		const option = document.createElement('option')
		option.innerText = 'Screen Capture (Browser)'
		option.value = SCREEN_CAPTURE
		videoSelect.add(option)
	}

	if (hadPermission || (await getMediaPermission())) {
		for (const device of await navigator.mediaDevices.enumerateDevices()) {
			if (device.kind === 'videoinput') {
				const option = document.createElement('option')
				option.innerText = device.label
				option.value = device.deviceId
				videoSelect.add(option)
			}
			// else if (device.kind === 'audioinput') {
			// 	const option = document.createElement('option')
			// 	option.label = device.label
			// 	option.value = device.deviceId
			// 	audioSelect.add(option)
			// }
		}
	}

	selectLastMediaOption()
}
