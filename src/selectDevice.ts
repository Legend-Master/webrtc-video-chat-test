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

export const welcomeDone = new Promise<void>(async (resolve) => {
	let state: PermissionState | undefined
	try {
		// Firefox doesn't have camera query
		// Android WebView and lower version Safari doesn't have navigator.permissions
		const status = await navigator.permissions.query({ name: 'camera' as PermissionName })
		state = status.state
	} catch {}
	if (state === 'prompt') {
		openDialogModal(welcomeDialog)
		welcomeDialog.addEventListener('submit', async () => {
			await populateMediaSelection()
			resolve()
		})
	} else {
		await populateMediaSelection(state === 'granted')
		resolve()
	}
})
welcomeDialog.addEventListener('cancel', (ev) => {
	ev.preventDefault()
})

export let videoState: boolean
type StateChangeListener = (state: boolean) => void
const videoStateChangeListeners: StateChangeListener[] = []
export function setVideoState(state: boolean, shouldSave = false) {
	if (videoState === state) {
		return
	}
	videoState = state
	videoToggle.innerHTML = videoState ? mdiVideo : mdiVideoOff
	videoToggle.title = videoState ? 'Turn off camera' : 'Turn on camera'
	if (shouldSave) {
		videoState
			? localStorage.removeItem(VIDEO_DISABLED_SAVE_KEY)
			: localStorage.setItem(VIDEO_DISABLED_SAVE_KEY, '1')
	}
	for (const fn of videoStateChangeListeners) {
		fn(videoState)
	}
}
export function onVideoStateChange(fn: StateChangeListener) {
	videoStateChangeListeners.push(fn)
}
videoToggle.addEventListener('click', () => {
	setVideoState(!videoState, true)
})
setVideoState(!localStorage.getItem(VIDEO_DISABLED_SAVE_KEY))

const RESOLUTION_NO_LIMIT = 100_000
export let videoResolution = RESOLUTION_NO_LIMIT
type ResolutionChangeListener = (resolution: number) => void
const resolutionChangeListeners: ResolutionChangeListener[] = []
export function onResolutionChange(fn: ResolutionChangeListener) {
	resolutionChangeListeners.push(fn)
}
function setResolution(value: string) {
	const resolution = Number(value)
	videoResolution = isNaN(resolution) || resolution === 0 ? RESOLUTION_NO_LIMIT : resolution
	resolution
		? localStorage.setItem(VIDEO_RESOLUTION_SAVE_KEY, value)
		: localStorage.removeItem(VIDEO_RESOLUTION_SAVE_KEY)
	for (const fn of resolutionChangeListeners) {
		fn(videoResolution)
	}
}
resolutionSelect.addEventListener('change', () => {
	setResolution(resolutionSelect.value)
})
const savedResolution = localStorage.getItem(VIDEO_RESOLUTION_SAVE_KEY)
const selected = selectIndexByValue(resolutionSelect, savedResolution)
// Don't apply the effect to confuse people if we can't select the right UI
if (selected) {
	setResolution(savedResolution!)
}

export function onDeviceSelectChange(listener: EventListener) {
	videoSelect.addEventListener('change', listener)
}
onDeviceSelectChange(() => {
	localStorage.setItem(VIDEO_DEVICE_SAVE_KEY, videoSelect.value)
})

function getVideoSettings(): MediaTrackConstraints {
	return {
		frameRate: 60,
		width: RESOLUTION_NO_LIMIT,
		height: RESOLUTION_NO_LIMIT,
		// Prefer 4:3 for mobile cameras
		aspectRatio: 4 / 3,
	}
}

export async function getUserMedia() {
	if (!videoSelect.value) {
		return
	}
	try {
		if (videoSelect.value === SCREEN_CAPTURE) {
			return await navigator.mediaDevices.getDisplayMedia({
				video: {
					...getVideoSettings(),
					width: screen.width * devicePixelRatio,
					height: screen.height * devicePixelRatio,
				},
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

	// Firefox mobile requires a running user media stream to call `enumerateDevices`
	let stream
	if (!hadPermission) {
		try {
			stream = await navigator.mediaDevices.getUserMedia({
				video: true,
				// audio: true,
			})
		} catch (e) {}
	}
	if (hadPermission || stream) {
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
		if (stream) {
			for (const track of stream.getTracks()) {
				track.stop()
			}
		}
	}

	selectLastMediaOption()
}

function selectIndexByValue(selectElement: HTMLSelectElement, value?: string | null): boolean {
	if (typeof value === 'string') {
		for (const [index, option] of Object.entries(selectElement.options)) {
			if (option.value === value) {
				selectElement.selectedIndex = Number(index)
				return true
			}
		}
	}
	return false
}
