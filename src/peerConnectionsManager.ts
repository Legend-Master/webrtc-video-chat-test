import { onChildAdded, query, endBefore, onDisconnect, push, set, child } from 'firebase/database'
import {
	getUserMedia,
	onDeviceSelectChange,
	onVideoStateChange,
	setVideoState,
	videoState,
} from './selectDevice'
import { PeerConnection } from './peerConnection'
import { openShareDialog } from './shareDialog'
import { localVideo, showLocalVideo } from './localVideo'
import { roomRef } from './room'

export const stateIndicator = document.getElementById(
	'connection-state-indicator'
) as HTMLDivElement

export let stream: MediaStream | undefined

export const peerConnections = new Set<PeerConnection>()

export function getActivePeerConnections() {
	let activeConnections = 0
	for (const connection of peerConnections) {
		if (connection.currentConnectionState !== 'disconnected') {
			activeConnections += 1
		}
	}
	return activeConnections
}

export async function startPeerConnection() {
	await startUserMedia()
	onDeviceSelectChange(changeUserMedia)
	onVideoStateChange(changeUserMedia)

	const userIdRef = push(roomRef)
	await onDisconnect(userIdRef).remove()

	// For every user registered before us, send them an offer in their path
	const key = userIdRef.key!
	onChildAdded(
		query(roomRef, endBefore(null, key)),
		(snapshot) => {
			peerConnections.add(new PeerConnection(child(snapshot.ref, `users/${key}`), 'offer'))
		},
		{ onlyOnce: true }
	)
	// Watch for the offers under our path
	await set(userIdRef, { online: true })
	onChildAdded(child(userIdRef, 'users'), (snapshot) => {
		peerConnections.add(new PeerConnection(snapshot.ref, 'answer'))
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
