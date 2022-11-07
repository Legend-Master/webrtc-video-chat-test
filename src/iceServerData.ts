const serverSaveKey = 'ice-server-data'
export let iceServerConfig: RTCIceServer

const currentIce = document.getElementById('current-ice') as HTMLHeadingElement

const iceUrl = document.getElementById('ice-url') as HTMLInputElement
const iceUsername = document.getElementById('ice-username') as HTMLInputElement
const icePassword = document.getElementById('ice-password') as HTMLInputElement

const iceSet = document.getElementById('ice-set') as HTMLButtonElement
const iceReset = document.getElementById('ice-reset') as HTMLButtonElement

iceSet.addEventListener('click', async (ev) => {
	if (!iceUrl.value) {
		return
	}
	setServerData(
		{
			urls: iceUrl.value.trim(),
			username: iceUsername.value.trim(),
			credential: icePassword.value.trim(),
		},
		true
	)
	iceUrl.value = ''
	iceUsername.value = ''
	icePassword.value = ''
})
iceReset.addEventListener('click', async (ev) => {
	resetServerData()
})

setServerData(readServerData() || getDefaultServerData())

function getDefaultServerData() {
	return {
		urls: 'stun:stun.l.google.com:19302',
	}
}

function setServerData(data: RTCIceServer, save: boolean = false) {
	iceServerConfig = data
	currentIce.innerText = iceServerConfig.username
		? `${iceServerConfig.urls} [${iceServerConfig.username}:${iceServerConfig.credential}]`
		: `${iceServerConfig.urls}`
	if (save) {
		saveServerData()
	}
}

function saveServerData() {
	localStorage.setItem(serverSaveKey, JSON.stringify(iceServerConfig))
}

function readServerData(): RTCIceServer | undefined {
	const data = localStorage.getItem(serverSaveKey)
	if (data) {
		return JSON.parse(data)
	}
}

function resetServerData() {
	setServerData(getDefaultServerData())
	localStorage.removeItem(serverSaveKey)
}
