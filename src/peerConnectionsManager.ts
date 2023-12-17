import {
	onChildAdded,
	query,
	ref,
	endBefore,
	onDisconnect,
	push,
	set,
} from 'firebase/database'
import {
	getUserMedia,
	onDeviceSelectChange,
	onVideoStateChange,
	setVideoState,
	videoState,
} from './selectDevice'
import { PeerConnection } from './peerConnection'
import { openShareDialog } from './shareDialog'
import { localVideo, showLocalVideo } from './custom-elements/floating-video'
import { db } from './util/firebaseInit'
import { room } from './room'

export const stateIndicator = document.getElementById(
	'connection-state-indicator'
) as HTMLDivElement

export let stream: MediaStream | undefined

export const peerConnections = new Set<PeerConnection>()

export function getActivePeerConnections() {
	return peerConnections.size
}

export async function startPeerConnection() {
	await startUserMedia()
	onDeviceSelectChange(changeUserMedia)
	onVideoStateChange(changeUserMedia)

	const userIdRef = push(ref(db, room))
	await onDisconnect(userIdRef).remove()

	const key = userIdRef.key!
	const userPath = `${room}/${key}`
	onChildAdded(
		query(ref(db, room), endBefore(null, key)),
		(snapshot) => {
			peerConnections.add(new PeerConnection(`${room}/${snapshot.key}/users/${key}`, 'offer'))
		},
		{ onlyOnce: true }
	)
	await set(userIdRef, { online: true })
	const incomingUsersPath = `${userPath}/users`
	onChildAdded(ref(db, incomingUsersPath), (snapshot) => {
		peerConnections.add(new PeerConnection(`${incomingUsersPath}/${snapshot.key}`, 'answer'))
	})

	stateIndicator.innerText = '🟡 Waiting for another peer'
	openShareDialog()
}

async function changeUserMedia() {
	stopUserMedia()
	await startUserMedia()
}

async function startUserMedia() {
	if (!videoState) {
		return
	}
	stream = await getUserMedia()
	if (!stream) {
		setVideoState(false)
		return
	}
	// const videoTrack = stream.getVideoTracks()[0]!
	// console.log(videoTrack.getSettings())
	// console.log(videoTrack.getCapabilities())
	// console.log(videoTrack.getConstraints())
	localVideo.setVideoSrcObject(stream)
	showLocalVideo()

	const firstTrack = stream.getTracks()[0]
	if (firstTrack) {
		firstTrack.addEventListener('ended', () => setVideoState(false), { once: true })
	}

	const promises = []
	for (const peerConnection of peerConnections) {
		promises.push(peerConnection.onNewStream())
	}
	await Promise.all(promises)
}

function stopUserMedia() {
	if (!stream) {
		return
	}
	for (const track of stream.getTracks()) {
		track.stop()
	}
	for (const peerConnection of peerConnections) {
		peerConnection.onStreamStop()
	}
	stream = undefined
}
