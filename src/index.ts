import { ref, set, get, onValue, push, onChildAdded, remove, Unsubscribe } from 'firebase/database'
import { db } from './firebaseInit'

const video = document.getElementById('remote-video') as HTMLVideoElement

const iceSettingDiv = document.getElementById('ice-setting-div') as HTMLDivElement
const currentIce = document.getElementById('current-ice') as HTMLHeadingElement
const iceUrl = document.getElementById('ice-url') as HTMLInputElement
const iceUsername = document.getElementById('ice-username') as HTMLInputElement
const icePassword = document.getElementById('ice-password') as HTMLInputElement
const iceSet = document.getElementById('ice-set') as HTMLButtonElement
const iceReset = document.getElementById('ice-reset') as HTMLButtonElement

const pcControlDiv = document.getElementById('pc-control-div') as HTMLDivElement
const offerBtn = document.getElementById('offer-button') as HTMLButtonElement
const answerBtn = document.getElementById('answer-button') as HTMLButtonElement

type PeerType = 'offer' | 'answer'

let unsubscribeIce: Unsubscribe

const serverSaveKey = 'ice-server-data'
let iceServerConfig: RTCIceServer
setServerData(readServerData() || getDefaultServerData())

const searchParams = new URLSearchParams(location.search)
let room = searchParams.get('room')
if (!room) {
	answerBtn.disabled = true
}

iceSet.addEventListener('click', async (ev) => {
	if (!iceUrl.value) {
		return
	}
	setServerData({
		urls: iceUrl.value.trim(),
		username: iceUsername.value.trim(),
		credential: icePassword.value.trim(),
	})
	saveServerData()
	iceUrl.value = ''
	iceUsername.value = ''
	icePassword.value = ''
})
iceReset.addEventListener('click', async (ev) => {
	resetServerData()
})

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

async function registerIceChange(pc: RTCPeerConnection, peerType: PeerType) {
	// const icecandidateData: RTCIceCandidateInit[] = []
	const iceRef = ref(db, `${room}/${peerType}/ice`)
	await remove(iceRef)
	pc.onicecandidate = async (ev) => {
		if (ev.candidate) {
			await set(push(iceRef), ev.candidate.toJSON())
		}
	}
	// pc.addEventListener('icegatheringstatechange', async (ev) => {
	// 	await set(push(iceRef), DONE_SIGNAL)
	// })
}

function registerTrackChange(pc: RTCPeerConnection) {
	pc.addEventListener('track', (ev) => {
		if (ev.streams[0]) {
			video.srcObject = ev.streams[0]
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

	await set(ref(db, `${room}/offer/desc`), JSON.stringify(offerDesc))
	const answerDescRef = ref(db, `${room}/answer/desc`)
	const unsubscribe = onValue(answerDescRef, async (snapshot) => {
		if (snapshot.exists()) {
			unsubscribe()
			await pc.setRemoteDescription(JSON.parse(snapshot.val()))
			await remove(answerDescRef)
			const iceRef = ref(db, `${room}/answer/ice`)
			unsubscribeIce = onChildAdded(iceRef, async (snapshot) => {
				if (snapshot.exists()) {
					await pc.addIceCandidate(snapshot.val())
				}
			})
		}
	})
}

async function createAnswerPeer() {
	const pc = await createPeerCommon()
	registerIceChange(pc, 'answer')

	const offerDescRef = ref(db, `${room}/offer/desc`)
	const snapshot = await get(offerDescRef)
	await pc.setRemoteDescription(JSON.parse(snapshot.val()))
	await remove(offerDescRef)
	const answerDesc = await pc.createAnswer()
	await pc.setLocalDescription(answerDesc)

	await set(ref(db, `${room}/answer/desc`), JSON.stringify(answerDesc))
	const iceRef = ref(db, `${room}/offer/ice`)
	unsubscribeIce = onChildAdded(iceRef, async (snapshot) => {
		if (snapshot.exists()) {
			await pc.addIceCandidate(snapshot.val())
		}
	})
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

	for (const track of stream.getTracks()) {
		pc.addTrack(track, stream)
	}
}

function getDefaultServerData() {
	return {
		urls: 'stun:stun.l.google.com:19302',
	}
}

function setServerData(data: RTCIceServer) {
	iceServerConfig = data
	currentIce.innerText = iceServerConfig.username
		? `${iceServerConfig.urls} [${iceServerConfig.username}:${iceServerConfig.credential}]`
		: `${iceServerConfig.urls}`
}

function saveServerData() {
	localStorage.setItem(serverSaveKey, JSON.stringify(iceServerConfig))
}

function readServerData(): RTCIceServer | undefined {
	const data = localStorage.getItem(serverSaveKey)
	if (data) {
		return JSON.parse(data)
	}
}

function resetServerData() {
	setServerData(getDefaultServerData())
	localStorage.removeItem(serverSaveKey)
}
