const remoteVideo = document.getElementById('remote-video') as HTMLVideoElement

remoteVideo.addEventListener('loadeddata', () => {
    remoteVideo.controls = true
})
