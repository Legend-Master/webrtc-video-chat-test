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
import { localVideo, showLocalVideo } from './floatingVideo'
import { closeShareDialog, isShareDialogOpen, openShareDialog } from './shareDialog'

type PeerType = 'offer' | 'answer'

const peerConnections = new Set<PeerConnection>()

let stream: MediaStream | undefined

async function changeUserMedia() {
	if (stream) {
		for (const track of stream?.getTracks()) {
			track.stop()
		}
		for (const peerConnection of peerConnections) {
			peerConnection.onStreamStop()
		}
	}

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

	for (const peerConnection of peerConnections) {
		peerConnection.onNewStream()
	}
}

export async function startPeerConnection() {
	await changeUserMedia()
	onDeviceSelectChange(changeUserMedia)
	onVideoStateChange(changeUserMedia)

	peerConnections.add(new PeerConnection())
}

class PeerConnection {
	static OFFER_PLACEHOLDER = ''
	static RENEGOTIATE_CHANNEL_ID = 0
	static VIDEO_STATE_CHANNEL_ID = 1

	pc: RTCPeerConnection
	peerType: PeerType | undefined
	renegotiateDataChannel: RTCDataChannel
	videoStateDataChannel: RTCDataChannel
	firstConnected = false
	isFirstNegotiation = true

	constructor() {
		this.pc = new RTCPeerConnection({ iceServers: getIceServers() })
		this.pc.addEventListener('track', this.onTrack)
		this.pc.addEventListener('icecandidate', this.onIceCandidate)
		this.pc.addEventListener('negotiationneeded', this.negotiate)
		this.pc.addEventListener('signalingstatechange', this.monitorSignalingState)
		this.pc.addEventListener('connectionstatechange', this.monitorFirstConnected)
		this.pc.addEventListener('connectionstatechange', this.monitorConnectionState)

		this.renegotiateDataChannel = this.pc.createDataChannel('renegotiate', {
			negotiated: true,
			id: PeerConnection.RENEGOTIATE_CHANNEL_ID,
		})
		this.renegotiateDataChannel.addEventListener('message', this.onRenegotiateChannelMessage)

		this.videoStateDataChannel = this.pc.createDataChannel('video_state', {
			negotiated: true,
			id: PeerConnection.VIDEO_STATE_CHANNEL_ID,
		})
		this.videoStateDataChannel.addEventListener('message', this.onRemoteVideoStateChange)

		this.registerUserMedia()
	}

	// The one who says "you go first"
	// https://developer.mozilla.org/en-US/docs/Web/API/WebRTC_API/Perfect_negotiation
	isPolite() {
		return this.peerType === 'answer'
	}

	sendIfDataChannelOpen(channel: RTCDataChannel | undefined, message: string) {
		if (!channel || channel.readyState !== 'open') {
			return
		}
		channel.send(message)
	}

	stateIndicator = document.getElementById('connection-state-indicator') as HTMLDivElement
	remoteVideo = document.getElementById('remote-video') as HTMLVideoElement

	static STATES = {
		connected: '🟢 Connected',
		connecting: '🟡 Connecting',
		disconnected: '🔴 Disconnected',

		stable: '🟡 Waiting for connection',
		localOffer: '🟡 Waiting for another peer',
		connectedLocalOffer: '🟡 Waiting for another peer for new channel',
		remoteOffer: '🟡 Waiting for connection',
		connectedRemoteOffer: '🟡 Waiting for connection for new channel',
	} as const

	async playDisconnectSound() {
		const stream = await fetch(new URL('/media/audio/disconnect.mp3', import.meta.url))
		const ctx = new AudioContext()
		const source = ctx.createBufferSource()
		source.buffer = await ctx.decodeAudioData(await stream.arrayBuffer())
		source.connect(ctx.destination)
		source.start()
	}

	currentConnectionState: keyof typeof PeerConnection.STATES | undefined
	indicateConnectionState(state: keyof typeof PeerConnection.STATES) {
		if (this.currentConnectionState === state) {
			return
		}
		this.currentConnectionState = state

		if (state === 'localOffer') {
			if (!isShareDialogOpen()) {
				openShareDialog()
			}
		} else {
			if (isShareDialogOpen()) {
				closeShareDialog()
			}
		}
		if (state === 'disconnected') {
			this.playDisconnectSound()
		}
		this.stateIndicator.innerText = PeerConnection.STATES[state]
	}

	monitorConnectionState = () => {
		switch (this.pc.connectionState) {
			case 'connected':
				this.indicateConnectionState('connected')
				break
			// case 'new':
			case 'connecting':
				this.indicateConnectionState('connecting')
				break
			case 'failed':
			case 'closed':
			case 'disconnected':
				this.indicateConnectionState('disconnected')
				break
		}
	}

	monitorSignalingState = () => {
		switch (this.pc.signalingState) {
			case 'stable':
				if (this.pc.connectionState === 'connected') {
					this.indicateConnectionState('connected')
				} else {
					this.indicateConnectionState('stable')
				}
				break
			case 'have-local-offer':
				if (this.pc.connectionState === 'connected') {
					this.indicateConnectionState('connectedLocalOffer')
				} else {
					this.indicateConnectionState('localOffer')
				}
				break
			case 'have-remote-offer':
				if (this.pc.connectionState === 'connected') {
					this.indicateConnectionState('connectedRemoteOffer')
				} else {
					this.indicateConnectionState('remoteOffer')
				}
				break
			case 'closed':
				this.indicateConnectionState('disconnected')
				break
		}
	}

	blankVideoTrack:
		| {
				width: number
				height: number
				track: MediaStreamTrack
		  }
		| undefined

	remoteVideoTrack: MediaStreamTrack | undefined

	createBlankVideoTrack(width: number, height: number) {
		if (
			this.blankVideoTrack &&
			this.blankVideoTrack.width === width &&
			this.blankVideoTrack.height === height
		) {
			return this.blankVideoTrack.track
		}

		const canvas = document.createElement('canvas')
		canvas.width = width
		canvas.height = height

		const context = canvas.getContext('2d')!
		context.fillRect(0, 0, width, height)

		const stream = canvas.captureStream()
		this.blankVideoTrack = {
			width,
			height,
			track: stream.getVideoTracks()[0]!,
		}

		return this.blankVideoTrack.track
	}

	onRemoteVideoStateChange = (ev: MessageEvent) => {
		const srcObject = this.remoteVideo.srcObject as MediaStream | null
		if (!srcObject) {
			return
		}
		const track = srcObject.getVideoTracks()[0]
		if (!track) {
			return
		}
		if (ev.data === 'true') {
			if (this.remoteVideoTrack && track !== this.remoteVideoTrack) {
				if (this.blankVideoTrack) {
					srcObject.removeTrack(this.blankVideoTrack.track)
				}
				srcObject.addTrack(this.remoteVideoTrack)
			}
		} else {
			const { width, height } = track.getSettings()
			// Firefox returns on empty object here unless it's directly from getDisplayMedia/getUserMedia
			// But Firefox doesn't turn black video on track.stop() anyway
			// Seem to be fine to just leave it to default browser behavior
			if (!width || !height) {
				console.warn(track, `should have both width and height, but it's not`)
				return
			}
			const blankVideoTrack = this.createBlankVideoTrack(width, height)
			if (track !== blankVideoTrack) {
				this.remoteVideoTrack = track
				srcObject.removeTrack(track)
				srcObject.addTrack(blankVideoTrack)
			}
		}
	}

	onTrack = (ev: RTCTrackEvent) => {
		if (!this.remoteVideo.srcObject) {
			this.remoteVideo.srcObject = new MediaStream()
		}
		;(this.remoteVideo.srcObject as MediaStream).addTrack(ev.track)

		// Refresh audio control
		this.remoteVideo.controls = false
		this.remoteVideo.controls = true
	}

	onIceCandidate = async (ev: RTCPeerConnectionIceEvent) => {
		if (ev.candidate) {
			const candidateInit = ev.candidate.toJSON()
			if (this.peerType) {
				await set(push(ref(db, `${room}/${this.peerType}/ice`)), candidateInit)
			}
		}
	}

	monitorFirstConnected = () => {
		if (this.pc.connectionState === 'connected') {
			this.firstConnected = true
			this.pc.removeEventListener('connectionstatechange', this.monitorFirstConnected)
		}
	}

	/**
	 * Generate a new {@link RTCSessionDescriptionInit},
	 * Won't mutate the given description (desc)
	 */
	processDescription(desc: RTCSessionDescription | RTCSessionDescriptionInit) {
		if (desc instanceof RTCSessionDescription) {
			desc = desc.toJSON()
		} else {
			desc = { ...desc }
		}
		this.updateSdpInfo(desc)
		return desc
	}

	updateSdpInfo(desc: RTCSessionDescriptionInit) {
		desc.sdp = updateBandwidthRestriction(desc.sdp!)
		return desc
	}

	onRenegotiateChannelMessage = async (ev: MessageEvent) => {
		const desc = JSON.parse(ev.data) as RTCSessionDescriptionInit
		if (desc.type === 'offer' && this.pc.signalingState === 'have-local-offer') {
			if (this.isPolite()) {
				await this.pc.setLocalDescription({ type: 'rollback' })
			} else {
				return
			}
		}
		await this.pc.setRemoteDescription(desc)
		if (desc.type === 'offer') {
			const desc = await this.pc.createAnswer()
			await this.pc.setLocalDescription(desc)
			this.renegotiateDataChannel.send(JSON.stringify(this.processDescription(desc)))
		}
	}

	renegotiate = async () => {
		const desc = await this.pc.createOffer()
		await this.pc.setLocalDescription(desc)
		this.renegotiateDataChannel.send(JSON.stringify(this.processDescription(desc)))
	}

	senders = new Map<string, RTCRtpSender>()

	onStreamStop() {
		for (const [_, sender] of this.senders) {
			sender.track?.stop()
		}
		this.sendIfDataChannelOpen(this.videoStateDataChannel, 'false')
	}

	async onNewStream() {
		if (!stream) {
			return
		}
		const promises = []
		const tracks = stream.getTracks()
		const firstTrack = tracks[0]
		if (firstTrack) {
			firstTrack.addEventListener('ended', () => setVideoState(false), { once: true })
		}
		for (const track of tracks) {
			const sender = this.senders.get(track.kind)
			if (sender) {
				promises.push(sender.replaceTrack(track))
			} else {
				this.senders.set(track.kind, this.pc.addTrack(track))
			}
		}
		this.sendIfDataChannelOpen(this.videoStateDataChannel, 'true')
		await Promise.all(promises)
		await updateAllParameters(this.pc)
	}

	async registerUserMedia() {
		await this.onNewStream()
		onResolutionChange(() => updateParameters(this.pc, updateResolution))
		localVideo.addEventListener('resize', () => updateParameters(this.pc, updateResolution))
	}

	negotiate = async () => {
		// Only renegotiate through p2p data channel
		if (!this.isFirstNegotiation) {
			if (this.renegotiateDataChannel.readyState === 'open') {
				this.renegotiate()
			} else {
				this.renegotiateDataChannel.onopen = this.renegotiate
			}
			return
		}
		this.isFirstNegotiation = false

		const onDisconnectRef = onDisconnect(ref(db, `${room}`))
		await onDisconnectRef.remove()

		// Get if we're 'offer' or 'answer' side first
		const offerDescRef = ref(db, `${room}/offer/desc`)
		const result = await runTransaction(offerDescRef, (data) => {
			if (!data && data !== PeerConnection.OFFER_PLACEHOLDER) {
				// Mark as used, and we're the 'offer' side
				return PeerConnection.OFFER_PLACEHOLDER
			}
		})
		function getPeerType(isOffer: boolean): PeerType {
			return isOffer ? 'offer' : 'answer'
		}
		this.peerType = getPeerType(result.committed)
		const remotePeerType = getPeerType(!result.committed)

		if (this.peerType === 'offer') {
			const offer = await this.pc.createOffer()
			await this.pc.setLocalDescription(offer)
			await set(offerDescRef, this.processDescription(offer))
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

					if (this.pc.remoteDescription) {
						onDisconnectRef.cancel()
						if (!this.firstConnected) {
							// Cleanup
							unsubscribeAll()
							this.pc.close()
							alert('Another peer disconnected before connection established')
							window.location.reload()
						}
					}
					return
				}
				if (this.pc.remoteDescription) {
					return
				}
				const val = snapshot.val()
				if (val === PeerConnection.OFFER_PLACEHOLDER) {
					return
				}

				await this.pc.setRemoteDescription(val)

				if (this.peerType === 'answer') {
					const answer = await this.pc.createAnswer()
					await this.pc.setLocalDescription(answer)
					await set(ref(db, `${room}/answer/desc`), this.processDescription(answer))
				}

				registerUnsub(
					onChildAdded(ref(db, `${room}/${remotePeerType}/ice`), async (snapshot) => {
						if (snapshot.exists()) {
							await this.pc.addIceCandidate(snapshot.val())
						}
					})
				)
			})
		)
	}
}
