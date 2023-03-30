const { Resolver } = require('@parcel/plugin')
const path = require('path')

module.exports = new Resolver({
	async resolve({ pipeline, specifier, dependency }) {
		if (pipeline === 'iconify-icon') {
			// Pass dataurl option to transformer
			const query = dependency.specifierType === 'url' && new URLSearchParams({ dataurl: true })
			return {
				filePath: path.join(__dirname, specifier),
				code: specifier,
				query,
			}
		}
	},
})
