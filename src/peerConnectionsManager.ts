import {
	onChildAdded,
	query,
	ref,
	startAfter,
	endBefore,
	onDisconnect,
	push,
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
import { localVideo, showLocalVideo } from './floatingVideo'
import { db } from './util/firebaseInit'
import { room } from './util/room'

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

	const key = await createUserOnRealtimeDatabase()
	const userPath = `${room}/${key}`
	onChildAdded(query(ref(db, room), startAfter(null, key)), (snapshot) => {
		peerConnections.add(new PeerConnection(`${userPath}/${snapshot.key}`))
	})
	onChildAdded(
		query(ref(db, room), endBefore(null, key)),
		(snapshot) => {
			peerConnections.add(new PeerConnection(`${room}/${snapshot.key}/${key}`))
		},
		{ onlyOnce: true }
	)

	stateIndicator.innerText = '🟡 Waiting for another peer'
	openShareDialog()
}

async function createUserOnRealtimeDatabase() {
	const userIdRef = push(ref(db, room), { online: true })
	await Promise.all([userIdRef, onDisconnect(userIdRef).remove()])
	return userIdRef.key!
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
	localVideo.srcObject = stream
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
	for (const track of stream?.getTracks()) {
		track.stop()
	}
	for (const peerConnection of peerConnections) {
		peerConnection.onStreamStop()
	}
	stream = undefined
}
