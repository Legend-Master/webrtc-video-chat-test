import { videoResolution } from './selectDevice'

type UpdateParameterFunction = (
	parameters: RTCRtpSendParameters,
	sender: RTCRtpSender
) => RTCRtpSendParameters

export async function updateParameters(pc: RTCPeerConnection, ...fns: UpdateParameterFunction[]) {
	const promises = []
	for (const sender of pc.getSenders()) {
		let parameters = sender.getParameters()
		for (const fn of fns) {
			parameters = fn(parameters, sender) ?? parameters
		}
		if (parameters) {
			promises.push(sender.setParameters(parameters))
		}
	}
	await Promise.all(promises)
}

function videoParameters(fn: UpdateParameterFunction): UpdateParameterFunction {
	return (parameters, sender) => {
		if (sender.track?.kind === 'video') {
			return fn(parameters, sender)
		}
		return parameters
	}
}

export const updateResolution = videoParameters((parameters, sender) => {
	for (const encoding of parameters.encodings) {
		const settings = sender.track!.getSettings()
		let height = settings.height ?? settings.width ?? 0
		if (settings.width && settings.height) {
			height = Math.min(settings.width, settings.height)
		}
		const scale = height / videoResolution
		encoding.scaleResolutionDownBy = scale > 1 ? scale : undefined
	}
	return parameters
})

export const updateDegradationPreference = videoParameters((parameters, sender) => {
	parameters.degradationPreference = 'maintain-resolution'
	return parameters
})

export async function updateAllParameters(pc: RTCPeerConnection) {
	await updateParameters(pc, updateDegradationPreference, updateResolution)
}
