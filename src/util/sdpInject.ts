// SDP RFC: https://www.rfc-editor.org/rfc/rfc4566.html
// (A newer version RFC https://www.rfc-editor.org/rfc/rfc8866.html was published in 2021,
// the page is much cleaner and it says "This document obsoletes RFC 4566",
// but I can't find any reference from the Google Webrtc source code)

// Line ending should be CRLF (\r\n) (https://www.rfc-editor.org/rfc/rfc4566#section-9)

// Bandwith selection: https://www.rfc-editor.org/rfc/rfc4566.html#section-5.8
// AS: Application Specific, in kilobits per second (kbps) (https://www.rfc-editor.org/rfc/rfc3556#section-2)
// TIAS: Transport Independent Application Specific, in bits per second (bps) (https://www.rfc-editor.org/rfc/rfc3890#section-6.2.2)
// If both AS and TIAS are provided, the later one is used
// RtpSender::SetParameters (RTCRtpSender.setParameters in js) can override sdp max bitrate, but only lower

// Modified from https://github.com/webrtc/samples/blob/gh-pages/src/content/peerconnection/bandwidth/js/main.js
// bandwidth default to 10Mbps (10,000kbps)
export function updateBandwidthRestriction(sdp: string, bandwidth: number = 10_000) {
	const modifiers = [
		['TIAS', bandwidth * 1000], // Firefox only supports TIAS currently, and it's measured in bps instead of kbps
		['AS', bandwidth], // Others
	] as const
	const lines: string[] = []
	for (const [modifier, bandwidth] of modifiers) {
		const prefix = `b=${modifier}:`
		lines.push(`${prefix}${bandwidth}\r\n`)
		// Clear anything set before
		if (sdp.includes(prefix)) {
			sdp = sdp.replaceAll(new RegExp(`${prefix}.*\r\n`, 'g'), '')
		}
	}
	// Replace all for now, may change to replace the video part only
	// insert b= after c= line
	sdp = sdp.replaceAll(/c=IN .*\r\n/g, `$&${lines.join('')}`)
	return sdp
}
