export function createIcon(iconSvg: string) {
	const template = document.createElement('template')
	template.innerHTML = iconSvg
	return template.content
}
