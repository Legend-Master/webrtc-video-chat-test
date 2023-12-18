import { createIconButton } from '../styleHelper/iconButton'
import { setLastFocusVideo } from '../keyBoardControls'

import mdiFullscreen from 'iconify-icon:mdi/fullscreen'
import mdiFullscreenExit from 'iconify-icon:mdi/fullscreen-exit'
import mdiPip from 'iconify-icon:mdi/picture-in-picture-bottom-right'
import mdiVolumeOn from 'iconify-icon:mdi/volume'
import mdiVolumeOff from 'iconify-icon:mdi/volume-off'

import './custom-video.css'

export class CustomVideo extends HTMLElement {
	protected video!: HTMLVideoElement
	private controlsWrapper!: HTMLDivElement
	private fullscreenButton!: HTMLButtonElement
	private pipButton?: HTMLButtonElement
	protected audioControls!: HTMLDivElement
	private audioSlider!: HTMLInputElement
	private audioButton!: HTMLButtonElement
	private cachedVolume!: number

	private hideControlsTimeout?: number
	private keyboardFocusedControl = false
	private controlsHovered = false
	private videoStarted = false
	private hasKeyboardEvent = false

	constructor() {
		super()
	}

	connectedCallback() {
		this.classList.add('custom-video')

		this.tabIndex = 0
		this.addEventListener('keydown', () => setLastFocusVideo(this))
		this.setVideoStarted(false)

		this.video = document.createElement('video')
		this.video.autoplay = true
		// this.video.muted = true
		this.video.playsInline = true
		this.video.addEventListener('loadeddata', () => this.setVideoStarted(true))
		this.video.addEventListener('dblclick', this.toggleFullscreen)

		this.controlsWrapper = document.createElement('div')
		this.controlsWrapper.classList.add('controls-wrapper')
		this.classList.add('hide-controls')

		const leftControls = document.createElement('div')
		leftControls.classList.add('left-controls')

		const rightControls = document.createElement('div')
		rightControls.classList.add('right-controls')

		this.fullscreenButton = createIconButton(mdiFullscreen)
		this.fullscreenButton.title = 'Full screen'
		this.fullscreenButton.addEventListener('click', this.toggleFullscreen)
		this.addEventListener('fullscreenchange', this.updateFullscreenStyle)
		rightControls.append(this.fullscreenButton)

		// Firefox and Android Webview (kinda irrelevant) doesn't support PiP API yet
		if (typeof this.video.requestPictureInPicture === 'function') {
			this.pipButton = createIconButton(mdiPip)
			this.pipButton.title = 'Enter picture-in-picture'
			this.pipButton.addEventListener('click', this.togglePictureInPicture)
			this.video.addEventListener('enterpictureinpicture', () => {
				this.classList.add('picture-in-picture')
				this.pipButton!.title = 'Exit picture-in-picture'
			})
			this.video.addEventListener('leavepictureinpicture', () => {
				this.classList.remove('picture-in-picture')
				this.pipButton!.title = 'Enter picture-in-picture'
			})
			rightControls.append(this.pipButton)
		}

		this.cachedVolume = this.video.volume
		const isMuted = () => this.video.volume === 0
		const onVolumeChange = () => {
			this.audioSlider.value = String(this.video.volume * 100)
			this.audioSlider.title = `Volume: ${this.audioSlider.value}`
			this.audioSlider.style.setProperty('--progress', `${this.audioSlider.value}%`)

			this.audioButton.innerHTML = isMuted() ? mdiVolumeOff : mdiVolumeOn
			this.audioButton.title = isMuted() ? 'Unmute' : 'Mute'

			if (!isMuted()) {
				this.cachedVolume = this.video.volume
			}
		}

		this.audioControls = document.createElement('div')
		this.audioControls.classList.add('audio-controls')

		this.audioButton = createIconButton(mdiVolumeOn)
		this.audioButton.disabled = true
		this.audioButton.classList.add('audio-button')
		this.audioButton.addEventListener('click', () => {
			this.video.volume = isMuted() ? this.cachedVolume : 0
		})

		this.audioSlider = document.createElement('input')
		this.audioSlider.disabled = true
		this.audioSlider.type = 'range'
		this.audioSlider.min = '0'
		this.audioSlider.max = '100'
		this.audioSlider.classList.add('audio-slider')
		this.audioSlider.addEventListener('input', () => {
			this.video.volume = Number(this.audioSlider.value) / 100
		})

		this.video.addEventListener('volumechange', onVolumeChange)
		onVolumeChange()

		this.audioControls.append(this.audioButton)
		this.audioControls.append(this.audioSlider)

		leftControls.append(this.audioControls)

		this.controlsWrapper.append(leftControls)
		this.controlsWrapper.append(rightControls)

		this.append(this.controlsWrapper)
		this.append(this.video)

		this.handleShowHideControls()
	}

	disconnectedCallback() {
		window.removeEventListener('pointerdown', this.onPointerDown)
		window.removeEventListener('keydown', this.onKeyDown)
	}

	getVideoSrcObject() {
		return this.video.srcObject instanceof MediaStream ? this.video.srcObject : undefined
	}

	setVideoSrcObject(mediaStream: MediaStream) {
		this.video.srcObject = mediaStream
	}

	onTrackChange = () => {
		const srcObject = this.getVideoSrcObject()
		if (!srcObject) {
			return
		}
		const hasAudio = srcObject.getAudioTracks().length > 0
		if (hasAudio) {
			this.audioButton.disabled = false
			this.audioSlider.disabled = false
			this.video.volume = this.cachedVolume
		} else {
			this.audioButton.disabled = true
			this.audioSlider.disabled = true
			this.video.volume = 0
		}
	}

	private isPictureInPicture = () => {
		return document.pictureInPictureElement === this.video
	}

	togglePictureInPicture = async () => {
		try {
			if (this.isPictureInPicture()) {
				await document.exitPictureInPicture()
			} else {
				await this.video.requestPictureInPicture()
				if (this.isFullscreen()) {
					await document.exitFullscreen()
				}
			}
		} catch {}
	}

	//#region fullscreen control
	toggleFullscreen = async () => {
		if (this.isFullscreen()) {
			await document.exitFullscreen()
		} else {
			// Clear picture in picture
			if (this.isPictureInPicture()) {
				try {
					await document.exitPictureInPicture()
				} catch {}
			}
			// Clear other fullscreen elements
			// There can be stacking fullscreen elements (why???)
			if (document.fullscreenElement) {
				await document.exitFullscreen()
			}
			await this.requestFullscreen()
			await this.fullscreenAutoRotate()
		}
	}

	protected isFullscreen = () => {
		return document.fullscreenElement === this
	}

	private updateFullscreenStyle = () => {
		if (this.isFullscreen()) {
			this.fullscreenButton.innerHTML = mdiFullscreenExit
			this.fullscreenButton.title = 'Exit full screen'
			this.classList.add('fullscreen')
		} else {
			this.fullscreenButton.innerHTML = mdiFullscreen
			this.fullscreenButton.title = 'Full screen'
			this.classList.remove('fullscreen')
			try {
				screen.orientation.unlock()
			} catch {}
		}
		// updatePosition()
	}

	// This API is on Chrome Android only
	private fullscreenAutoRotate = async () => {
		if (!screen.orientation.lock) {
			return
		}
		try {
			if (this.video.videoWidth < this.video.videoHeight) {
				await screen.orientation.lock('portrait')
			} else {
				await screen.orientation.lock('landscape')
			}
		} catch {}
		// Throw expected on Chrome desktop
	}
	//#endregion

	//#region show/hide controls
	private handleShowHideControls() {
		this.addEventListener('pointerenter', (ev) => {
			// We handle touch screens in pointerup
			if (ev.pointerType !== 'mouse') {
				return
			}
			clearTimeout(this.hideControlsTimeout)
			this.showControls()
		})

		this.addEventListener('pointerleave', (ev) => {
			// We handle touch screens in pointerup
			if (ev.pointerType !== 'mouse') {
				return
			}
			if (this.isFullscreen()) {
				return
			}
			clearTimeout(this.hideControlsTimeout)
			this.hideControls()
		})

		this.addEventListener('pointermove', (ev) => {
			// We handle touch screens in pointerup
			if (ev.pointerType !== 'mouse') {
				return
			}
			this.outOfIdle()
		})

		let resetPointerEventTimeout: number | undefined
		this.addEventListener('pointerup', (ev) => {
			// Handle touch screen only
			if (ev.pointerType === 'mouse') {
				return
			}
			if (this.shouldIgnoreTouchScreenPointerUp()) {
				return
			}
			if (this.isControlsHidden()) {
				// Delay a bit for touch screen to not instantly click on control buttons (e.g. fullscreen button)
				this.controlsWrapper.style.pointerEvents = 'none'
				clearTimeout(resetPointerEventTimeout)
				resetPointerEventTimeout = setTimeout(() => {
					this.controlsWrapper.style.pointerEvents = ''
				}, 100)
				this.outOfIdle()
			} else {
				// Tap again to hide controls faster
				if (this.controlsHovered) {
					this.refreshHideOnIdle()
				} else {
					this.hideControls()
				}
			}
		})

		this.controlsWrapper.addEventListener('pointerenter', () => {
			this.controlsHovered = true
		})

		this.controlsWrapper.addEventListener('pointerleave', () => {
			this.controlsHovered = false
		})

		// Don't know any better way to detect if it's from a tab or click
		// Inspired by https://github.com/WICG/focus-visible

		this.controlsWrapper.addEventListener('focusin', (ev) => {
			if (!this.hasKeyboardEvent) {
				return
			}
			this.keyboardFocusedControl = true
			this.showControls()
		})

		this.controlsWrapper.addEventListener('focusout', (ev) => {
			if (!this.keyboardFocusedControl) {
				return
			}
			this.keyboardFocusedControl = false
			this.hideControls()
		})

		window.addEventListener('pointerdown', this.onPointerDown)
		window.addEventListener('keydown', this.onKeyDown)
	}

	protected shouldIgnoreTouchScreenPointerUp() {
		return false
	}

	private onPointerDown = (ev: PointerEvent) => {
		this.hasKeyboardEvent = false
	}

	private onKeyDown = (ev: KeyboardEvent) => {
		if (ev.metaKey || ev.altKey || ev.ctrlKey) {
			return
		}
		this.hasKeyboardEvent = true
	}

	private showControls = () => {
		this.classList.remove('hide-controls')
	}

	protected hideControls() {
		if (this.keyboardFocusedControl || this.controlsHovered) {
			return
		}
		clearTimeout(this.hideControlsTimeout)
		this.classList.add('hide-controls')
	}

	private isControlsHidden = () => {
		return this.classList.contains('hide-controls')
	}

	protected refreshHideOnIdle = () => {
		clearTimeout(this.hideControlsTimeout)
		this.hideControlsTimeout = setTimeout(() => this.hideControls(), 2000)
	}

	private outOfIdle = () => {
		this.showControls()
		this.refreshHideOnIdle()
	}
	//#endregion

	private setVideoStarted = (started: boolean) => {
		this.videoStarted = started
		if (started) {
			this.classList.add('started')
			this.inert = false
		} else {
			this.classList.remove('started')
			this.inert = true
		}
	}
}
customElements.define('custom-video', CustomVideo)
declare global {
	interface HTMLElementTagNameMap {
		'custom-video': CustomVideo
	}
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
