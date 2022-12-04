const SERVER_SAVE_KEY = 'ice-server-data'
export let iceServerConfig: RTCIceServer[] = []

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

configIce.addEventListener('click', (ev) => {
	configIceDialog.showModal()
})
newServer.addEventListener('click', (ev) => {
	editingIceIndex = iceServerConfig.length
	setIceFormValues()
	addIceDialog.showModal()
})
function dialogOnMouseDown(this: HTMLDialogElement, ev: MouseEvent) {
	if (ev.target === this) {
		this.close()
	}
}
configIceDialog.addEventListener('mousedown', dialogOnMouseDown)
addIceDialog.addEventListener('mousedown', dialogOnMouseDown)

addIceDialog.addEventListener('submit', async (ev) => {
	if (!iceUrl.value) {
		return
	}
	const data: RTCIceServer = {
		urls: iceUrl.value.trim(),
		username: iceUsername.value.trim(),
		credential: icePassword.value.trim(),
	}
	if (editingIceIndex < iceServerConfig.length) {
		editServerData(editingIceIndex, data)
	} else {
		addServerData(data)
	}
	setIceFormValues()
})
iceReset.addEventListener('click', async (ev) => {
	resetServerData()
})

function validateInput() {
	const required = iceUrl.value.startsWith('turn')
	iceUsername.required = required
	icePassword.required = required
}
iceUrl.addEventListener('input', validateInput)

setServerData(readServerData() || getDefaultServerData())

function setIceFormValues(data?: RTCIceServer) {
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

function createMaterialIcon(icon: string) {
	const el = document.createElement('iconify-icon')
	el.setAttribute('icon', icon)
	return el
}

function addIceServerEl(data: RTCIceServer) {
	const container = document.createElement('div')
	const label = document.createElement('span')
	const edit = document.createElement('button')
	const remove = document.createElement('button')
	const buttonWrapper = document.createElement('div')

	label.innerText = generateLabel(data)

	edit.type = 'button'
	edit.classList.add('icon-button')
	edit.appendChild(createMaterialIcon('mdi:edit'))
	edit.addEventListener('click', () => {
		const index = [...iceServerContainer.children].indexOf(container)
		const data = iceServerConfig[index]
		setIceFormValues(data)
		editingIceIndex = index
		addIceDialog.showModal()
	})

	remove.type = 'button'
	remove.classList.add('icon-button')
	remove.appendChild(createMaterialIcon('mdi:delete'))
	remove.addEventListener('click', () => {
		const index = [...iceServerContainer.children].indexOf(container)
		iceServerConfig.splice(index, 1)
		saveServerData()
		iceServerContainer.removeChild(container)
	})

	container.appendChild(label)
	container.appendChild(buttonWrapper)
	buttonWrapper.appendChild(edit)
	buttonWrapper.appendChild(remove)
	iceServerContainer.appendChild(container)
}

function getDefaultServerData(): RTCIceServer[] {
	return [
		{
			urls: 'stun:stun.syncthing.net',
		},
		{
			urls: 'stun:stun.stunprotocol.org',
		},
		{
			urls: 'stun:stun.l.google.com:19302',
		},
		{
			urls: 'stun:stun.qq.com',
		},
	]
}

function generateLabel(data: RTCIceServer) {
	return data.username ? `${data.urls} [${data.username}:${data.credential}]` : `${data.urls}`
}

function setServerData(data: RTCIceServer[]) {
	iceServerConfig = data
	iceServerContainer.innerHTML = ''
	for (const data of iceServerConfig) {
		addIceServerEl(data)
	}
}

function editServerData(index: number, data: RTCIceServer) {
	const label = iceServerContainer.children[index].querySelector('span')!
	label.innerText = generateLabel(data)
	iceServerConfig.splice(index, 1, data)
	saveServerData()
}

function addServerData(data: RTCIceServer) {
	iceServerConfig.push(data)
	addIceServerEl(data)
	saveServerData()
}

function saveServerData() {
	localStorage.setItem(SERVER_SAVE_KEY, JSON.stringify(iceServerConfig))
}

function readServerData(): RTCIceServer[] | undefined {
	const data = localStorage.getItem(SERVER_SAVE_KEY)
	if (data) {
		const parsed = JSON.parse(data)
		// It's a single server data before
		if (Array.isArray(parsed)) {
			return parsed
		} else {
			const servers = getDefaultServerData()
			servers.push(parsed)
			return servers
		}
	}
}

function resetServerData() {
	setServerData(getDefaultServerData())
	localStorage.removeItem(SERVER_SAVE_KEY)
}
