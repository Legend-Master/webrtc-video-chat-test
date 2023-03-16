import { openDialogModal } from './styleHelper/dialog'

import mdiVideo from 'iconify-icon:mdi/video'
import mdiVideoOff from 'iconify-icon:mdi/video-off'

const VIDEO_DEVICE_SAVE_KEY = 'video-device-select'
const VIDEO_DISABLED_SAVE_KEY = 'video-disabled'
const VIDEO_RESOLUTION_SAVE_KEY = 'video-resolution'
// const AUDIO_DEVICE_SAVE_KEY = 'audio-device-select'

const SCREEN_CAPTURE = 'screen-capture'

const welcomeDialog = document.getElementById('welcome-dialog') as HTMLDialogElement
// const requestPermission = document.getElementById('request-permission') as HTMLButtonElement

const videoToggle = document.getElementById('toggle-video') as HTMLButtonElement
const videoSelect = document.getElementById('video-select') as HTMLSelectElement

const resolutionSelect = document.getElementById('video-resolution-select') as HTMLSelectElement
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
videoToggle.addEventListener('click', () => {
	setVideoState(!videoState)
})
setVideoState(!localStorage.getItem(VIDEO_DISABLED_SAVE_KEY))

export function onDeviceSelectChange(listener: EventListener) {
	videoSelect.addEventListener('change', listener)
}
onDeviceSelectChange(() => {
	localStorage.setItem(VIDEO_DEVICE_SAVE_KEY, videoSelect.value)
})

const RESOLUTION_NO_LIMIT = 100_000
export let videoWidth = RESOLUTION_NO_LIMIT
export let videoHeight = RESOLUTION_NO_LIMIT
type ResolutionChangeListener = (width: number, height: number) => void
const resolutionChangeListeners: ResolutionChangeListener[] = []
export function onResolutionChange(fn: ResolutionChangeListener) {
	resolutionChangeListeners.push(fn)
}
function setResolution(value: string) {
	const [width, height] = value.split(':')
	videoWidth = width ? Number(width) : RESOLUTION_NO_LIMIT
	videoHeight = height ? Number(height) : RESOLUTION_NO_LIMIT
	width
		? localStorage.setItem(VIDEO_RESOLUTION_SAVE_KEY, value)
		: localStorage.removeItem(VIDEO_RESOLUTION_SAVE_KEY)
	selectIndexByValue(resolutionSelect, value)
	for (const fn of resolutionChangeListeners) {
		fn(videoWidth, videoHeight)
	}
}
resolutionSelect.addEventListener('change', () => {
	setResolution(resolutionSelect.value)
})
const resolutionStorage = localStorage.getItem(VIDEO_RESOLUTION_SAVE_KEY)
if (resolutionStorage) {
	setResolution(resolutionStorage)
}

function getVideoSettings(): MediaTrackConstraints {
	return {
		frameRate: 60,
		width: videoWidth,
		height: videoHeight,
	}
}

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
				video: getVideoSettings(),
				audio: true,
			})
		} else {
			return await navigator.mediaDevices.getUserMedia({
				video: {
					...getVideoSettings(),
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

	selectIndexByValue(videoSelect, videoId)
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

function selectIndexByValue(selectElement: HTMLSelectElement, value?: string | null) {
	if (!value) {
		return
	}
	for (const [index, option] of Object.entries(selectElement.options)) {
		if (option.value === value) {
			selectElement.selectedIndex = Number(index)
			break
		}
	}
}
