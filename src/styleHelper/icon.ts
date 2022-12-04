import 'iconify-icon'

export function createIcon(iconName: string) {
	const el = document.createElement('iconify-icon')
	el.setAttribute('icon', iconName)
	return el
}

export function changeIcon(icon: HTMLElement, iconName: string) {
	icon.setAttribute('icon', iconName)
}
