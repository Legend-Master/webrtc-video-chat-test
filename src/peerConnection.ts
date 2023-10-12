// @ts-ignore
import './external/webrtcAdapter'
import {
	ref,
	set,
	onValue,
	push,
	onChildAdded,
	runTransaction,
	onDisconnect,
} from 'firebase/database'
import { db } from './util/firebaseInit'
import { updateBandwidthRestriction } from './util/sdpInject'
import { room } from './util/room'
import { registerUnsub, unsubscribeAll } from './util/unsubscribeAll'
import { getIceServers } from './iceServerData'
import {
	getUserMedia,
	onDeviceSelectChange,
	onResolutionChange,
	onVideoStateChange,
	setVideoState,
	videoState,
} from './selectDevice'
import { updateAllParameters, updateParameters, updateResolution } from './senderParameters'
import { closeDialog, openDialogModal } from './styleHelper/dialog'

const shareUrlPopup = document.getElementById('share-url-popup') as HTMLDialogElement
const shareUrlButton = document.getElementById('share-url-button') as HTMLButtonElement
const shareUrlServerButton = document.getElementById('share-url-server-button') as HTMLButtonElement

type PeerType = 'offer' | 'answer'

const OFFER_PLACEHOLDER = ''
const DATA_CHANNEL_ID = 0

let pc: RTCPeerConnection
let peerType: PeerType
let dataChannel: RTCDataChannel
let firstConnected: boolean

// The one who says "you go first"
// https://developer.mozilla.org/en-US/docs/Web/API/WebRTC_API/Perfect_negotiation
function isPolite() {
	return peerType === 'answer'
}

const stateIndicator = document.getElementById('connection-state-indicator') as HTMLDivElement

const localVideo = document.getElementById('local-video') as HTMLVideoElement
const remoteVideo = document.getElementById('remote-video') as HTMLVideoElement

function localStreamControl(enable: boolean) {
	return () => {
		const stream = localVideo.srcObject
		if (stream instanceof MediaStream) {
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
} as const

async function share(url: string) {
	// Firefox desktop and Android Webview doesn't support this yet
	if ('share' in navigator) {
		try {
			await navigator.share({ title: url, url })
		} catch (error) {
			if (error instanceof DOMException && error.name === 'AbortError') {
				return
			}
			throw error
		}
	} else {
		// Fallback to copy to clipboard
		// TODO: make it respond with an UI change to indicate copied
		;(navigator as Navigator).clipboard.writeText(url)
	}
}
shareUrlButton.addEventListener('click', () => {
	share(location.toString())
})
shareUrlServerButton.addEventListener('click', () => {
	const servers = JSON.stringify(getIceServers())
	const params = new URLSearchParams(location.search)
	params.append('servers', servers)
	share(`${location.origin}${location.pathname}?${params}`)
})

function IndicateConnectionState(state: keyof typeof STATES) {
	if (state === 'localOffer') {
		if (!shareUrlPopup.open) {
			openDialogModal(shareUrlPopup, true)
		}
	} else {
		if (shareUrlPopup.open) {
			closeDialog(shareUrlPopup)
		}
	}
	stateIndicator.innerText = STATES[state]
}

function monitorConnectionState(this: RTCPeerConnection) {
	switch (this.connectionState) {
		case 'connected':
			IndicateConnectionState('connected')
			break
		// case 'new':
		case 'connecting':
			IndicateConnectionState('connecting')
			break
		case 'failed':
		case 'closed':
		case 'disconnected':
			IndicateConnectionState('disconnected')
			break
	}
}

function monitorSignalingState(this: RTCPeerConnection) {
	switch (this.signalingState) {
		case 'stable':
			if (this.connectionState === 'connected') {
				IndicateConnectionState('connected')
			} else {
				IndicateConnectionState('stable')
			}
			break
		case 'have-local-offer':
			if (this.connectionState === 'connected') {
				IndicateConnectionState('connectedLocalOffer')
			} else {
				IndicateConnectionState('localOffer')
			}
			break
		case 'have-remote-offer':
			if (this.connectionState === 'connected') {
				IndicateConnectionState('connectedRemoteOffer')
			} else {
				IndicateConnectionState('remoteOffer')
			}
			break
		case 'closed':
			IndicateConnectionState('disconnected')
			break
	}
}

export async function startPeerConnection() {
	pc = new RTCPeerConnection({ iceServers: getIceServers() })
	pc.addEventListener('track', onTrack)
	pc.addEventListener('icecandidate', onIceCandidate)
	pc.addEventListener('negotiationneeded', negotiate)
	pc.addEventListener('signalingstatechange', monitorSignalingState)
	pc.addEventListener('connectionstatechange', monitorFirstConnected)
	pc.addEventListener('connectionstatechange', monitorConnectionState)
	await addMedia()
	dataChannel = pc.createDataChannel('renegotiate', {
		negotiated: true,
		id: DATA_CHANNEL_ID,
	})
	dataChannel.addEventListener('message', onDataChannelMessage)
	return pc
}

let blankVideoTrack:
	| {
			width: number
			height: number
			track: MediaStreamTrack
	  }
	| undefined

function createBlankVideoTrack(width: number, height: number) {
	if (blankVideoTrack && blankVideoTrack.width === width && blankVideoTrack.height === height) {
		return blankVideoTrack.track
	}

	const canvas = document.createElement('canvas')
	canvas.width = width
	canvas.height = height

	const context = canvas.getContext('2d')!
	context.fillRect(0, 0, width, height)

	const stream = canvas.captureStream()
	blankVideoTrack = {
		width,
		height,
		track: stream.getVideoTracks()[0]!,
	}

	return blankVideoTrack.track
}

function onTrack(this: RTCPeerConnection, ev: RTCTrackEvent) {
	if (!remoteVideo.srcObject) {
		remoteVideo.srcObject = new MediaStream()
	}
	const track = ev.track
	const srcObject = remoteVideo.srcObject as MediaStream
	srcObject.addTrack(track)

	// Replace remote video with a blank one on remote peer stops sharing
	if (track.kind === 'video') {
		// Firefox doesn't think of it as muted on remote peer track.stop()
		// But Firefox doesn't turn black video on track.stop() anyway
		// Seem to be fine to just leave it to default browser behavior
		// TODO: Test how it works in Safari
		track.addEventListener('mute', () => {
			const { width, height } = track.getSettings()
			if (!width || !height) {
				console.warn(track, `should have both width and height, but it's not`)
				return
			}
			const blankVideoTrack = createBlankVideoTrack(width, height)
			srcObject.removeTrack(track)
			srcObject.addTrack(blankVideoTrack)
		})
		track.addEventListener('unmute', () => {
			if (blankVideoTrack) {
				srcObject.removeTrack(blankVideoTrack.track)
			}
			srcObject.addTrack(track)
		})
	}

	// Refresh audio control
	remoteVideo.controls = false
	remoteVideo.controls = true
}

async function onIceCandidate(this: RTCPeerConnection, ev: RTCPeerConnectionIceEvent) {
	if (ev.candidate) {
		const candidateInit = ev.candidate.toJSON()
		if (peerType) {
			await set(push(ref(db, `${room}/${peerType}/ice`)), candidateInit)
		}
	}
}

function monitorFirstConnected(this: RTCPeerConnection) {
	if (this.connectionState === 'connected') {
		firstConnected = true
		this.removeEventListener('connectionstatechange', monitorFirstConnected)
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

const senders = new Map<string, RTCRtpSender>()
async function addMediaInternal() {
	for (const [_, sender] of senders) {
		sender.track?.stop()
	}
	if (!videoState) {
		return
	}
	const stream = await getUserMedia()
	if (!stream) {
		setVideoState(false)
		return
	}
	// const videoTrack = stream.getVideoTracks()[0]!
	// console.log(videoTrack.getSettings())
	// console.log(videoTrack.getCapabilities())
	// console.log(videoTrack.getConstraints())
	localVideo.srcObject = stream

	const promises = []
	const tracks = stream.getTracks()
	const firstTrack = tracks[0]
	if (firstTrack) {
		firstTrack.addEventListener('ended', () => setVideoState(false), { once: true })
	}
	for (const track of tracks) {
		const sender = senders.get(track.kind)
		if (sender) {
			promises.push(sender.replaceTrack(track))
		} else {
			senders.set(track.kind, pc.addTrack(track))
		}
	}
	await Promise.all(promises)
	await updateAllParameters(pc)
}

async function addMedia() {
	await addMediaInternal()
	onDeviceSelectChange(addMediaInternal)
	onVideoStateChange(addMediaInternal)
	onResolutionChange(() => updateParameters(pc, updateResolution))
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

	const onDisconnectRef = onDisconnect(ref(db, `${room}`))
	await onDisconnectRef.remove()

	// Get if we're 'offer' or 'answer' side first
	const offerDescRef = ref(db, `${room}/offer/desc`)
	const result = await runTransaction(offerDescRef, (data) => {
		if (!data && data !== OFFER_PLACEHOLDER) {
			// Mark as used, and we're the 'offer' side
			return OFFER_PLACEHOLDER
		}
	})
	function getPeerType(isOffer: boolean): PeerType {
		return isOffer ? 'offer' : 'answer'
	}
	peerType = getPeerType(result.committed)
	const remotePeerType = getPeerType(!result.committed)

	if (peerType === 'offer') {
		const offer = await this.createOffer()
		await this.setLocalDescription(offer)
		await set(offerDescRef, processDescription(offer))
	}

	const remoteDescRef = ref(db, `${room}/${remotePeerType}/desc`)
	registerUnsub(
		onValue(remoteDescRef, async (snapshot) => {
			if (!snapshot.exists()) {
				// Another peer disconnected after we tried to connect to them

				// Cancel purge on disconnect since
				// another peer already removed data from database,
				// don't do it anymore in case another peer tries to
				// reload and restart a new one
				// (not a perfect solution to this tho)

				// If not connected: cleanup and prompt user to restart

				if (this.remoteDescription) {
					onDisconnectRef.cancel()
					if (!firstConnected) {
						// Cleanup
						unsubscribeAll()
						this.close()
						alert('Another peer disconnected before connection established')
						window.location.reload()
					}
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
