/**
 * @license
 * webrtc-adapter: https://github.com/webrtcHacks/adapter/blob/28c9f9471cb3df75cbb978c6f840e3315731790f/src/js/common_shim.js#L292
 * BSD 3-Clause
 */

/* shims RTCConnectionState by pretending it is the same as iceConnectionState.
 * See https://bugs.chromium.org/p/webrtc/issues/detail?id=6145#c12
 * for why this is a valid hack in Chrome. In Firefox it is slightly incorrect
 * since DTLS failures would be hidden. See
 * https://bugzilla.mozilla.org/show_bug.cgi?id=1265827
 * for the Firefox tracking bug.
 */
function shimConnectionState(window) {
	if (!window.RTCPeerConnection || 'connectionState' in window.RTCPeerConnection.prototype) {
		return
	}
	const proto = window.RTCPeerConnection.prototype
	Object.defineProperty(proto, 'connectionState', {
		get() {
			return (
				{
					completed: 'connected',
					checking: 'connecting',
				}[this.iceConnectionState] || this.iceConnectionState
			)
		},
		enumerable: true,
		configurable: true,
	})
	Object.defineProperty(proto, 'onconnectionstatechange', {
		get() {
			return this._onconnectionstatechange || null
		},
		set(cb) {
			if (this._onconnectionstatechange) {
				this.removeEventListener('connectionstatechange', this._onconnectionstatechange)
				delete this._onconnectionstatechange
			}
			if (cb) {
				this.addEventListener('connectionstatechange', (this._onconnectionstatechange = cb))
			}
		},
		enumerable: true,
		configurable: true,
	})
	;['setLocalDescription', 'setRemoteDescription'].forEach((method) => {
		const origMethod = proto[method]
		proto[method] = function () {
			if (!this._connectionstatechangepoly) {
				this._connectionstatechangepoly = (e) => {
					const pc = e.target
					if (pc._lastConnectionState !== pc.connectionState) {
						pc._lastConnectionState = pc.connectionState
						const newEvent = new Event('connectionstatechange', e)
						pc.dispatchEvent(newEvent)
					}
					return e
				}
				this.addEventListener('iceconnectionstatechange', this._connectionstatechangepoly)
			}
			return origMethod.apply(this, arguments)
		}
	})
}

shimConnectionState(window)
