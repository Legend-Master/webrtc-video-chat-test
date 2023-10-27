import { getIceServers } from './iceServerData'
import { closeDialog, openDialogModal } from './styleHelper/dialog'

const shareUrlPopup = document.getElementById('share-url-popup') as HTMLDialogElement
const shareUrlButton = document.getElementById('share-url-button') as HTMLButtonElement
const shareUrlServerButton = document.getElementById('share-url-server-button') as HTMLButtonElement

export function openShareDialog() {
    openDialogModal(shareUrlPopup, true)
}

export function closeShareDialog() {
    closeDialog(shareUrlPopup)
}

export function isShareDialogOpen() {
    return shareUrlPopup.open
}

async function share(url: string) {
	// Firefox desktop and Android Webview doesn't support this yet
	if ('share' in navigator) {
		try {
			await navigator.share({ title: url, url })
		} catch (error) {
			if (error instanceof DOMException && error.name === 'AbortError') {
				return
			}
			throw error
		}
	} else {
		// Fallback to copy to clipboard
		// TODO: make it respond with an UI change to indicate copied
		;(navigator as Navigator).clipboard.writeText(url)
	}
}

shareUrlButton.addEventListener('click', () => {
	share(location.toString())
})

shareUrlServerButton.addEventListener('click', () => {
	const servers = JSON.stringify(getIceServers())
	const params = new URLSearchParams(location.search)
	params.append('servers', servers)
	share(`${location.origin}${location.pathname}?${params}`)
})
