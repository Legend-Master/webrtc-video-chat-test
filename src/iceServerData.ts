import { closeDialogOnClickOutside, openDialogModal } from './styleHelper/dialog'
import { createIconButton } from './styleHelper/iconButton'

import mdiPencil from 'iconify-icon:mdi/pencil'
import mdiDelete from 'iconify-icon:mdi/delete'
import { attachCopyButton } from './styleHelper/copyButton'

type IceServer = Omit<RTCIceServer, 'urls'> & {
	urls: string
}
type IceServerData = {
	server: IceServer
	enabled: boolean
}

const SERVER_SAVE_KEY = 'ice-server-data'
let iceServerConfig: IceServerData[] = []

export function getIceServers() {
	const servers: IceServer[] = []
	for (const data of iceServerConfig) {
		if (data.enabled) {
			servers.push(data.server)
		}
	}
	return servers
}

let editingIceIndex: number = 0

const configIce = document.getElementById('config-ice') as HTMLButtonElement
const configIceDialog = document.getElementById('config-ice-dialog') as HTMLDialogElement

const importIceInput = document.getElementById('import-ice-input') as HTMLInputElement
const importForm = document.getElementById('import-form') as HTMLFormElement

const iceServerContainer = document.getElementById('ice-server-container') as HTMLDivElement

const newServer = document.getElementById('new-server') as HTMLButtonElement
const iceReset = document.getElementById('ice-reset') as HTMLButtonElement
const exportIceButton = document.getElementById('export-ice-button') as HTMLButtonElement

const addIceDialog = document.getElementById('add-ice-dialog') as HTMLDialogElement
const iceUrl = document.getElementById('ice-url') as HTMLInputElement
const iceUsername = document.getElementById('ice-username') as HTMLInputElement
const icePassword = document.getElementById('ice-password') as HTMLInputElement

const exportIceDialog = document.getElementById('export-ice-dialog') as HTMLDialogElement
const exportJson = document.getElementById('export-ice-json') as HTMLElement
const exportUrl = document.getElementById('export-ice-url') as HTMLElement
const copyJson = document.getElementById('copy-ice-json') as HTMLButtonElement
const copyUrl = document.getElementById('copy-ice-url') as HTMLButtonElement

const params = new URLSearchParams(location.search)
const lockedServers = params.get('servers')
if (lockedServers) {
	configIce.hidden = true
	iceServerConfig = iceServersToData(JSON.parse(lockedServers))
} else {
	setServerData(readServerData() || getDefaultServerData())
}

closeDialogOnClickOutside(configIceDialog)
closeDialogOnClickOutside(addIceDialog)
closeDialogOnClickOutside(exportIceDialog)

configIce.addEventListener('click', () => {
	// Prevent bringing up mobile virtual keyboard
	importIceInput.readOnly = true
	openDialogModal(configIceDialog)
	// Firefox mobile will bring up virtual keyboard if we don't do this immediately
	// Chrome and Safari are the opposite...
	if (navigator.userAgent.includes('Firefox')) {
		importIceInput.readOnly = false
	}
	requestAnimationFrame(() => {
		importIceInput.readOnly = false
	})
})

importForm.addEventListener('submit', (ev) => {
	ev.preventDefault()
	try {
		// Guess we'll have to trust the user to not throw in bad data
		// since I'm too lazy to do the validation
		const parsed = JSON.parse(importIceInput.value)
		if (Array.isArray(parsed)) {
			// Better batch update then save all
			for (const server of parsed) {
				addServerData(server)
			}
		} else {
			throw Error('Not an array')
		}
		importIceInput.value = ''
	} catch (error) {
		importIceInput.setCustomValidity(`Invalid JSON\n${error}`)
		importIceInput.reportValidity()
	}
})
function removeInvalid(this: HTMLInputElement) {
	this.setCustomValidity('')
}
importIceInput.addEventListener('input', removeInvalid)
importIceInput.addEventListener('blur', removeInvalid)

newServer.addEventListener('click', () => {
	editingIceIndex = iceServerConfig.length
	setIceFormValues()
	openDialogModal(addIceDialog)
})
addIceDialog.addEventListener('submit', async (ev) => {
	const server: IceServer = {
		urls: iceUrl.value.trim(),
		username: iceUsername.value.trim() || undefined,
		credential: icePassword.value.trim() || undefined,
	}
	if (editingIceIndex < iceServerConfig.length) {
		editServerData(editingIceIndex, server)
	} else {
		addServerData(server)
	}
})
function validateInput() {
	const required = iceUrl.value.startsWith('turn')
	iceUsername.required = required
	icePassword.required = required
}
iceUrl.addEventListener('input', validateInput)

iceReset.addEventListener('click', async (ev) => {
	const choice = confirm('Are you sure you want to reset ice servers to default?')
	if (choice) {
		resetServerData()
	}
})

exportIceButton.addEventListener('click', () => {
	openDialogModal(exportIceDialog)

	const servers = JSON.stringify(getIceServers())
	exportJson.innerText = servers

	const url = new URL(location.href)
	url.searchParams.set('servers', servers)
	exportUrl.innerText = url.toString()
})
attachCopyButton(copyJson, () => exportJson.innerText)
attachCopyButton(copyUrl, () => exportUrl.innerText)

function setIceFormValues(server?: IceServer) {
	if (server) {
		iceUrl.value = server.urls
		iceUsername.value = server.username || ''
		icePassword.value = server.credential || ''
	} else {
		iceUrl.value = ''
		iceUsername.value = ''
		icePassword.value = ''
	}
	validateInput()
}

function addIceServerEl(data: IceServerData) {
	const container = document.createElement('div')

	const label = document.createElement('label')
	const checkbox = document.createElement('input')
	const labelText = document.createElement('span')

	const buttonWrapper = document.createElement('div')
	const edit = createIconButton(mdiPencil)
	const remove = createIconButton(mdiDelete)

	label.translate = false

	checkbox.type = 'checkbox'
	checkbox.checked = data.enabled
	checkbox.addEventListener('change', () => {
		const index = [...iceServerContainer.children].indexOf(container)
		const data = iceServerConfig[index]
		data!.enabled = checkbox.checked
		saveServerData()
	})

	labelText.innerText = generateLabel(data.server)

	edit.type = 'button'
	edit.title = 'Edit'
	edit.addEventListener('click', () => {
		const index = [...iceServerContainer.children].indexOf(container)
		const server = iceServerConfig[index]!.server
		setIceFormValues(server)
		editingIceIndex = index
		openDialogModal(addIceDialog)
	})

	remove.type = 'button'
	remove.title = 'Remove'
	remove.addEventListener('click', () => {
		const choice = confirm(`Are you sure you want to delete '${labelText.innerText}'?`)
		if (choice) {
			const index = [...iceServerContainer.children].indexOf(container)
			iceServerConfig.splice(index, 1)
			saveServerData()
			iceServerContainer.removeChild(container)
		}
	})

	buttonWrapper.className = 'button-container'

	label.append(checkbox)
	label.append(labelText)
	buttonWrapper.append(edit)
	buttonWrapper.append(remove)
	container.append(label)
	container.append(buttonWrapper)
	iceServerContainer.append(container)
}

function iceServersToData(servers: IceServer[]): IceServerData[] {
	return servers.map((server) => ({
		server: server,
		enabled: true,
	}))
}

function getDefaultServerData(): IceServerData[] {
	const defaultServers = [
		{
			urls: 'stun:stun.l.google.com:19302',
			enable: true,
		},
		{
			urls: 'stun:stun.qq.com',
			enable: true,
		},
		{
			urls: 'stun:stun.syncthing.net',
			enable: false,
		},
		{
			urls: 'stun:stunserver.stunprotocol.org',
			enable: false,
		},
	] as const
	return defaultServers.map((data) => {
		return {
			server: { urls: data.urls },
			enabled: data.enable,
		}
	})
}

function generateLabel(server: IceServer) {
	return server.username
		? `${server.urls} [${server.username}:${server.credential}]`
		: `${server.urls}`
}

function setServerData(data: IceServerData[]) {
	iceServerConfig = data
	iceServerContainer.innerHTML = ''
	for (const data of iceServerConfig) {
		addIceServerEl(data)
	}
}

function editServerData(index: number, server: IceServer) {
	const labelText = iceServerContainer.children[index]!.querySelector('span')!
	labelText.innerText = generateLabel(server)
	iceServerConfig[index]!.server = server
	saveServerData()
}

function addServerData(server: IceServer) {
	const data: IceServerData = {
		server,
		enabled: true,
	}
	iceServerConfig.push(data)
	addIceServerEl(data)
	saveServerData()
}

function saveServerData() {
	localStorage.setItem(SERVER_SAVE_KEY, JSON.stringify(iceServerConfig))
}

// Need a better way to validate and handle/upgrade old data
function readServerData(): IceServerData[] | undefined {
	const data = localStorage.getItem(SERVER_SAVE_KEY)
	if (data) {
		const parsed = JSON.parse(data) as unknown
		// It's a single server data before
		if (Array.isArray(parsed)) {
			// Was `IceServer[]` before
			let servers = parsed as IceServer[] | IceServerData[]
			const firstServer = servers[0]
			if (!firstServer) {
				return servers as IceServerData[]
			}
			if ('server' in firstServer) {
				return servers as (typeof firstServer)[]
			} else {
				return iceServersToData(servers as (typeof firstServer)[])
			}
		} else {
			let server = parsed as IceServer
			const servers = getDefaultServerData()
			servers.push({
				server: server,
				enabled: true,
			})
			return servers
		}
	}
}

function resetServerData() {
	setServerData(getDefaultServerData())
	localStorage.removeItem(SERVER_SAVE_KEY)
}
