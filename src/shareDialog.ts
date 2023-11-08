import { getIceServers } from './iceServerData'
import { closeDialog, openDialogModal } from './styleHelper/dialog'
import { attachCopyButton } from './styleHelper/copyButton'

import './shareDialog.css'

const shareUrlPopup = document.getElementById('share-url-popup') as HTMLDialogElement
const shareUrlInput = document.getElementById('share-url-input') as HTMLInputElement
const copyUrlButton = document.getElementById('share-copy-url-button') as HTMLButtonElement
const serversToggle = document.getElementById('share-url-servers-toggle') as HTMLInputElement
const autoStartToggle = document.getElementById('share-url-auto-start-toggle') as HTMLInputElement
const shareUrlButton = document.getElementById('share-url-button') as HTMLButtonElement

let link = ''

attachCopyButton(copyUrlButton, () => link)
serversToggle.addEventListener('change', updateShareLink)
autoStartToggle.addEventListener('change', updateShareLink)
shareUrlButton.addEventListener('click', () => {
	share(link)
})

export function openShareDialog() {
	updateShareLink()
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

function updateShareLink() {
	const url = new URL(location.href)
	for (const [key, value] of url.searchParams) {
		if (key !== 'room') {
			url.searchParams.delete(key)
		}
	}
	if (serversToggle.checked) {
		const servers = JSON.stringify(getIceServers())
		url.searchParams.set('servers', servers)
	}
	if (autoStartToggle.checked) {
		url.searchParams.set('auto-start', 'true')
	}
	link = url.toString()
	shareUrlInput.value = link
}
