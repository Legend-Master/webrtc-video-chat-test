import { ref, set, get, onValue, push, onChildAdded, remove, Unsubscribe } from 'firebase/database'
import { db } from './firebaseInit'
import { updateBandwidthRestriction } from './sdpInject'
import { iceServerConfig } from './iceServerData'

const localVideo = document.getElementById('local-video') as HTMLVideoElement
const remoteVideo = document.getElementById('remote-video') as HTMLVideoElement

const iceSettingDiv = document.getElementById('ice-setting-div') as HTMLDivElement

const pcControlDiv = document.getElementById('pc-control-div') as HTMLDivElement
const offerBtn = document.getElementById('offer-button') as HTMLButtonElement
const answerBtn = document.getElementById('answer-button') as HTMLButtonElement

type PeerType = 'offer' | 'answer'

let unsubscribeIce: Unsubscribe

const searchParams = new URLSearchParams(location.search)
let room = searchParams.get('room')
if (!room) {
	answerBtn.disabled = true
}

offerBtn.addEventListener('click', async (ev) => {
	pcControlDiv.hidden = true
	iceSettingDiv.hidden = true
	if (!room) {
		room = push(ref(db)).key
		history.pushState(null, '', `?room=${room}`)
	}
	await createOfferPeer()
})
answerBtn.addEventListener('click', async (ev) => {
	pcControlDiv.hidden = true
	iceSettingDiv.hidden = true
	await createAnswerPeer()
})

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
	const stream = await navigator.mediaDevices.getUserMedia({
		video: {
			frameRate: {
				ideal: 60,
			},
			width: {
				ideal: 1920,
			},
			height: {
				ideal: 1080,
			},
		},
		// audio: true,
	})
	localVideo.srcObject = stream
	for (const track of stream.getTracks()) {
		pc.addTrack(track, stream)
	}
}
