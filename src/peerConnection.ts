import {
	ref,
	set,
	onValue,
	push,
	onChildAdded,
	runTransaction,
	onDisconnect,
	DatabaseReference,
	remove,
} from 'firebase/database'
import { db } from './firebaseInit'
import { updateBandwidthRestriction } from './util/sdpInject'
import { room } from './util/room'
import { registerUnsub, unsubscribeAll } from './util/unsubscribeAll'
import { iceServerConfig } from './iceServerData'
import { getUserMedia, onDeviceSelectChange } from './selectDevice'

type PeerType = 'offer' | 'answer'

const OFFER_PLACEHOLDER = ''
const DATA_CHANNEL_ID = 0

let pc: RTCPeerConnection
let peerType: PeerType
let dataChannel: RTCDataChannel

// The one who says "you go first"
// https://developer.mozilla.org/en-US/docs/Web/API/WebRTC_API/Perfect_negotiation
function isPolite() {
	return peerType === 'answer'
}

const stateIndicator = document.getElementById('connection-state-indicator') as HTMLDivElement

const localVideo = document.getElementById('local-video') as HTMLVideoElement
const remoteVideo = document.getElementById('remote-video') as HTMLVideoElement

const refreshVideoButton = document.getElementById('refresh-video') as HTMLButtonElement

function localStreamControl(enable: boolean) {
	return () => {
		const stream = localVideo.srcObject
		if (stream && stream instanceof MediaStream) {
			for (const track of stream.getTracks()) {
				track.enabled = enable
			}
		}
	}
}
localVideo.addEventListener('pause', localStreamControl(false))
localVideo.addEventListener('play', localStreamControl(true))

const STATES = {
	connected: '🟢 Connected',
	connecting: '🟡 Connecting',
	disconnected: '🔴 Disconnected',

	stable: '🟡 Waiting for connection',
	localOffer: '🟡 Waiting for another peer',
	connectedLocalOffer: '🟡 Waiting for another peer for new channel',
	remoteOffer: '🟡 Waiting for connection',
	connectedRemoteOffer: '🟡 Waiting for connection for new channel',
}

function monitorConnectionState(this: RTCPeerConnection) {
	switch (this.connectionState) {
		case 'connected':
			stateIndicator.innerText = STATES.connected
			break
		// case 'new':
		case 'connecting':
			stateIndicator.innerText = STATES.connecting
			break
		case 'failed':
		case 'closed':
		case 'disconnected':
			stateIndicator.innerText = STATES.disconnected
			break
	}
}

function monitoSignalingState(this: RTCPeerConnection) {
	switch (this.signalingState) {
		case 'stable':
			if (this.connectionState === 'connected') {
				stateIndicator.innerText = STATES.connected
			} else {
				stateIndicator.innerText = STATES.stable
			}
			break
		case 'have-local-offer':
			if (this.connectionState === 'connected') {
				stateIndicator.innerText = STATES.connectedLocalOffer
			} else {
				stateIndicator.innerText = STATES.localOffer
			}
			break
		case 'have-remote-offer':
			if (this.connectionState === 'connected') {
				stateIndicator.innerText = STATES.connectedRemoteOffer
			} else {
				stateIndicator.innerText = STATES.remoteOffer
			}
			break
		case 'closed':
			stateIndicator.innerText = STATES.disconnected
			break
	}
}

export async function startPeerConnection() {
	pc = new RTCPeerConnection({ iceServers: iceServerConfig })
	pc.addEventListener('track', onTrack)
	pc.addEventListener('icecandidate', onIceCandidate)
	pc.addEventListener('negotiationneeded', negotiate)
	pc.addEventListener('signalingstatechange', monitoSignalingState)
	pc.addEventListener('connectionstatechange', onConnectionStateChange)
	pc.addEventListener('connectionstatechange', monitorConnectionState)
	await addMedia()
	dataChannel = pc.createDataChannel('renegotiate', {
		negotiated: true,
		id: DATA_CHANNEL_ID,
	})
	dataChannel.addEventListener('message', onDataChannelMessage)
	return pc
}

function onTrack(this: RTCPeerConnection, ev: RTCTrackEvent) {
	if (!remoteVideo.srcObject) {
		remoteVideo.srcObject = new MediaStream()
	}
	;(remoteVideo.srcObject as MediaStream).addTrack(ev.track)
	// Refresh audio control
	remoteVideo.controls = false
	remoteVideo.controls = true
}

let peerIceRef: DatabaseReference
async function onIceCandidate(this: RTCPeerConnection, ev: RTCPeerConnectionIceEvent) {
	if (ev.candidate) {
		const candidateInit = ev.candidate.toJSON()
		if (peerType) {
			await set(push(peerIceRef), candidateInit)
		}
	}
}

function onConnectionStateChange(this: RTCPeerConnection) {
	if (this.connectionState === 'connected') {
		cleanup()
		this.removeEventListener('icecandidate', onIceCandidate)
		this.removeEventListener('connectionstatechange', onConnectionStateChange)
	}
}

/**
 * Generate a new {@link RTCSessionDescriptionInit},
 * Won't mutate the given description (desc)
 */
function processDescription(desc: RTCSessionDescription | RTCSessionDescriptionInit) {
	if (desc instanceof RTCSessionDescription) {
		desc = desc.toJSON()
	} else {
		desc = { ...desc }
	}
	updateSdpInfo(desc)
	return desc
}

function updateSdpInfo(desc: RTCSessionDescriptionInit) {
	desc.sdp = updateBandwidthRestriction(desc.sdp!)
	return desc
}

async function onDataChannelMessage(this: RTCDataChannel, ev: MessageEvent) {
	const desc = JSON.parse(ev.data) as RTCSessionDescriptionInit
	if (desc.type === 'offer' && pc.signalingState === 'have-local-offer') {
		if (isPolite()) {
			await pc.setLocalDescription({ type: 'rollback' })
		} else {
			return
		}
	}
	await pc.setRemoteDescription(desc)
	if (desc.type === 'offer') {
		const desc = await pc.createAnswer()
		await pc.setLocalDescription(desc)
		this.send(JSON.stringify(processDescription(desc)))
	}
}

async function renegotiate() {
	const desc = await pc.createOffer()
	await pc.setLocalDescription(desc)
	dataChannel.send(JSON.stringify(processDescription(desc)))
}

async function cleanup() {
	unsubscribeAll()
	await remove(ref(db, `${room}`))
}

async function addMediaInternal(senders = new Map<string, RTCRtpSender>()) {
	for (const [_, sender] of senders) {
		sender.track?.stop()
	}
	// const newSenders = new Set(senders.keys())
	const stream = await getUserMedia()
	if (!stream) {
		return
	}
	localVideo.srcObject = stream
	for (const track of stream.getTracks()) {
		const sender = senders.get(track.kind)
		if (sender) {
			sender.replaceTrack(track)
			// newSenders.delete(track.kind)
		} else {
			const sender = pc.addTrack(track)
			if (track.kind === 'video') {
				sender.setParameters({
					...sender.getParameters(),
					degradationPreference: 'maintain-resolution',
				})
			}
			senders.set(track.kind, sender)
		}
	}
	// for (const kind of newSenders) {
	// 	pc.removeTrack(senders.get(kind)!)
	// 	senders.delete(kind)
	// }
	return senders
}

async function addMedia() {
	const sneders = await addMediaInternal()
	onDeviceSelectChange(async () => {
		await addMediaInternal(sneders)
	})
	refreshVideoButton.hidden = false
	refreshVideoButton.addEventListener('click', async () => {
		await addMediaInternal(sneders)
	})
}

function setPeerType(peerType_: PeerType) {
	peerType = peerType_
	peerIceRef = ref(db, `${room}/${peerType}/ice`)
}

async function negotiate(this: RTCPeerConnection) {
	// Only renegotiate through p2p data channel
	if (peerType) {
		if (dataChannel.readyState === 'open') {
			renegotiate()
		} else {
			dataChannel.onopen = renegotiate
		}
		return
	}

	await onDisconnect(ref(db, `${room}`)).remove()

	// Get if we're 'offer' or 'answer' side first
	const offerDescRef = ref(db, `${room}/offer/desc`)
	const result = await runTransaction(offerDescRef, (data) => {
		if (!data && data !== OFFER_PLACEHOLDER) {
			// Mark as used, and we're the 'offer' side
			return OFFER_PLACEHOLDER
		}
	})
	setPeerType(result.committed ? 'offer' : 'answer')
	const remotePeerType = result.committed ? 'answer' : 'offer'

	if (peerType === 'offer') {
		const offer = await this.createOffer()
		await this.setLocalDescription(offer)
		await set(offerDescRef, processDescription(offer))
	}

	const remoteDescRef = ref(db, `${room}/${remotePeerType}/desc`)
	registerUnsub(
		onValue(remoteDescRef, async (snapshot) => {
			if (!snapshot.exists()) {
				if (this.remoteDescription) {
					cleanup()
					alert('Another peer disconnected before connection established')
					window.location.reload()
				}
				return
			}
			if (this.remoteDescription) {
				return
			}
			const val = snapshot.val()
			if (val === OFFER_PLACEHOLDER) {
				return
			}

			await this.setRemoteDescription(val)

			if (peerType === 'answer') {
				const answer = await this.createAnswer()
				await this.setLocalDescription(answer)
				await set(ref(db, `${room}/answer/desc`), processDescription(answer))
			}

			registerUnsub(
				onChildAdded(ref(db, `${room}/${remotePeerType}/ice`), async (snapshot) => {
					if (snapshot.exists()) {
						await this.addIceCandidate(snapshot.val())
					}
				})
			)
		})
	)
}
