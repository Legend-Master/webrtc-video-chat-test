const modifiers = new Map<string, number>()

// Specification https://www.rfc-editor.org/rfc/rfc4566.html#section-5.8
// Modified from https://github.com/webrtc/samples/blob/gh-pages/src/content/peerconnection/bandwidth/js/main.js
// bandwidth default to 10Mbps (10000kbps)
export function updateBandwidthRestriction(sdp: string, bandwidth: number = 10000) {
	modifiers.set('TIAS', bandwidth * 1000) // Firefox
	modifiers.set('AS', bandwidth) // Others
	for (const [modifier, bandwidth] of modifiers) {
		const prefix = `b=${modifier}:`
		const line = `${prefix}${bandwidth}\r\n`
		if (sdp.includes(prefix)) {
			sdp = sdp.replace(new RegExp(`${prefix}.*\r\n`), line)
		} else {
			// insert b= after c= line.
			sdp = sdp.replace(/c=IN (.*)\r\n/, `c=IN $1\r\n${line}`)
		}
	}
	return sdp
}
