import { getIceServers } from './iceServerData'
import { closeDialog, openDialogModal } from './styleHelper/dialog'
import { attachCopyButton } from './styleHelper/copyButton'
import { createIcon } from './styleHelper/icon'

import mdiShare from 'iconify-icon:mdi/share'

import './shareDialog.css'

const shareUrlPopup = document.getElementById('share-url-popup') as HTMLDialogElement
const shareUrlInput = document.getElementById('share-url-input') as HTMLInputElement
const copyUrlButton = document.getElementById('share-copy-url-button') as HTMLButtonElement
const serversToggle = document.getElementById('share-url-servers-toggle') as HTMLInputElement
const autoStartToggle = document.getElementById('share-url-auto-start-toggle') as HTMLInputElement

let link = ''

attachCopyButton(copyUrlButton, () => link)
serversToggle.addEventListener('change', updateShareLink)
autoStartToggle.addEventListener('change', updateShareLink)

// Firefox desktop and Android Webview doesn't support this yet
if ('share' in navigator) {
	const shareUrlButton = document.createElement('button')
	shareUrlButton.id = 'share-url-button'

	const icon = createIcon(mdiShare)
	shareUrlButton.append(icon)

	const text = document.createElement('span')
	text.innerText = 'Share link'
	shareUrlButton.append(text)

	shareUrlButton.addEventListener('click', async () => {
		try {
			await navigator.share({ title: link, url: link })
		} catch (error) {
			if (error instanceof DOMException && error.name === 'AbortError') {
				return
			}
			throw error
		}
	})

	const wrapper = shareUrlPopup.firstElementChild as HTMLDivElement
	wrapper.append(shareUrlButton)
}

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
