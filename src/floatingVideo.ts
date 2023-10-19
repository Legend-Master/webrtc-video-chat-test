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

const controlsWrapper = document.createElement('div')
controlsWrapper.classList.add('controls-wrapper')
controlsWrapper.classList.add('hide')

function isFullscreen() {
	return document.fullscreenElement === wrapper
}

function updateFullscreenStyle() {
	if (isFullscreen()) {
		fullscreenButton.innerHTML = mdiFullscreenExit
		fullscreenButton.title = 'Full screen'
		wrapper.style.translate = ''
		wrapper.classList.add('fullscreen')
	} else {
		fullscreenButton.innerHTML = mdiFullscreen
		fullscreenButton.title = 'Exit full screen'
		wrapper.style.translate = `${videoX}px ${videoY}px`
		wrapper.classList.remove('fullscreen')
	}
}

async function toggleFullscreen() {
	if (isFullscreen()) {
		await document.exitFullscreen()
	} else {
		await wrapper.requestFullscreen()
	}
}

const fullscreenButton = createIconButton(mdiFullscreen)
fullscreenButton.title = 'Full screen'
fullscreenButton.addEventListener('click', toggleFullscreen)
wrapper.addEventListener('dblclick', toggleFullscreen)
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

function showControls() {
	controlsWrapper.classList.remove('hide')
}
function hideControls() {
	controlsWrapper.classList.add('hide')
}

function hideControlsOnIdle() {
	clearTimeout(hideControlsTimeout)
	hideControls()
	wrapper.style.cursor = 'none'
}

function outOfIdle() {
	clearTimeout(hideControlsTimeout)
	showControls()
	wrapper.style.cursor = ''
	// Schedule new hide timeout
	hideControlsTimeout = setTimeout(hideControlsOnIdle, 2000)
}

wrapper.addEventListener('pointerout', (ev) => {
	// We use time out for touch screens
	if (ev.pointerType !== 'mouse') {
		return
	}
	if (isFullscreen()) {
		return
	}
	clearTimeout(hideControlsTimeout)
	hideControls()
})

wrapper.addEventListener('pointermove', () => {
	outOfIdle()
})

let dragging = false
let videoX = -20
let videoY = 20

let dragInitialX = 0
let dragInitialY = 0

function clamp(num: number, min: number, max: number) {
	return Math.min(max, Math.max(min, num))
}

const edgeWidth = 50

function updatePosition() {
	const { width, height } = wrapper.getBoundingClientRect()
	videoX = clamp(videoX, -innerWidth + edgeWidth, width - edgeWidth)
	videoY = clamp(videoY, -height + edgeWidth, innerHeight - edgeWidth)
	wrapper.style.translate = `${videoX}px ${videoY}px`
}
updatePosition()
window.addEventListener('resize', updatePosition)

// 0, 0 is top right
function moveTo(x: number, y: number) {
	videoX = x - dragInitialX
	videoY = y - dragInitialY
	updatePosition()
}

window.addEventListener('pointermove', (ev) => {
	if (!dragging) {
		return
	}
	if (document.fullscreenElement === wrapper) {
		return
	}
	moveTo(ev.clientX, ev.clientY)
	wrapper.classList.add('dragging')
})

// Dragging control
wrapper.addEventListener('pointerdown', (ev) => {
	// Primary button only
	if (ev.button !== 0) {
		return
	}
	dragging = true
	dragInitialX = ev.clientX - videoX
	dragInitialY = ev.clientY - videoY

	ev.preventDefault()
})
window.addEventListener('pointerup', () => {
	dragging = false
	wrapper.classList.remove('dragging')
})
