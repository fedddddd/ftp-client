const { I18n } = require('i18n')
const path     = require('path')

const i18n = new I18n({
    locales: ['en'],
    defaultLocale: 'en',
    directory: path.join(__dirname, '../../../locales')
})

const colorCode = (text) => {
    text = `^7${text}`

    const colorCodes = {
        '^1' : `style='color: #FF3131;font-weight: bold'`,
        '^2' : `style='font-weight: bold'`,
        '^3' : `style='font-weight: bold'`,
        '^4' : `style='font-weight: bold'`,
        '^5' : `style='font-weight: bold'`,
        '^6' : `style='font-weight: bold'`,
        '^7' : `style=''`,
    }

    const formattedText = text.replace(new RegExp(/\^([0-9]|\:|\;)/g, 'g'), (a) => {
        return `</span><span class='colorcode' ${colorCodes[a]}>`
    })

    return `<div>${formattedText.substr(7) + '</span>'}</div>`
}

Object.defineProperty(String.prototype, 'cc', {
    get: function () {
        return colorCode(String(this))
    }
})

Object.defineProperty(String.prototype, 't', {
    get: function () {
        return i18n.__(String(this).toUpperCase())
    }
})

String.prototype.mf = function () {
    return i18n.__mf.apply(i18n, [String(this).toUpperCase(), ...arguments])
}

module.exports = i18n