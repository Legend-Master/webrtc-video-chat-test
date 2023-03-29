const { Transformer } = require('@parcel/plugin')
const PostHTML = require('posthtml')
const { render } = require('posthtml-render')
const { loadNodeIcon } = require('@iconify/utils/lib/loader/node-loader.cjs') // Parcel got some problems without the .cjs extension

async function addXmlns(svg) {
	const parsed = await PostHTML().process(svg)
	parsed.tree[0].attrs['xmlns'] = 'http://www.w3.org/2000/svg'
	return render(parsed.tree)
}

async function loadIcon(fullname, separator) {
	const [prefix, name] = fullname.split(separator)
	const svg = await loadNodeIcon(prefix, name)
	if (!svg) {
		throw Error(`Can't find an icon matching ${fullname}`)
	}
	return await addXmlns(svg)
}

module.exports = new Transformer({
	async parse({ asset }) {
		if (asset.type !== 'html') {
			return
		}
		const postHtml = PostHTML()
		return {
			type: postHtml.name,
			version: postHtml.version,
			program: (await postHtml.process(await asset.getCode())).tree,
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
			const code = await loadIcon(await asset.getCode(), '/')
			asset.setCode(
				asset.query.get('dataurl') ? `data:image/svg+xml,${encodeURIComponent(code)}` : code
			)
		}
		return [asset]
	},

	generate({ asset, ast }) {
		return {
			content: asset.type === 'html' ? render(ast.program) : '',
		}
	},
})
