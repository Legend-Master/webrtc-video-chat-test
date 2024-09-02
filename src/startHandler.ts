import { startPeerConnection } from './peerConnectionsManager'
import { setVideoState, welcomeDone } from './selectDevice'

const hiddenAfterCall = document.getElementsByClassName(
	'hidden-after-call'
) as HTMLCollectionOf<HTMLElement>
const shownAfterCall = document.getElementsByClassName(
	'shown-after-call'
) as HTMLCollectionOf<HTMLElement>

const metaTag = document.createElement('meta')
metaTag.name = 'theme-color'
document.head.append(metaTag)

const screenWidthWatch = window.matchMedia('(width > 800px)')
function updateThemeColor() {
	metaTag.content = screenWidthWatch.matches ? 'hsl(0, 0%, 95%)' : 'white'
}
screenWidthWatch.onchange = updateThemeColor
updateThemeColor()

let started = false

async function updateHideStyle() {
	document.documentElement.classList.add('started')
	for (const el of hiddenAfterCall) {
		el.hidden = true
	}
	for (const el of shownAfterCall) {
		el.hidden = false
	}
	screenWidthWatch.onchange = null
	metaTag.content = 'white'
}

export function start() {
	if (started) {
		return
	}
	started = true

	if (document.startViewTransition) {
		document.startViewTransition(updateHideStyle)
	} else {
		updateHideStyle()
	}

	startPeerConnection()
}

async function handleAutoStart() {
	const searchParams = new URLSearchParams(location.search)
	const shouldAutoStart = searchParams.get('auto-start') === 'true'
	if (shouldAutoStart) {
		setVideoState(false)
		await welcomeDone
		start()
	}
}
handleAutoStart()
