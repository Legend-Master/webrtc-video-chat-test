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
localVideo.addEventListener('dblclick', toggleFullscreen)
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

let dragging = false
let videoX = 0
let videoY = 0
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
	clearTimeout(hideControlsTimeout)
	hideControls()
})

wrapper.addEventListener('pointermove', () => {
	outOfIdle()
})

function onPointerMove(ev: PointerEvent) {
	if (document.fullscreenElement === wrapper) {
		return
	}
	videoX += ev.movementX
	videoY += ev.movementY
	wrapper.style.translate = `${videoX}px ${videoY}px`

	// ev.preventDefault()
}

// Dragging control
wrapper.addEventListener('pointerdown', (ev) => {
	// if (localVideo.controls) {
	// 	return
	// }

	dragging = true
	window.removeEventListener('pointermove', onPointerMove)
	window.addEventListener('pointermove', onPointerMove)

	// ev.preventDefault()
})
window.addEventListener('pointerup', () => {
	dragging = false
	window.removeEventListener('pointermove', onPointerMove)
})
