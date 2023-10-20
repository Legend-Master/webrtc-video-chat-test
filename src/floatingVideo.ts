import { onVideoStateChange } from './selectDevice'
import { createIconButton } from './styleHelper/iconButton'
import { bindVideo } from './styleHelper/video'

import mdiFullscreen from 'iconify-icon:mdi/fullscreen'
import mdiFullscreenExit from 'iconify-icon:mdi/fullscreen-exit'
import mdiPip from 'iconify-icon:mdi/picture-in-picture-bottom-right'

export const localVideo = bindVideo()

export function showLocalVideo() {
	wrapper.hidden = false
}

onVideoStateChange((state) => {
	if (!state) {
		wrapper.hidden = true
	}
})

localVideo.id = 'local-video'
localVideo.autoplay = true
// @ts-ignore
localVideo.playsinline = true

const wrapper = document.createElement('div')
wrapper.id = 'local-video-wrapper'
wrapper.hidden = true
wrapper.classList.add('hide-controls')

const controlsWrapper = document.createElement('div')
controlsWrapper.classList.add('controls-wrapper')

function isFullscreen() {
	return document.fullscreenElement === wrapper
}

function updateFullscreenStyle() {
	if (isFullscreen()) {
		fullscreenButton.innerHTML = mdiFullscreenExit
		fullscreenButton.title = 'Full screen'
		wrapper.classList.add('fullscreen')
	} else {
		fullscreenButton.innerHTML = mdiFullscreen
		fullscreenButton.title = 'Exit full screen'
		wrapper.classList.remove('fullscreen')
		try {
			screen.orientation.unlock()
		} catch {}
	}
	updatePosition()
}

declare global {
	interface ScreenOrientation {
		/** [MDN Reference](https://developer.mozilla.org/docs/Web/API/ScreenOrientation/lock) */
		lock: (
			orientation:
				| 'any'
				| 'natural'
				| 'landscape'
				| 'portrait'
				| 'portrait-primary'
				| 'portrait-secondary'
				| 'landscape-primary'
				| 'landscape-secondary'
		) => Promise<void>
	}
}

// This API is on Chrome Android only
async function fullscreenAutoRotate() {
	if (!screen.orientation.lock) {
		return
	}
	try {
		if (localVideo.videoWidth < localVideo.videoHeight) {
			await screen.orientation.lock('portrait')
		} else {
			await screen.orientation.lock('landscape')
		}
	} catch {}
	// Throw expected on Chrome desktop
}

async function toggleFullscreen() {
	if (isFullscreen()) {
		await document.exitFullscreen()
	} else {
		await Promise.all([fullscreenAutoRotate(), wrapper.requestFullscreen()])
	}
}

const fullscreenButton = createIconButton(mdiFullscreen)
fullscreenButton.title = 'Full screen'
fullscreenButton.addEventListener('click', toggleFullscreen)
wrapper.addEventListener('fullscreenchange', updateFullscreenStyle)
controlsWrapper.append(fullscreenButton)

// Firefox and Android Webview (kinda irrelevant) doesn't support PiP API yet
if (localVideo.requestPictureInPicture) {
	const pipButton = createIconButton(mdiPip)
	pipButton.title = 'Enter picture-in-picture'
	pipButton.addEventListener('click', () => {
		localVideo.requestPictureInPicture()
	})
	localVideo.addEventListener('enterpictureinpicture', () => {
		wrapper.classList.add('picture-in-picture')
	})
	localVideo.addEventListener('leavepictureinpicture', () => {
		wrapper.classList.remove('picture-in-picture')
	})
	controlsWrapper.append(pipButton)
}

wrapper.append(controlsWrapper)
wrapper.append(localVideo)
document.body.append(wrapper)

let hideControlsTimeout: number | undefined
let keyboardFocusedControl = false
let controlsHovered = false
let dragging = false

function showControls() {
	wrapper.classList.remove('hide-controls')
}

function hideControls() {
	if (keyboardFocusedControl || controlsHovered || dragging) {
		return
	}
	clearTimeout(hideControlsTimeout)
	wrapper.classList.add('hide-controls')
}

function isControlsHidden() {
	return wrapper.classList.contains('hide-controls')
}

function refreshHideOnIdle() {
	clearTimeout(hideControlsTimeout)
	hideControlsTimeout = setTimeout(hideControls, 2000)
}

function outOfIdle() {
	showControls()
	refreshHideOnIdle()
}

wrapper.addEventListener('pointerenter', (ev) => {
	// We handle touch screens in pointerup
	if (ev.pointerType !== 'mouse') {
		return
	}
	clearTimeout(hideControlsTimeout)
	showControls()
})

wrapper.addEventListener('pointerleave', (ev) => {
	// We handle touch screens in pointerup
	if (ev.pointerType !== 'mouse') {
		return
	}
	if (isFullscreen()) {
		return
	}
	clearTimeout(hideControlsTimeout)
	hideControls()
})

wrapper.addEventListener('pointermove', (ev) => {
	// We handle touch screens in pointerup
	if (ev.pointerType !== 'mouse') {
		return
	}
	// How???
	if (ev.movementX === 0 && ev.movementY === 0) {
		return
	}
	outOfIdle()
})

let resetPointerEventTimeout: number
wrapper.addEventListener('pointerup', (ev) => {
	// Handle touch screen only
	if (ev.pointerType === 'mouse') {
		return
	}
	if (dragging) {
		return
	}
	if (isControlsHidden()) {
		// Delay a bit for touch screen to not instantly click on control buttons (e.g. fullscreen button)
		controlsWrapper.style.pointerEvents = 'none'
		clearTimeout(resetPointerEventTimeout)
		resetPointerEventTimeout = setTimeout(() => {
			controlsWrapper.style.pointerEvents = ''
		}, 100)
		outOfIdle()
	} else {
		// Tap again to hide controls faster
		if (controlsHovered) {
			refreshHideOnIdle()
		} else {
			hideControls()
		}
	}
})

controlsWrapper.addEventListener('pointerenter', () => {
	controlsHovered = true
})

controlsWrapper.addEventListener('pointerleave', () => {
	controlsHovered = false
})

// Don't know any better way to detect if it's from a tab or click
// Inspired by https://github.com/WICG/focus-visible
let hasKeyboardEvent = false

controlsWrapper.addEventListener('focusin', (ev) => {
	if (!hasKeyboardEvent) {
		return
	}
	keyboardFocusedControl = true
	showControls()
})

controlsWrapper.addEventListener('focusout', (ev) => {
	if (!keyboardFocusedControl) {
		return
	}
	keyboardFocusedControl = false
	hideControls()
})

window.addEventListener('pointerdown', (ev) => {
	hasKeyboardEvent = false
})

window.addEventListener('keydown', (ev) => {
	if (ev.metaKey || ev.altKey || ev.ctrlKey) {
		return
	}
	hasKeyboardEvent = true
})

let pointerDown = false
let videoX = -20
let videoY = 20

let dragInitialX = 0
let dragInitialY = 0

function clamp(num: number, min: number, max: number) {
	return Math.min(max, Math.max(min, num))
}

const edgeWidth = 50

// 0, 0 is top right
function updatePosition() {
	if (isFullscreen()) {
		wrapper.style.translate = ''
		return
	}
	if (!wrapper.hidden) {
		const { width, height } = wrapper.getBoundingClientRect()
		videoX = clamp(videoX, -innerWidth + edgeWidth, width - edgeWidth)
		videoY = clamp(videoY, -height + edgeWidth, innerHeight - edgeWidth)
	}
	wrapper.style.translate = `${videoX}px ${videoY}px`
}
updatePosition()
window.addEventListener('resize', updatePosition)

function moveTo(x: number, y: number) {
	videoX = x - dragInitialX
	videoY = y - dragInitialY
	updatePosition()
}

window.addEventListener('pointermove', (ev) => {
	if (!pointerDown) {
		return
	}
	if (document.fullscreenElement === wrapper) {
		return
	}
	// How???
	if (ev.movementX === 0 && ev.movementY === 0) {
		return
	}

	moveTo(ev.clientX, ev.clientY)

	if (!dragging) {
		dragging = true
		wrapper.classList.add('dragging')
	}
})

wrapper.addEventListener('pointerdown', (ev) => {
	// Primary button only
	if (!ev.isPrimary) {
		return
	}

	pointerDown = true
	dragInitialX = ev.clientX - videoX
	dragInitialY = ev.clientY - videoY

	ev.preventDefault()
})

window.addEventListener('pointerup', () => {
	if (!pointerDown) {
		return
	}

	pointerDown = false

	if (dragging) {
		dragging = false
		wrapper.classList.remove('dragging')
		refreshHideOnIdle()
	}
})
