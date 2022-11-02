import { ref, set, get, onValue, push, onChildAdded } from 'firebase/database'
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

const serverSaveKey = 'ice-server-data'
let iceServerConfig: RTCIceServer
setServerData(readServerData() || getDefaultServerData())

let pc: RTCPeerConnection

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
})
iceReset.addEventListener('click', async (ev) => {
	resetServerData()
})

offerBtn.addEventListener('click', async (ev) => {
	pcControlDiv.hidden = true
	iceSettingDiv.hidden = true
	if (!room) {
		room = push(ref(db)).key
		history.replaceState(null, '', `?room=${room}`)
	}
	await createOfferPeer()
})
answerBtn.addEventListener('click', async (ev) => {
	pcControlDiv.hidden = true
	iceSettingDiv.hidden = true
	await createAnswerPeer()
})

function registerIceChange(peerType: PeerType) {
	// const icecandidateData: RTCIceCandidateInit[] = []
	pc.addEventListener('icecandidate', async (ev) => {
		if (ev.candidate) {
			// console.log(ev.candidate.candidate)
			// icecandidateData.push(ev.candidate.toJSON())
			await set(push(ref(db, `${room}/${peerType}/ice`)), ev.candidate.toJSON())
		}
	})
	// pc.addEventListener('icegatheringstatechange', (ev) => {
	// 	if (pc.iceGatheringState === 'complete') {
	// 		iceOutEl.innerText = JSON.stringify(icecandidateData)
	// 	}
	// 	iceGatherState.innerText = ` (${pc.iceGatheringState})`
	// })
}

function registerTrackChange() {
	pc.addEventListener('track', (ev) => {
		if (ev.streams[0]) {
			video.srcObject = ev.streams[0]
		}
	})
}

async function createOfferPeer() {
	pc = new RTCPeerConnection({ iceServers: [iceServerConfig] })
	registerIceChange('offer')
	registerTrackChange()
	await addMedia()
	const offerDesc = await pc.createOffer()
	await pc.setLocalDescription(offerDesc)
	await set(ref(db, `${room}/offer/desc`), JSON.stringify(offerDesc))
	onChildAdded(ref(db, `${room}/answer/ice`), async (snapshot) => {
		if (snapshot.exists()) {
			await pc.addIceCandidate(snapshot.val())
		}
	})
	onValue(ref(db, `${room}/answer/desc`), async (snapshot) => {
		if (snapshot.exists()) {
			await pc.setRemoteDescription(JSON.parse(snapshot.val()))
		}
	})
}

async function createAnswerPeer() {
	pc = new RTCPeerConnection({ iceServers: [iceServerConfig] })
	registerIceChange('answer')
	registerTrackChange()
	await addMedia()
	const snapshot = await get(ref(db, `${room}/offer/desc`))
	await pc.setRemoteDescription(JSON.parse(snapshot.val()))
	const answerDesc = await pc.createAnswer()
	await pc.setLocalDescription(answerDesc)
	await set(ref(db, `${room}/answer/desc`), JSON.stringify(answerDesc))
	onChildAdded(ref(db, `${room}/offer/ice`), async (snapshot) => {
		if (snapshot.exists()) {
			await pc.addIceCandidate(snapshot.val())
		}
	})
}

async function addMedia() {
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
