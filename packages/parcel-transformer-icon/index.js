const { Transformer } = require('@parcel/plugin')
const posthtml = require('posthtml')
const { render } = require('posthtml-render')

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
						const [prefix, name] = iconName.split(':')
						const res = await fetch(`https://api.iconify.design/${prefix}/${name}.svg`)
						if (!res.ok) {
							throw Error(`Fetch icon ${iconName} failed, ${res}`)
						}
						text = await res.text()
						iconMap.set(iconName, (await posthtml().process(text)).tree[0])
					})()
				)
			}
			await Promise.all(promises)
			ast.program.match({ tag: 'iconify-icon' }, (node) => iconMap.get(node.attrs.icon))
			asset.setAST(ast)
		} else if (asset.pipeline === 'iconify-icon') {
			asset.bundleBehavior = 'inline'
			asset.meta.inlineType = 'string'
			const res = await fetch(`https://api.iconify.design/${await asset.getCode()}.svg`)
			if (!res.ok) {
				throw Error(`Fetch icon ${iconName} failed, ${res}`)
			}
			asset.setCode(await res.text())
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
