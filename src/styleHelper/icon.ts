const parser = new DOMParser()

export function createIcon(iconSvg: string) {
	return parser.parseFromString(iconSvg, 'image/svg+xml').documentElement
}
