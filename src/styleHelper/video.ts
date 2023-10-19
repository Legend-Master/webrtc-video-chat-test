const videos = document.getElementsByTagName('video')

function onLoadeddata(this: HTMLVideoElement) {
	this.classList.add('started')
}

export function bindVideo(video?: HTMLVideoElement) {
	if (!video) {
		video = document.createElement('video')
	}
	video.addEventListener('loadeddata', onLoadeddata)
	return video
}

for (const video of videos) {
	bindVideo(video)
}
