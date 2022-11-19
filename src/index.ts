import { ref, set, get, onValue, push, onChildAdded, remove, Unsubscribe } from 'firebase/database'
import { db } from './firebaseInit'
import { updateBandwidthRestriction } from './sdpInject'
import { iceServerConfig } from './iceServerData'
import { getUserMedia } from './selectDevice'

const currentIce = document.getElementById('current-ice') as HTMLButtonElement

const localVideo = document.getElementById('local-video') as HTMLVideoElement
const remoteVideo = document.getElementById('remote-video') as HTMLVideoElement

const offerBtn = document.getElementById('offer-button') as HTMLButtonElement
const answerBtn = document.getElementById('answer-button') as HTMLButtonElement

const hiddenAfterCall = document.getElementsByClassName(
	'hidden-after-call'
) as HTMLCollectionOf<HTMLElement>

type PeerType = 'offer' | 'answer'

let unsubscribeIce: Unsubscribe

const searchParams = new URLSearchParams(location.search)
let room = searchParams.get('room')
if (!room) {
	answerBtn.disabled = true
}

function startChat(peerType: PeerType) {
	return async () => {
		for (const el of hiddenAfterCall) {
			el.hidden = true
		}
		currentIce.disabled = true
		if (peerType === 'offer') {
			if (!room) {
				room = push(ref(db)).key
				history.pushState(null, '', `?room=${room}`)
			}
			await createOfferPeer()
		} else {
			await createAnswerPeer()
		}
	}
}
offerBtn.addEventListener('click', startChat('offer'))
answerBtn.addEventListener('click', startChat('answer'))

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

async function registerIceChange(pc: RTCPeerConnection, peerType: PeerType) {
	// const icecandidateData: RTCIceCandidateInit[] = []
	const iceRef = ref(db, `${room}/${peerType}/ice`)
	pc.onicecandidate = async (ev) => {
		if (ev.candidate) {
			await set(push(iceRef), ev.candidate.toJSON())
		}
	}
	await remove(iceRef)
	// pc.addEventListener('icegatheringstatechange', async (ev) => {
	// 	await set(push(iceRef), DONE_SIGNAL)
	// })
}

function registerTrackChange(pc: RTCPeerConnection) {
	pc.addEventListener('track', (ev) => {
		const stream = ev.streams[0]
		if (stream) {
			remoteVideo.srcObject = stream
		}
	})
}

async function createPeerCommon() {
	const pc = new RTCPeerConnection({ iceServers: [iceServerConfig] })
	registerTrackChange(pc)
	await addMedia(pc)
	pc.addEventListener('connectionstatechange', async (ev) => {
		if (pc.connectionState === 'connected') {
			unsubscribeIce()
			pc.onicecandidate = null
			await remove(ref(db, `${room}`))
		}
	})
	return pc
}

async function createOfferPeer() {
	const pc = await createPeerCommon()
	registerIceChange(pc, 'offer')

	const offerDesc = await pc.createOffer()
	await pc.setLocalDescription(offerDesc)
	offerDesc.sdp = updateBandwidthRestriction(offerDesc.sdp!)

	await remove(ref(db, `${room}`))
	await set(ref(db, `${room}/offer/desc`), JSON.stringify(offerDesc))
	const answerDescRef = ref(db, `${room}/answer/desc`)
	const unsubscribe = onValue(answerDescRef, async (snapshot) => {
		if (snapshot.exists()) {
			unsubscribe()
			await pc.setRemoteDescription(JSON.parse(snapshot.val()))
			const iceRef = ref(db, `${room}/answer/ice`)
			unsubscribeIce = onChildAdded(iceRef, async (snapshot) => {
				if (snapshot.exists()) {
					await pc.addIceCandidate(snapshot.val())
				}
			})
			await remove(answerDescRef)
		}
	})
}

async function createAnswerPeer() {
	const pc = await createPeerCommon()
	registerIceChange(pc, 'answer')

	const offerDescRef = ref(db, `${room}/offer/desc`)
	const snapshot = await get(offerDescRef)
	await pc.setRemoteDescription(JSON.parse(snapshot.val()))
	const answerDesc = await pc.createAnswer()
	await pc.setLocalDescription(answerDesc)
	answerDesc.sdp = updateBandwidthRestriction(answerDesc.sdp!)

	await set(ref(db, `${room}/answer/desc`), JSON.stringify(answerDesc))
	const iceRef = ref(db, `${room}/offer/ice`)
	unsubscribeIce = onChildAdded(iceRef, async (snapshot) => {
		if (snapshot.exists()) {
			await pc.addIceCandidate(snapshot.val())
		}
	})
	await remove(offerDescRef)
}

async function addMedia(pc: RTCPeerConnection) {
	const stream = await getUserMedia()
	localVideo.srcObject = stream
	for (const track of stream.getTracks()) {
		const sender = pc.addTrack(track, stream)
		sender.setParameters({
			...sender.getParameters(),
			degradationPreference: 'maintain-resolution',
		})
	}
}
