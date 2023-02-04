import { closeDialogOnClickOutside, openDialogModal } from './styleHelper/dialog'
import { createIconButton } from './styleHelper/iconButton'

type IceServerData = Omit<RTCIceServer, 'urls'> & {
	urls: string
	enabled: boolean
}

const SERVER_SAVE_KEY = 'ice-server-data'
let iceServerConfig: IceServerData[] = []

export function getIceServers() {
	const servers: RTCIceServer[] = []
	for (const server of iceServerConfig) {
		if (server.enabled) {
			servers.push(server)
		}
	}
	return servers
}

let editingIceIndex: number = 0

const iceServerContainer = document.getElementById('ice-server-container') as HTMLDivElement
const configIce = document.getElementById('config-ice') as HTMLButtonElement
const configIceDialog = document.getElementById('config-ice-dialog') as HTMLDialogElement
const newServer = document.getElementById('new-server') as HTMLButtonElement

const addIceDialog = document.getElementById('add-ice-dialog') as HTMLDialogElement

const iceUrl = document.getElementById('ice-url') as HTMLInputElement
const iceUsername = document.getElementById('ice-username') as HTMLInputElement
const icePassword = document.getElementById('ice-password') as HTMLInputElement

// const iceAdd = document.getElementById('ice-add') as HTMLButtonElement
const iceReset = document.getElementById('ice-reset') as HTMLButtonElement

closeDialogOnClickOutside(configIceDialog)
closeDialogOnClickOutside(addIceDialog)

configIce.addEventListener('click', (ev) => {
	openDialogModal(configIceDialog)
})
newServer.addEventListener('click', (ev) => {
	editingIceIndex = iceServerConfig.length
	setIceFormValues()
	openDialogModal(addIceDialog)
})

addIceDialog.addEventListener('submit', async (ev) => {
	const data: IceServerData = {
		urls: iceUrl.value.trim(),
		username: iceUsername.value.trim() || undefined,
		credential: icePassword.value.trim() || undefined,
		enabled: true,
	}
	if (editingIceIndex < iceServerConfig.length) {
		editServerData(editingIceIndex, data)
	} else {
		addServerData(data)
	}
})
iceReset.addEventListener('click', async (ev) => {
	const choice = confirm('Are you sure you want to reset ice servers to default?')
	if (choice) {
		resetServerData()
	}
})

function validateInput() {
	const required = iceUrl.value.startsWith('turn')
	iceUsername.required = required
	icePassword.required = required
}
iceUrl.addEventListener('input', validateInput)

setServerData(readServerData() || getDefaultServerData())

function setIceFormValues(data?: IceServerData) {
	if (data) {
		iceUrl.value = data.urls as string
		iceUsername.value = data.username || ''
		icePassword.value = data.credential || ''
	} else {
		iceUrl.value = ''
		iceUsername.value = ''
		icePassword.value = ''
	}
	validateInput()
}

function addIceServerEl(data: IceServerData) {
	const container = document.createElement('div')

	const labelWrapper = document.createElement('div')
	const checkbox = document.createElement('input')
	const label = document.createElement('label')

	const buttonWrapper = document.createElement('div')
	const edit = createIconButton('mdi:pencil')
	const remove = createIconButton('mdi:delete')

	const labelText = generateLabel(data)
	const labelId = `ice-item-${labelText}`

	checkbox.type = 'checkbox'
	checkbox.id = labelId
	checkbox.checked = data.enabled
	checkbox.addEventListener('change', () => {
		const index = [...iceServerContainer.children].indexOf(container)
		const data = iceServerConfig[index]
		data!.enabled = checkbox.checked
		saveServerData()
	})

	label.htmlFor = labelId
	label.innerText = labelText
	label.translate = false

	edit.type = 'button'
	edit.title = 'Edit'
	edit.addEventListener('click', () => {
		const index = [...iceServerContainer.children].indexOf(container)
		const data = iceServerConfig[index]
		setIceFormValues(data)
		editingIceIndex = index
		openDialogModal(addIceDialog)
	})

	remove.type = 'button'
	remove.title = 'Remove'
	remove.addEventListener('click', () => {
		const choice = confirm(`Are you sure you want to delete '${label.innerText}'?`)
		if (choice) {
			const index = [...iceServerContainer.children].indexOf(container)
			iceServerConfig.splice(index, 1)
			saveServerData()
			iceServerContainer.removeChild(container)
		}
	})

	labelWrapper.className = 'label-container'
	buttonWrapper.className = 'button-container'

	labelWrapper.appendChild(checkbox)
	labelWrapper.appendChild(label)
	buttonWrapper.appendChild(edit)
	buttonWrapper.appendChild(remove)
	container.appendChild(labelWrapper)
	container.appendChild(buttonWrapper)
	iceServerContainer.appendChild(container)
}

function getDefaultServerData(): IceServerData[] {
	return [
		{
			urls: 'stun:stun.syncthing.net',
			enabled: true,
		},
		{
			urls: 'stun:stun.stunprotocol.org',
			enabled: true,
		},
		{
			urls: 'stun:stun.l.google.com:19302',
			enabled: true,
		},
		{
			urls: 'stun:stun.qq.com',
			enabled: true,
		},
	]
}

function generateLabel(data: IceServerData) {
	return data.username ? `${data.urls} [${data.username}:${data.credential}]` : `${data.urls}`
}

function setServerData(data: IceServerData[]) {
	iceServerConfig = data
	iceServerContainer.innerHTML = ''
	for (const data of iceServerConfig) {
		addIceServerEl(data)
	}
}

function editServerData(index: number, data: IceServerData) {
	const label = iceServerContainer.children[index]!.querySelector('label')!
	label.innerText = generateLabel(data)
	iceServerConfig.splice(index, 1, data)
	saveServerData()
}

function addServerData(data: IceServerData) {
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
		const parsed = JSON.parse(data)
		// It's a single server data before
		if (Array.isArray(parsed)) {
			// Handle old data without `enabled field`
			for (const server of parsed) {
				if (server.enabled === undefined) {
					server.enabled = true
				}
			}
			return parsed
		} else {
			const servers = getDefaultServerData()
			parsed.enabled = true
			servers.push(parsed)
			return servers
		}
	}
}

function resetServerData() {
	setServerData(getDefaultServerData())
	localStorage.removeItem(SERVER_SAVE_KEY)
}
