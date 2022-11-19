const SERVER_SAVE_KEY = 'ice-server-data'
export let iceServerConfig: RTCIceServer

const currentIce = document.getElementById('current-ice') as HTMLButtonElement
const iceSettingDialog = document.getElementById('ice-setting-dialog') as HTMLDialogElement

const iceUrl = document.getElementById('ice-url') as HTMLInputElement
const iceUsername = document.getElementById('ice-username') as HTMLInputElement
const icePassword = document.getElementById('ice-password') as HTMLInputElement

// const iceSet = document.getElementById('ice-set') as HTMLButtonElement
const iceReset = document.getElementById('ice-reset') as HTMLButtonElement

currentIce.addEventListener('click', (ev) => {
	iceSettingDialog.showModal()
})
iceSettingDialog.addEventListener('mousedown', (ev) => {
	if (ev.target === iceSettingDialog) {
		iceSettingDialog.close()
	}
})

iceSettingDialog.addEventListener('submit', async (ev) => {
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
	iceSettingDialog.close()
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
	localStorage.setItem(SERVER_SAVE_KEY, JSON.stringify(iceServerConfig))
}

function readServerData(): RTCIceServer | undefined {
	const data = localStorage.getItem(SERVER_SAVE_KEY)
	if (data) {
		return JSON.parse(data)
	}
}

function resetServerData() {
	setServerData(getDefaultServerData())
	localStorage.removeItem(SERVER_SAVE_KEY)
}
