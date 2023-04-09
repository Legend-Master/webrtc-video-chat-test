const videos = document.getElementsByTagName('video')

function onLoadeddata(this: HTMLVideoElement) {
	this.classList.add('started')
}

function onKeydown(this: HTMLVideoElement, ev: KeyboardEvent) {
	if (ev.ctrlKey || ev.metaKey || ev.shiftKey || ev.altKey || ev.repeat) {
		return
	}
	if (ev.key === 'f') {
		if (document.fullscreenElement === this) {
			document.exitFullscreen()
		} else {
			this.requestFullscreen()
		}
	} else if (ev.key === 'i') {
		if (!this.srcObject) {
			return
		}
		// Firefox and Android Webview (kinda irrelevant) doesn't have these
		if (typeof this.requestFullscreen !== 'function') {
			return
		}
		if (document.pictureInPictureElement === this) {
			document.exitPictureInPicture()
		} else {
			this.requestPictureInPicture()
		}
	}
}

for (const video of videos) {
	video.addEventListener('loadeddata', onLoadeddata)
	video.addEventListener('keydown', onKeydown)
}
