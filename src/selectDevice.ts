import { openDialogModal } from "./styleHelper/dialog";

const VIDEO_DEVICE_SAVE_KEY = 'video-device-select'
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

const videoSelect = document.getElementById('video-select') as HTMLSelectElement
// const audioSelect = document.getElementById('audio-select') as HTMLSelectElement

;(async function () {
	let shouldPopulate = true
	try {
		// Firefox doesn't have camera query
		// Lower version Safari and Android WebView doesn't have navigator.permissions
		const status = await navigator.permissions.query({ name: 'camera' as PermissionName })
		if (status.state === 'prompt') {
			openDialogModal(welcomeDialog)
			shouldPopulate = false
		}
	} catch {}
	if (shouldPopulate) {
		await populateMediaSelection()
	}
})()
welcomeDialog.addEventListener('cancel', (ev) => {
	ev.preventDefault()
})
welcomeDialog.addEventListener('submit', populateMediaSelection)

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
	localStorage.setItem(VIDEO_DEVICE_SAVE_KEY, videoSelect.value)
	if (!videoSelect.value) {
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

async function populateMediaSelection() {
	// Mobile don't have getDisplayMedia capability yet
	if (typeof navigator.mediaDevices.getDisplayMedia === 'function') {
		const option = document.createElement('option')
		option.innerText = 'Screen Capture (Browser)'
		option.value = SCREEN_CAPTURE
		videoSelect.add(option)
	}

	if (await getMediaPermission()) {
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

export function onDeviceSelectChange(listener: EventListener) {
	videoSelect.addEventListener('change', listener)
}
