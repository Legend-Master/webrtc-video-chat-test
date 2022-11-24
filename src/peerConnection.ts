import {
	ref,
	set,
	onValue,
	push,
	onChildAdded,
	runTransaction,
	onDisconnect,
	DatabaseReference,
	Unsubscribe,
	remove,
} from 'firebase/database'
import { db } from './firebaseInit'
import { updateBandwidthRestriction } from './util/sdpInject'
import { iceServerConfig } from './iceServerData'
import { getUserMedia, onDeviceSelectChange } from './selectDevice'
import { room } from './room'
import { registerUnsub, unsubscribeAll } from './unsubscribeAll'

type PeerType = 'offer' | 'answer'

const DATA_CHANNEL_ID = 0

let pc: RTCPeerConnection
let peerType: PeerType
let dataChannel: RTCDataChannel

// The one who says "you go first"
// https://developer.mozilla.org/en-US/docs/Web/API/WebRTC_API/Perfect_negotiation
function isPolite() {
	return peerType === 'answer'
}

let unsubscribeIce: Unsubscribe

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

export async function startPeerConnection() {
	pc = new RTCPeerConnection({ iceServers: [iceServerConfig] })
	pc.addEventListener('track', onTrack)
	pc.addEventListener('icecandidate', onIceCandidate)
	pc.addEventListener('negotiationneeded', negotiate)
	pc.addEventListener('connectionstatechange', onConnectionStateChange)
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

// Cache ice candidates before we figure out if we're offer or answer side
let peerIceRef: DatabaseReference
let iceCandidates: RTCIceCandidateInit[] = []
async function onIceCandidate(this: RTCPeerConnection, ev: RTCPeerConnectionIceEvent) {
	if (ev.candidate) {
		const candidateInit = ev.candidate.toJSON()
		if (peerType) {
			await set(push(peerIceRef), candidateInit)
		} else {
			iceCandidates.push(candidateInit)
		}
	}
}

function onConnectionStateChange(this: RTCPeerConnection) {
	if (this.connectionState === 'connected') {
		cleanup()
		unsubscribeIce()
		this.removeEventListener('icecandidate', onIceCandidate)
		this.removeEventListener('connectionstatechange', onConnectionStateChange)
	}
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
		const desc = (await pc.createAnswer()) as RTCSessionDescription
		await pc.setLocalDescription(desc)
		this.send(JSON.stringify(updateSdpInfo(desc.toJSON())))
	}
}

async function renegotiate() {
	const desc = (await pc.createOffer()) as RTCSessionDescription
	await pc.setLocalDescription(desc)
	dataChannel.send(JSON.stringify(updateSdpInfo(desc.toJSON())))
}

function cleanup() {
	unsubscribeAll()
	remove(ref(db, `${room}`))
}

async function addMediaInternal(senders = new Map<string, RTCRtpSender>()) {
	for (const [_, sender] of senders) {
		sender.track?.stop()
	}
	// const newSenders = new Set(senders.keys())
	const stream = await getUserMedia()
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
	refreshVideoButton.addEventListener('click', async () => {
		await addMediaInternal(sneders)
	})
}

function setPeerType(peerType_: PeerType) {
	peerType = peerType_
	peerIceRef = ref(db, `${room}/${peerType}/ice`)
	for (const candidateInit of iceCandidates) {
		// Don't have to await
		set(push(peerIceRef), candidateInit)
	}
}

async function negotiate(this: RTCPeerConnection) {
	if (dataChannel.readyState === 'open') {
		renegotiate()
		return
	}

	await onDisconnect(ref(db, `${room}`)).remove()

	const offer = (await this.createOffer()) as RTCSessionDescription
	await this.setLocalDescription(offer)

	let remoteDesc: RTCSessionDescriptionInit
	const result = await runTransaction(ref(db, `${room}/offer/desc`), (data) => {
		if (data) {
			remoteDesc = data
		} else {
			return updateSdpInfo(offer.toJSON())
		}
	})

	setPeerType(result.committed ? 'offer' : 'answer')

	if (result.committed) {
		// Offer side
		const answerDescRef = ref(db, `${room}/answer/desc`)
		registerUnsub(
			onValue(answerDescRef, async (snapshot) => {
				if (!snapshot.exists()) {
					return
				}
				await this.setRemoteDescription(snapshot.val())
				const iceRef = ref(db, `${room}/answer/ice`)
				unsubscribeIce = registerUnsub(
					onChildAdded(iceRef, async (snapshot) => {
						if (snapshot.exists()) {
							await this.addIceCandidate(snapshot.val())
						}
					})
				)
			})
		)
	} else {
		// Anwser side
		// await this.setLocalDescription({ type: 'rollback' })
		await this.setRemoteDescription(remoteDesc!)
		const answer = (await this.createAnswer()) as RTCSessionDescription
		await this.setLocalDescription(answer)
		await set(ref(db, `${room}/answer/desc`), updateSdpInfo(answer.toJSON()))
		unsubscribeIce = registerUnsub(
			onChildAdded(ref(db, `${room}/offer/ice`), async (snapshot) => {
				if (snapshot.exists()) {
					await this.addIceCandidate(snapshot.val())
				}
			})
		)
	}
}
