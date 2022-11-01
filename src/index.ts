const video = document.getElementById('remote-video') as HTMLVideoElement

const stunSettingDiv = document.getElementById('stun-setting-div') as HTMLDivElement
const currentStun = document.getElementById('current-stun') as HTMLHeadingElement
const stunUrl = document.getElementById('stun-url') as HTMLInputElement
const stunUsername = document.getElementById('stun-username') as HTMLInputElement
const stunPassword = document.getElementById('stun-password') as HTMLInputElement
const stunBtn = document.getElementById('stun-button') as HTMLButtonElement

const offerBtn = document.getElementById('offer-button') as HTMLButtonElement
const answerBtn = document.getElementById('answer-button') as HTMLButtonElement
const answerTextarea = document.getElementById('answer-textarea') as HTMLTextAreaElement

const pcInfoDiv = document.getElementById('pc-info-div') as HTMLDivElement
const copyBtn = document.getElementById('copy-button') as HTMLButtonElement
const iceGatherState = document.getElementById('ice-gather-state') as HTMLSpanElement
const iceOutEl = document.getElementById('ice-out') as HTMLDivElement
const descOutEl = document.getElementById('desc-out') as HTMLDivElement

type MixedData = {
	ice: RTCIceCandidateInit[]
	desc: RTCSessionDescriptionInit
}

const defaultIceServerUrl = 'stun:stun.l.google.com:19302'
let iceServerConfig: RTCIceServer = {
	urls: defaultIceServerUrl,
}
currentStun.innerText = defaultIceServerUrl

let pc: RTCPeerConnection
let peerType: 'offer' | 'answer' = 'answer'

const icecandidateData: RTCIceCandidateInit[] = []
let offerDesc: RTCSessionDescriptionInit
let answerDesc: RTCSessionDescriptionInit

stunBtn.addEventListener('click', async (ev) => {
	if (!stunUrl.value) {
		return
	}
	iceServerConfig = {
		urls: stunUrl.value.trim(),
		username: stunUsername.value.trim(),
		credential: stunPassword.value.trim(),
	}
	currentStun.innerText = iceServerConfig.username
		? `${iceServerConfig.urls} ${iceServerConfig.username} ${iceServerConfig.credential}`
		: `${iceServerConfig.urls}`
})
offerBtn.addEventListener('click', async (ev) => {
	offerBtn.hidden = true
	peerType = 'offer'
	await createOfferPeer()
	stunSettingDiv.hidden = true
	pcInfoDiv.hidden = false
})
answerBtn.addEventListener('click', async (ev) => {
	const userInput = answerTextarea.value
	if (!userInput) {
		return
	}
	offerBtn.hidden = true
	answerBtn.hidden = true
	answerTextarea.hidden = true
	const data: MixedData = JSON.parse(userInput)
	if (peerType === 'answer') {
		offerDesc = data.desc
		await createAnswerPeer()
	} else {
		await pc.setRemoteDescription(data.desc)
	}
	for (const candidate of data.ice) {
		await pc.addIceCandidate(candidate)
	}
	stunSettingDiv.hidden = true
	pcInfoDiv.hidden = false
})
copyBtn.addEventListener('click', (ev) => {
	const data: MixedData = {
		ice: icecandidateData,
		desc: peerType === 'offer' ? offerDesc : answerDesc,
	}
	navigator.clipboard.writeText(JSON.stringify(data))
})

function registerIceChange() {
	pc.addEventListener('icecandidate', (ev) => {
		if (ev.candidate) {
			// console.log(ev.candidate.candidate)
			icecandidateData.push(ev.candidate.toJSON())
			iceOutEl.innerText = JSON.stringify(icecandidateData)
		}
	})
	pc.addEventListener('icegatheringstatechange', (ev) => {
		// if (pc.iceGatheringState === 'complete') {
		// 	iceOutEl.innerText = JSON.stringify(icecandidateData)
		// }
		iceGatherState.innerText = ` (${pc.iceGatheringState})`
	})
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
	registerIceChange()
	registerTrackChange()
	await addMedia()
	offerDesc = await pc.createOffer()
	descOutEl.innerText = JSON.stringify(offerDesc)
	await pc.setLocalDescription(offerDesc)
}

async function createAnswerPeer() {
	pc = new RTCPeerConnection({ iceServers: [iceServerConfig] })
	registerIceChange()
	registerTrackChange()
	await addMedia()
	await pc.setRemoteDescription(offerDesc)
	answerDesc = await pc.createAnswer()
	descOutEl.innerText = JSON.stringify(answerDesc)
	await pc.setLocalDescription(answerDesc)
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
