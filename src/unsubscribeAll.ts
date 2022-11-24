import { Unsubscribe } from 'firebase/database'

const unsubFunctions = new Set<Unsubscribe>()

export function registerUnsub(fn: Unsubscribe) {
	unsubFunctions.add(fn)
	return fn
}

export function unsubscribeAll() {
	for (const fn of unsubFunctions) {
		fn()
	}
	unsubFunctions.clear()
}
