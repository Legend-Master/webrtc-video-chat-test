const remoteVideo = document.getElementById('remote-video') as HTMLVideoElement

window.addEventListener('keydown', (ev) => {
	if (ev.ctrlKey || ev.metaKey || ev.shiftKey || ev.altKey || ev.repeat) {
		return
	}
	if (
		document.activeElement instanceof HTMLInputElement ||
		document.activeElement instanceof HTMLTextAreaElement
	) {
		return
	}
	if (!remoteVideo.srcObject) {
		return
	}
	if (ev.key === 'f') {
		if (document.fullscreenElement === remoteVideo) {
			document.exitFullscreen()
		} else {
			remoteVideo.requestFullscreen()
		}
	} else if (ev.key === 'i') {
		// Firefox and Android Webview (kinda irrelevant) doesn't have these
		if (typeof remoteVideo.requestFullscreen !== 'function') {
			return
		}
		if (document.pictureInPictureElement === remoteVideo) {
			document.exitPictureInPicture()
		} else {
			remoteVideo.requestPictureInPicture()
		}
	}
})
