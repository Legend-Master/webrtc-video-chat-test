import { CustomVideo } from './custom-video'

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

function hasOnlyOneVisibleChild() {
	let onlyChild
	let firstWrapper
	for (const { wrapper, shouldShow } of videos.values()) {
		if (shouldShow) {
			if (onlyChild) {
				return false
			}
			onlyChild = wrapper
		}
		if (!firstWrapper) {
			firstWrapper = wrapper
		}
	}
	return onlyChild ?? firstWrapper
}

function updateVideoLayout() {
	const onlyChild = hasOnlyOneVisibleChild()
	for (const { shouldShow, wrapper } of videos.values()) {
		wrapper.hidden = !shouldShow
		if (wrapper === onlyChild) {
			wrapper.classList.add('only-child')
			wrapper.hidden = false
		} else {
			wrapper.classList.remove('only-child')
		}
	}
}
updateVideoLayout()
