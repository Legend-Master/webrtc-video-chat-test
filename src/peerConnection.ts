import './external/webrtcAdapter'
import {
	set,
	onValue,
	push,
	onChildAdded,
	Unsubscribe,
	DatabaseReference,
	child,
} from 'firebase/database'
import { updateBandwidthRestriction } from './util/sdpInject'
import { getIceServers } from './iceServerData'
import { onResolutionChange } from './selectDevice'
import { updateAllParameters, updateParameters, updateResolution } from './senderParameters'
import { localVideo } from './localVideo'
import { closeShareDialog, isShareDialogOpen } from './shareDialog'
import { stream } from './peerConnectionsManager'
import { peerConnections } from './peerConnectionsManager'
import { getActivePeerConnections } from './peerConnectionsManager'
import { stateIndicator } from './peerConnectionsManager'
import { CustomVideo } from './custom-elements/custom-video'
import { addVideo, hideVideo, showVideo } from './remoteVideoManager'

type PeerType = 'offer' | 'answer'

export class PeerConnection {
	private static readonly OFFER_PLACEHOLDER = ''
	private static readonly RENEGOTIATE_CHANNEL_ID = 0
	private static readonly VIDEO_STATE_CHANNEL_ID = 1

	static readonly STATES = {
		connected: '🟢 Connected',
		connecting: '🟡 Connecting',
		disconnected: '🔴 Disconnected',

		stable: '🟡 Waiting for connection',
		localOffer: '🟡 Waiting for another peer',
		connectedLocalOffer: '🟡 Waiting for another peer for new channel',
		remoteOffer: '🟡 Waiting for connection',
		connectedRemoteOffer: '🟡 Waiting for connection for new channel',
	} as const

	currentConnectionState?: keyof typeof PeerConnection.STATES

	private readonly pc: RTCPeerConnection
	private readonly renegotiateDataChannel: RTCDataChannel
	private readonly videoStateDataChannel: RTCDataChannel

	private firstConnected = false
	private isFirstNegotiation = true

	private readonly remoteVideo: CustomVideo
	private localVideoState = false
	private remoteVideoState = false
	private blankVideoTrack?: {
		width: number
		height: number
		track: MediaStreamTrack
	}
	private remoteVideoTrack?: MediaStreamTrack

	constructor(
		private readonly userPathRef: DatabaseReference,
		private readonly peerType: PeerType
	) {
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

		this.remoteVideo = addVideo()
		this.registerUserMedia()
	}

	// The one who says "you go first"
	// https://developer.mozilla.org/en-US/docs/Web/API/WebRTC_API/Perfect_negotiation
	private isPolite() {
		return this.peerType === 'answer'
	}

	private sendIfDataChannelOpen(channel: RTCDataChannel, message: string) {
		if (channel.readyState === 'open') {
			channel.send(message)
		}
	}

	private async playDisconnectSound() {
		const stream = await fetch(new URL('/media/audio/disconnect.mp3', import.meta.url))
		const ctx = new AudioContext()
		const source = ctx.createBufferSource()
		source.buffer = await ctx.decodeAudioData(await stream.arrayBuffer())
		source.connect(ctx.destination)
		source.start()
	}

	private indicateConnectionState(state: keyof typeof PeerConnection.STATES) {
		if (this.currentConnectionState === state) {
			return
		}
		this.currentConnectionState = state

		if (state !== 'localOffer') {
			if (isShareDialogOpen()) {
				closeShareDialog()
			}
		}
		if (state === 'connected') {
			this.refreshRemoteVideo()
		} else if (state === 'disconnected') {
			this.playDisconnectSound()
			this.refreshRemoteVideo()
			// Change the indicator to disconnected only when no active connections left
			if (getActivePeerConnections() !== 0) {
				return
			}
		}
		stateIndicator.innerText = PeerConnection.STATES[state]
	}

	private monitorConnectionState = () => {
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

	private monitorSignalingState = () => {
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

	private createBlankVideoTrack(width: number, height: number) {
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

	private updateBlackOutRemoteVideo() {
		const srcObject = this.remoteVideo.getVideoSrcObject()
		if (!srcObject) {
			return
		}
		const track = srcObject.getVideoTracks()[0]
		if (!track) {
			return
		}
		if (this.remoteVideoState && this.currentConnectionState !== 'disconnected') {
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

	private setRemoteVideoState(state: boolean) {
		this.remoteVideoState = state
		if (this.remoteVideoState && this.currentConnectionState !== 'disconnected') {
			showVideo(this.remoteVideo)
		} else {
			hideVideo(this.remoteVideo)
		}
		this.updateBlackOutRemoteVideo()
	}

	private refreshRemoteVideo() {
		this.setRemoteVideoState(this.remoteVideoState)
	}

	private onRemoteVideoStateChange = (ev: MessageEvent) => {
		this.setRemoteVideoState(ev.data === 'true')
	}

	private onTrack = (ev: RTCTrackEvent) => {
		let srcObject = this.remoteVideo.getVideoSrcObject()
		if (!srcObject) {
			this.setRemoteVideoState(true)
			srcObject = new MediaStream()
			this.remoteVideo.setVideoSrcObject(srcObject)
		}
		srcObject.addTrack(ev.track)
		this.remoteVideo.onTrackChange()
	}

	private onIceCandidate = async (ev: RTCPeerConnectionIceEvent) => {
		if (ev.candidate) {
			const candidateInit = ev.candidate.toJSON()
			await set(push(child(this.userPathRef, `${this.peerType}/ice`)), candidateInit)
		}
	}

	private monitorFirstConnected = () => {
		if (this.pc.connectionState === 'connected') {
			this.firstConnected = true
			this.pc.removeEventListener('connectionstatechange', this.monitorFirstConnected)
		}
	}

	/**
	 * Generate a new {@link RTCSessionDescriptionInit},
	 * Won't mutate the given description (desc)
	 */
	private processDescription(desc: RTCSessionDescription | RTCSessionDescriptionInit) {
		if (desc instanceof RTCSessionDescription) {
			desc = desc.toJSON()
		} else {
			desc = { ...desc }
		}
		this.updateSdpInfo(desc)
		return desc
	}

	private updateSdpInfo(desc: RTCSessionDescriptionInit) {
		desc.sdp = updateBandwidthRestriction(desc.sdp!)
		return desc
	}

	private onRenegotiateChannelMessage = async (ev: MessageEvent) => {
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

	private renegotiate = async () => {
		const desc = await this.pc.createOffer()
		await this.pc.setLocalDescription(desc)
		this.renegotiateDataChannel.send(JSON.stringify(this.processDescription(desc)))
	}

	private senders = new Map<string, RTCRtpSender>()

	setLocalVideoState(state: boolean) {
		this.localVideoState = state
		this.sendIfDataChannelOpen(this.videoStateDataChannel, String(this.localVideoState))
	}

	onStreamStop() {
		for (const sender of this.senders.values()) {
			sender.track?.stop()
		}
		this.setLocalVideoState(false)
	}

	setCodecsPreference() {
		const receiverCodecs = RTCRtpReceiver.getCapabilities('video')?.codecs ?? []
		// const codecPriority = (capability: RTCRtpCodec) =>
		// 	capability.mimeType === 'video/H264' &&
		// 	capability.sdpFmtpLine ===
		// 		'level-asymmetry-allowed=1;packetization-mode=0;profile-level-id=42001f'
		// 		? 1
		// 		: 0
		const codecPriority = (capability: RTCRtpCodec) => (capability.mimeType === 'video/AV1' ? 1 : 0)
		receiverCodecs.sort((a, b) => {
			const priorityA = codecPriority(a)
			const priorityB = codecPriority(b)
			if (priorityA === priorityB) {
				return 0
			}
			return priorityA > priorityB ? -1 : 1
		})
		for (const transceiver of this.pc.getTransceivers()) {
			if (transceiver.sender.track?.kind === 'video') {
				// Not supported by Firefox
				transceiver.setCodecPreferences?.(receiverCodecs)
			}
		}
	}

	async onNewStream() {
		if (!stream) {
			return
		}
		const promises = []
		const tracks = stream.getTracks()
		for (const track of tracks) {
			const sender = this.senders.get(track.kind)
			if (sender) {
				promises.push(sender.replaceTrack(track))
			} else {
				this.senders.set(track.kind, this.pc.addTrack(track))
			}
		}
		this.setCodecsPreference()
		this.setLocalVideoState(true)
		await Promise.all(promises)
		await updateAllParameters(this.pc)
	}

	private async registerUserMedia() {
		await this.onNewStream()
		onResolutionChange(() => updateParameters(this.pc, updateResolution))
		localVideo.addEventListener('resize', () => updateParameters(this.pc, updateResolution))
	}

	private negotiate = async () => {
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

		// const onDisconnectRef = onDisconnect(this.userPathRef)
		// await onDisconnectRef.remove()

		const offerDescRef = child(this.userPathRef, 'offer/desc')
		const anwserDescRef = child(this.userPathRef, 'answer/desc')

		if (this.peerType === 'offer') {
			const offer = await this.pc.createOffer()
			await this.pc.setLocalDescription(offer)
			await set(offerDescRef, this.processDescription(offer))
		}

		const remotePeerType = this.peerType === 'offer' ? 'answer' : 'offer'
		const remoteDescRef = child(this.userPathRef, `${remotePeerType}/desc`)

		this.registerUnsubscribe(
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
						// onDisconnectRef.cancel()
						if (!this.firstConnected) {
							// Cleanup
							this.destroy()
							// alert('Another peer disconnected before connection established')
							// window.location.reload()
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
					await set(anwserDescRef, this.processDescription(answer))
				}

				this.registerUnsubscribe(
					onChildAdded(child(this.userPathRef, `${remotePeerType}/ice`), async (snapshot) => {
						if (snapshot.exists()) {
							await this.pc.addIceCandidate(snapshot.val())
						}
					})
				)
			})
		)
	}

	destroy() {
		peerConnections.delete(this)
		this.unsubscribeAll()
		this.pc.close()
	}

	private unsubscribeFunctions = new Set<Unsubscribe>()

	private registerUnsubscribe(fn: Unsubscribe) {
		this.unsubscribeFunctions.add(fn)
		return fn
	}

	private unsubscribeAll() {
		for (const fn of this.unsubscribeFunctions) {
			fn()
		}
		this.unsubscribeFunctions.clear()
	}
}
