import { onVideoStateChange } from './selectDevice'

export const localVideo = document.createElement('floating-video')
localVideo.id = 'local-video'
localVideo.hidden = true
document.body.append(localVideo)

export function showLocalVideo() {
	localVideo.hidden = false
}

onVideoStateChange(async (state) => {
	if (!state) {
		localVideo.hidden = true
		await Promise.all([localVideo.setPictureInPicture(false), localVideo.setFullscreen(false)])
	}
})
