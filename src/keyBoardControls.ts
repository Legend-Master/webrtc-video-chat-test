import { CustomVideo } from './custom-elements/custom-video'
import { getNoneHiddenVideo, isRemoteVideo, isVideoHidden } from './remoteVideoManager'

let lastFocusVideo: CustomVideo | undefined
export function setLastFocusVideo(video: CustomVideo) {
	if (isRemoteVideo(video)) {
		lastFocusVideo = video
	}
}

window.addEventListener('keydown', async (ev) => {
	if (ev.ctrlKey || ev.metaKey || ev.shiftKey || ev.altKey || ev.repeat) {
		return
	}
	if (
		document.activeElement instanceof HTMLInputElement ||
		document.activeElement instanceof HTMLTextAreaElement
	) {
		return
	}
	if (!lastFocusVideo || isVideoHidden(lastFocusVideo)) {
		lastFocusVideo = getNoneHiddenVideo()
	}
	if (!lastFocusVideo?.getVideoSrcObject()) {
		return
	}
	if (ev.key === 'f') {
		await lastFocusVideo.toggleFullscreen()
	} else if (ev.key === 'i') {
		await lastFocusVideo.togglePictureInPicture()
	}
})
