import './external/webrtcAdapter'
import {
	ref,
	set,
	onValue,
	push,
	onChildAdded,
	runTransaction,
	Unsubscribe,
} from 'firebase/database'
import { db } from './util/firebaseInit'
import { updateBandwidthRestriction } from './util/sdpInject'
import { getIceServers } from './iceServerData'
import { onResolutionChange } from './selectDevice'
import { updateAllParameters, updateParameters, updateResolution } from './senderParameters'
import { localVideo } from './floatingVideo'
import { closeShareDialog, isShareDialogOpen } from './shareDialog'
import { bindVideo } from './styleHelper/video'
import { stream } from './peerConnectionsManager'
import { peerConnections } from './peerConnectionsManager'
import { getActivePeerConnections } from './peerConnectionsManager'
import { stateIndicator } from './peerConnectionsManager'

const remoteVideoContainer = document.getElementById('remote-video-container') as HTMLDivElement
const remoteVideo = document.getElementById('remote-video') as HTMLVideoElement

type PeerType = 'offer' | 'answer'

let isFirstVideo = true
const visibleVideoWrappers = new Set<HTMLElement>()
function updateVideoLayout(el: HTMLElement) {
	if (el.hidden) {
		visibleVideoWrappers.delete(el)
		if (visibleVideoWrappers.size === 1) {
			for (const wrapper of visibleVideoWrappers) {
				wrapper.classList.add('only-child')
			}
		}
	} else {
		visibleVideoWrappers.add(el)
		if (visibleVideoWrappers.size === 2) {
			for (const wrapper of visibleVideoWrappers) {
				wrapper.classList.remove('only-child')
			}
		}
	}
}
updateVideoLayout(remoteVideo.parentElement as HTMLDivElement)

export class PeerConnection {
	private static OFFER_PLACEHOLDER = ''
	private static RENEGOTIATE_CHANNEL_ID = 0
	private static VIDEO_STATE_CHANNEL_ID = 1

	private pc: RTCPeerConnection
	private peerType: PeerType | undefined
	private renegotiateDataChannel: RTCDataChannel
	private videoStateDataChannel: RTCDataChannel
	private firstConnected = false
	private isFirstNegotiation = true
	private isFirstVideo = true
	private remoteVideo: HTMLVideoElement
	private remoteVideoWrapper: HTMLDivElement

	constructor(private userPath: string) {
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

		this.isFirstVideo = isFirstVideo
		isFirstVideo = false
		if (this.isFirstVideo) {
			this.remoteVideo = remoteVideo
			this.remoteVideoWrapper = this.remoteVideo.parentElement as HTMLDivElement
		} else {
			this.remoteVideoWrapper = document.createElement('div')
			this.updateRemoveVideoVisibility(false)
			this.remoteVideo = bindVideo()
			this.remoteVideo.controls = true
			this.remoteVideo.autoplay = true
			this.remoteVideo.playsInline = true
			this.remoteVideoWrapper.append(this.remoteVideo)
			remoteVideoContainer.append(this.remoteVideoWrapper)
		}
		this.registerUserMedia()
	}

	private updateRemoveVideoVisibility(visible: boolean) {
		this.remoteVideoWrapper.hidden = !visible
		updateVideoLayout(this.remoteVideoWrapper)
	}

	// The one who says "you go first"
	// https://developer.mozilla.org/en-US/docs/Web/API/WebRTC_API/Perfect_negotiation
	private isPolite() {
		return this.peerType === 'answer'
	}

	private sendIfDataChannelOpen(channel: RTCDataChannel | undefined, message: string) {
		if (!channel || channel.readyState !== 'open') {
			return
		}
		channel.send(message)
	}

	private static STATES = {
		connected: '🟢 Connected',
		connecting: '🟡 Connecting',
		disconnected: '🔴 Disconnected',

		stable: '🟡 Waiting for connection',
		localOffer: '🟡 Waiting for another peer',
		connectedLocalOffer: '🟡 Waiting for another peer for new channel',
		remoteOffer: '🟡 Waiting for connection',
		connectedRemoteOffer: '🟡 Waiting for connection for new channel',
	} as const

	private async playDisconnectSound() {
		const stream = await fetch(new URL('/media/audio/disconnect.mp3', import.meta.url))
		const ctx = new AudioContext()
		const source = ctx.createBufferSource()
		source.buffer = await ctx.decodeAudioData(await stream.arrayBuffer())
		source.connect(ctx.destination)
		source.start()
	}

	private currentConnectionState: keyof typeof PeerConnection.STATES | undefined
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
		if (state === 'disconnected') {
			this.playDisconnectSound()
			if (!this.isFirstVideo) {
				this.updateRemoveVideoVisibility(false)
			}
			// Change the indicator to disconnected only when we're the only connection left
			if (getActivePeerConnections() !== 1) {
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

	private blankVideoTrack:
		| {
				width: number
				height: number
				track: MediaStreamTrack
		  }
		| undefined

	private remoteVideoTrack: MediaStreamTrack | undefined

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

	private getShownRemoteVideoCount() {
		let count = 0
		for (const childElement of remoteVideoContainer.children) {
			if (childElement instanceof HTMLDivElement && !childElement.hidden) {
				count += 1
			}
		}
		return count
	}

	private onRemoteVideoStateChange = (ev: MessageEvent) => {
		if (ev.data === 'true') {
			this.updateRemoveVideoVisibility(true)
		} else if (this.getShownRemoteVideoCount() > 1) {
			this.updateRemoveVideoVisibility(false)
		}
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

	private onTrack = (ev: RTCTrackEvent) => {
		if (!this.remoteVideo.srcObject) {
			this.updateRemoveVideoVisibility(true)
			this.remoteVideo.srcObject = new MediaStream()
		}
		;(this.remoteVideo.srcObject as MediaStream).addTrack(ev.track)

		// Refresh audio control
		this.remoteVideo.controls = false
		this.remoteVideo.controls = true
	}

	private onIceCandidate = async (ev: RTCPeerConnectionIceEvent) => {
		if (ev.candidate) {
			const candidateInit = ev.candidate.toJSON()
			if (this.peerType) {
				await set(push(ref(db, `${this.userPath}/${this.peerType}/ice`)), candidateInit)
			}
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

		// const onDisconnectRef = onDisconnect(ref(db, `${this.userPath}`))
		// await onDisconnectRef.remove()

		// Get if we're 'offer' or 'answer' side first
		const offerDescRef = ref(db, `${this.userPath}/offer/desc`)
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

		const remoteDescRef = ref(db, `${this.userPath}/${remotePeerType}/desc`)
		this.registerUnsub(
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
					await set(ref(db, `${this.userPath}/answer/desc`), this.processDescription(answer))
				}

				this.registerUnsub(
					onChildAdded(ref(db, `${this.userPath}/${remotePeerType}/ice`), async (snapshot) => {
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

	private unsubFunctions = new Set<Unsubscribe>()

	private registerUnsub(fn: Unsubscribe) {
		this.unsubFunctions.add(fn)
		return fn
	}

	private unsubscribeAll() {
		for (const fn of this.unsubFunctions) {
			fn()
		}
		this.unsubFunctions.clear()
	}
}
