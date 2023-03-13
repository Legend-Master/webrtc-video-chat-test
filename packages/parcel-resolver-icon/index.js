const { Resolver } = require('@parcel/plugin')
const path = require('path')

module.exports = new Resolver({
	async resolve({ pipeline, specifier }) {
		if (pipeline === 'iconify-icon') {
			return {
				filePath: path.join(__dirname, specifier),
				code: specifier
			}
		}
	},
})
