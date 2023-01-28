import 'iconify-icon'
import { IconifyIconHTMLElement } from 'iconify-icon'

export function createIcon(iconName: IconifyIconHTMLElement['icon']) {
	const el = document.createElement('iconify-icon')
	el.icon = iconName
	return el
}
