const { Transformer } = require('@parcel/plugin')
const posthtml = require('posthtml')
const { render } = require('posthtml-render')
const { loadNodeIcon } = require('@iconify/utils/lib/loader/node-loader.cjs')

async function loadIcon(fullname, separator) {
	const [prefix, name] = fullname.split(separator)
	const svg = await loadNodeIcon(prefix, name)
	if (!svg) {
		throw Error(`Can't find an icon matching ${fullname}`)
	}
	return svg
}

module.exports = new Transformer({
	async parse({ asset }) {
		if (asset.type !== 'html') {
			return
		}
		const posthtmlInst = posthtml()
		return {
			type: posthtmlInst.name,
			version: posthtmlInst.version,
			program: (await posthtmlInst.process(await asset.getCode())).tree,
		}
	},

	async transform({ asset }) {
		if (asset.type === 'html') {
			const ast = await asset.getAST()
			const icons = new Set()
			ast.program.match({ tag: 'iconify-icon' }, (node) => {
				const iconName = node?.attrs?.icon
				if (!iconName) {
					throw Error('No icon name provided')
				}
				icons.add(iconName)
				return node
			})
			const iconMap = new Map()
			const promises = []
			for (const iconName of icons) {
				promises.push(
					(async () => {
						iconMap.set(iconName, await loadIcon(iconName, ':'))
					})()
				)
			}
			await Promise.all(promises)
			ast.program.match({ tag: 'iconify-icon' }, (node) => iconMap.get(node.attrs.icon))
			asset.setAST(ast)
		} else if (asset.pipeline === 'iconify-icon') {
			asset.bundleBehavior = 'inline'
			asset.meta.inlineType = 'string'
			asset.setCode(await loadIcon(await asset.getCode(), '/'))
		}
		return [asset]
	},

	generate({ asset, ast }) {
		if (asset.type === 'html') {
			return {
				content: render(ast.program),
			}
		}
	},
})
