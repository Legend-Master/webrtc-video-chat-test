import { defineConfig } from 'vite'

export default defineConfig({
	base: '/webrtc-video-chat-test/',
	build: {
		sourcemap: true,
	},
	optimizeDeps: {
		disabled: true,
	},
})
