import { startPeerConnection } from './peerConnectionsManager'
import { setVideoState, welcomeDone } from './selectDevice'

const hiddenAfterCall = document.getElementsByClassName(
	'hidden-after-call'
) as HTMLCollectionOf<HTMLElement>
const shownAfterCall = document.getElementsByClassName(
	'shown-after-call'
) as HTMLCollectionOf<HTMLElement>

async function updateHideStyle() {
    document.documentElement.classList.add('started')
	for (const el of hiddenAfterCall) {
		el.hidden = true
	}
	for (const el of shownAfterCall) {
		el.hidden = false
	}
}

export function start() {
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
