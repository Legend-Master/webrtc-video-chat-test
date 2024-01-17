import { CustomVideo } from './custom-elements/custom-video'

const remoteVideo = document.getElementById('remote-video') as CustomVideo
const remoteVideoContainer = document.getElementById('remote-video-container') as HTMLDivElement

const videos = new Map<CustomVideo, { wrapper: HTMLDivElement; shouldShow: boolean }>()
videos.set(remoteVideo, { wrapper: remoteVideo.parentElement as HTMLDivElement, shouldShow: false })

let remoteVideoInUse = false

export function addVideo() {
	if (!remoteVideoInUse) {
		remoteVideoInUse = true
		return remoteVideo
	}
	const wrapper = document.createElement('div')
	const video = document.createElement('custom-video')
	wrapper.append(video)
	remoteVideoContainer.append(wrapper)
	videos.set(video, { wrapper, shouldShow: false })
	updateVideoLayout()
	return video
}

export function removeVideo(video: CustomVideo) {
	videos.delete(video)
	updateVideoLayout()
}

export function showVideo(video: CustomVideo) {
	const data = videos.get(video)
	if (!data) {
		return
	}
	data.shouldShow = true
	updateVideoLayout()
}

export function hideVideo(video: CustomVideo) {
	const data = videos.get(video)
	if (!data) {
		return
	}
	data.shouldShow = false
	updateVideoLayout()
}

export function isRemoteVideo(video: CustomVideo) {
	return videos.get(video) !== undefined
}

export function isVideoHidden(video: CustomVideo) {
	return videos.get(video)?.wrapper.hidden
}

export function getNoneHiddenVideo() {
	for (const [video, { wrapper }] of videos) {
		if (!wrapper.hidden) {
			return video
		}
	}
}

function getOnlyVisibleChild() {
	let visibleChild
	for (const { wrapper } of videos.values()) {
		// Skip non visible ones
		if (wrapper.hidden) {
			continue
		}
		// Return undefined if there's another visible child
		if (visibleChild) {
			return
		}
		visibleChild = wrapper
	}
	return visibleChild
}

function updateVideoLayout() {
	const onlyChild = getOnlyVisibleChild()
	for (const { shouldShow, wrapper } of videos.values()) {
		wrapper.hidden = !shouldShow
		if (wrapper === onlyChild) {
			wrapper.classList.add('only-visible-child')
			wrapper.hidden = false
		} else {
			wrapper.classList.remove('only-visible-child')
		}
	}
}
updateVideoLayout()
