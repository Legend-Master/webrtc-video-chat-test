for (const video of document.getElementsByTagName('video')) {
	video.addEventListener('loadeddata', () => {
		video.classList.add('started')
	})
}
