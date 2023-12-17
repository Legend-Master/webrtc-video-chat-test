import { CustomVideo } from './custom-video'

import './floating-video.css'

// Temp fix for Chrome 117-121 to prevent crashing on reload
// https://crbug.com/1508254
const styleTag = document.createElement('style')
styleTag.innerText = `
/* Chrome only, progressive enhancement */
@starting-style {
	floating-video .controls-wrapper {
		opacity: 0;
	}
}
`
document.head.append(styleTag)

type StashSide = 'left' | 'right'

function clamp(num: number, min: number, max: number) {
	return Math.min(max, Math.max(min, num))
}

export class FloatingVideo extends CustomVideo {
	private pointerDown = false
	private videoX = -20
	private videoY = 20

	private dragInitialX = 0
	private dragInitialY = 0

	private edgeHeight = 100

	// Cache size on drag, not perfect, but good enough
	private originalWidth?: number
	private originalHeight?: number

	private stashed?: StashSide
	private stashSnapRange!: number
	private dragging = false
	private screenWidthQuery = window.matchMedia('(max-width: 500px)')

	constructor() {
		super()
	}

	connectedCallback() {
		super.connectedCallback()

		this.classList.add('floating-video')
		this.video.muted = true
		this.audioControls.hidden = true

		const stashDecor = document.createElement('div')
		stashDecor.classList.add('stash-decor')
		this.append(stashDecor)

		window.addEventListener('pointermove', this.onPointerMove)
		this.addEventListener('pointerdown', this.onDraggingPointerDown)
		window.addEventListener('pointerup', this.onDraggingPointerUp)

		this.screenWidthQuery.addEventListener('change', this.updateStashSnapRange)
		this.updateStashSnapRange()

		this.updatePosition()
		window.addEventListener('resize', this.onResize)
	}

	disconnectedCallback() {
		super.disconnectedCallback()

		window.removeEventListener('resize', this.onResize)
		window.removeEventListener('pointermove', this.onPointerMove)
		this.removeEventListener('pointerdown', this.onDraggingPointerDown)
		window.removeEventListener('pointerup', this.onDraggingPointerUp)
		this.screenWidthQuery.removeEventListener('change', this.updateStashSnapRange)
		window.removeEventListener('resize', this.onResize)
	}

	private onPointerMove = (ev: PointerEvent) => {
		if (!this.pointerDown) {
			return
		}
		if (document.fullscreenElement === this) {
			return
		}
		// How???
		if (ev.movementX === 0 && ev.movementY === 0) {
			return
		}

		if (!this.dragging) {
			this.dragging = true
			this.classList.add('dragging')

			if (!this.stashed) {
				const { width, height } = this.getBoundingClientRect()
				this.originalWidth = width
				this.originalHeight = height
			}
		}

		this.moveTo(ev.clientX, ev.clientY)
	}

	private onDraggingPointerDown = (ev: PointerEvent) => {
		// Primary button only
		if (!ev.isPrimary) {
			return
		}

		this.pointerDown = true
		this.dragInitialX = ev.clientX - this.videoX
		this.dragInitialY = ev.clientY - this.videoY

		ev.preventDefault()
	}

	private onDraggingPointerUp = () => {
		if (!this.pointerDown) {
			return
		}

		this.pointerDown = false

		if (this.dragging) {
			this.dragging = false
			this.classList.remove('dragging')
			this.refreshHideOnIdle()
		}
	}

	private onResize = () => {
		this.updatePosition()
	}

	private updateStashSnapRange = () => {
		this.stashSnapRange = this.screenWidthQuery.matches ? 70 : 100
	}

	// 0, 0 is top right
	private updatePosition(userMove = false): void {
		if (this.isFullscreen()) {
			return
		}
		if (!this.hidden) {
			let width: number
			let height: number
			if (this.originalWidth && this.originalHeight) {
				width = this.originalWidth
				height = this.originalHeight
			} else {
				const rect = this.getBoundingClientRect()
				width = rect.width
				height = rect.height
			}
			// Use document.body.clientWidth instead of innerWidth for counting scrollbar width
			const leftSnapLimit = -document.body.clientWidth + this.stashSnapRange
			const rightSnapLimit = width - this.stashSnapRange
			if (userMove) {
				if (this.videoX <= leftSnapLimit) {
					this.stash('left')
				} else if (this.videoX >= rightSnapLimit) {
					this.stash('right')
				} else {
					this.unStash()
				}
			} else {
				if (this.stashed) {
					this.videoX = this.stashed === 'left' ? leftSnapLimit : rightSnapLimit
				}
			}
			this.videoX = clamp(this.videoX, leftSnapLimit, rightSnapLimit)
			this.videoY = clamp(this.videoY, -height + this.edgeHeight, innerHeight - this.edgeHeight)
		}
		this.style.setProperty('--translate', `${this.videoX}px ${this.videoY}px`)
	}

	private stash(side: StashSide) {
		if (this.stashed) {
			return
		}
		this.video.pause()
		this.classList.add('stash')
		this.stashed = side
	}

	private unStash() {
		if (!this.stashed) {
			return
		}
		this.video.play()
		this.classList.remove('stash')
		this.stashed = undefined
	}

	private moveTo(x: number, y: number) {
		this.videoX = x - this.dragInitialX
		this.videoY = y - this.dragInitialY
		this.updatePosition(true)
	}

	protected hideControls() {
		if (this.dragging) {
			return
		}
		return super.hideControls()
	}

	protected shouldIgnoreTouchScreenPointerUp() {
		return this.dragging
	}
}
customElements.define('floating-video', FloatingVideo)
declare global {
	interface HTMLElementTagNameMap {
		'floating-video': FloatingVideo
	}
}
