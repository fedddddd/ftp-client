const { 
    BrowserWindow,
    dialog
}                  = require('@electron/remote')
const fs           = require('fs')
const path         = require('path')

const templates    = require('./js/templates')
const FileExplorer = require('./js/file-explorer')
const messageBox   = require('./js/message-box')
const localization = require('./js/localization')

const authenticationTypes = ['ask', 'password', 'key']
const protocols = ['ftp', 'sftp']

const baseConfig = {
    servers: []
}

const clientTypes = {
    ftp: require('ftp'),
    sftp: require('ssh2-sftp-client')
}

const createClient = (type) => {
    switch (type) {
        case 'sftp':
            {
                const client = new clientTypes.sftp()
                client.original = {}
                client._get = client.get
                client._put = client.put
                client.get = client.fastGet
                client.put = client.fastPut
                client.currentDir = client.cwd

                return client
            }
        case 'ftp':
        default:
            {
                const client = new clientTypes.ftp()
                client._connect = client.connect
                client._get = client.get
                client.currentDir = client.pwd

                client.get = (source, destination) => {
                    client._get(source, (err, stream) => {
                        if (err) {
                            throw err
                        }

                        stream.pipe(fs.createWriteStream(destination))
                    })
                }

                client.connect = (config) => {
                    config.user = config.username

                    return new Promise((resolve, reject) => {
                        client.on('ready', () => {
                            resolve()
                        })

                        client._connect(config)
                    })
                }

                return client
            }
    }
}

const baseErrorMessage = (err) => {
    const message = err.message
    const split = message.split(':')
    return split[split.length - 1].trim()
}

const isChildOf = (parent, child) => {
    var node = child.parentNode

    while (node != null) {
        if (node == parent) {
            return true
        }

        node = node.parentNode
    }

    return false
}

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

const print = (text) => {
    const log = document.querySelector('.log')

    log.appendChild(htmlElement(colorCode(text)))
    log.scrollTop = log.scrollHeight
}

const error = (text) => {
    text = `^1${text}`

    const log = document.querySelector('.log')

    log.appendChild(htmlElement(colorCode(text)))
    log.scrollTop = log.scrollHeight
}

//process.on('uncaughtException', error)
//process.on('unhandledRejection', error)

const readConfig = () => {
    if (!fs.existsSync('./data/config/')) {
        fs.mkdirSync('./data/config/', {recursive: true})
    }

    if (!fs.existsSync('./data/config/config.json')) {
        fs.writeFileSync('./data/config/config.json', JSON.stringify(baseConfig))
    }

    return {...baseConfig, ...JSON.parse(fs.readFileSync('./data/config/config.json'))}
}

document.addEventListener('DOMContentLoaded', async () => {
    const closeButton = document.querySelector('.button-red')
    const minimizeButton = document.querySelector('.button-yellow')
    const maximizeButton = document.querySelector('.button-green')

    const horizontalScrollables = Array.from(document.querySelectorAll('[horizontal-scrolling]'))
    horizontalScrollables.forEach(element => {
        element.addEventListener('wheel', (e) => {
            e.preventDefault()
            element.scrollLeft += e.deltaY
        })
    })
    
    const serverList = document.querySelector('[server-list]')
    const connectWrap = (config) => {
        config.type = config.protocol

        if (config.authtype == 'key') {
            config.privateKey = fs.readFileSync(config.key)
        }

        if (config.authtype == 'ask') {
            messageBox({
                title: 'Insert password',
                buttons: {
                    yes: 'Connect',
                    no: 'Cancel'
                },
                inputs: [
                    [
                        {
                            name: 'Password',
                            type: 'password',
                            id: 'password',
                            placeholder: 'Password'
                        }
                    ]
                ]
            }, (result, inputs) => {
                if (!result) {
                    return
                }

                config.password == inputs.password
                connect(config)
            })

            return
        }

        connect(config)
    }

    const addServer = (config) => {
        const name = config.name || config.host
        const element = htmlElement(templates['server'](name, ''))

        element.addEventListener('click', () => {
            connectWrap(config)
        })

        serverList.prepend(element)
    }

    const textBoxes = document.querySelectorAll('[contenteditable=true]')
    textBoxes.forEach(box => {
        box.addEventListener('paste', (e) => {
            e.preventDefault()
            const text = (e.originalEvent || e).clipboardData.getData('text/plain')
            document.execCommand('insertHTML', false, text)
        })

        box.addEventListener('keydown', (e) => {
            if (e.key == 'Enter') {
                e.preventDefault()
            }
        })
    })

    const searchBox = document.querySelector('[search-server]')
    searchBox.addEventListener('input', () => {
        const servers = Array.from(serverList.children)
        const query = searchBox.innerText.trim().toLowerCase()

        for (const server of servers) {
            if (!server.innerText.toLowerCase().match(query)) {
                server.style.display = 'none'
            } else {
                server.style.display = 'block'
            }
        }
    })

    const connectButton = document.querySelector('[connect-btn]')
    connectButton.addEventListener('click', async () => {
        const box = await messageBox({
            title: 'Connect to server',
            text: templates['connect'](),
            buttons: {
                yes: 'Add',
                no: 'Cancel'
            }
        }, (result) => {
            if (!result) {
                return
            }

            const server = {
                host: hostInput.value,
                protocol: protocolSelect.value,
                authtype: authTypeSelect.value,
                username: usernameInput.value,
                password: passwordInput.value,
                key: keyInput.value,
            }

            if (!server.host) {
                box.error('Host cannot be empty')
                return true
            }

            if (!authenticationTypes.includes(server.authtype)) {
                box.error('Invalid authentication type')
                return true
            }
            
            if (!protocols.includes(server.protocol)) {
                box.error('Invalid protocol')
                return true
            }

            if (server.protocol != 'sftp' && server.authtype == 'key') {
                box.error('Invalid Authentication type')
                return true
            }

            if (server.authtype == 'key' && !server.key) {
                box.error('Private key cannot be empty')
                return true
            }

            if (server.authtype == 'key' && !fs.existsSync(server.key)) {
                box.error('Private key file does not exist')
                return true
            }

            if (!server.username) {
                box.error('Username cannot be empty')
                return true
            }

            if (server.authtype == 'password' && !server.password) {
                box.error('Password cannot be empty')
                return true
            }

            connectWrap(server)
        })

        const browseButton = box.querySelector('.server-settings-browse-btn')
        const hostInput = box.querySelector('[input-host]')
        const protocolSelect = box.querySelector('[input-protocol]')
        const keySelect = box.querySelector('.server-settings-key')
        const keyOption = box.querySelector('[key-option]')
        const keyInput = box.querySelector('[input-key]')
        const usernameInput = box.querySelector('[input-username]')
        const passwordInput = box.querySelector('[input-password]')
        const authTypeSelect = box.querySelector('[input-auth-type]')

        browseButton.addEventListener('click', () => {
            dialog.showOpenDialog()
            .then(result => {
                keyInput.value = result.filePaths[0] || ''
            })
        })

        const updateProtocol = () => {
            if (protocolSelect.value == 'ftp') {
                keyOption.style.display = 'none'
                keyOption.selected = false
                protocolSelect.firstChild.selected = true
                updateAuthType()
            } else {
                keyOption.style.display = 'block'
            }
        }

        const updateAuthType = () => {
            keySelect.style.display = authTypeSelect.value == 'key'
                ? 'flex'
                : 'none'

            passwordInput.style.display = authTypeSelect.value == 'password'
                ? 'block'
                : 'none'
        }

        updateAuthType()
        updateProtocol()
        authTypeSelect.addEventListener('change', updateAuthType)
        protocolSelect.addEventListener('change', updateProtocol)
    })

    const addServerButton = document.querySelector('[add-server-btn]')
    addServerButton.addEventListener('click', async () => {
        const box = await messageBox({
            title: 'Add server',
            text: templates['addserver'](),
            buttons: {
                yes: 'Add',
                no: 'Cancel'
            }
        }, (result) => {
            errorText.innerText = null

            if (!result) {
                return
            }

            const server = {
                name: nameInput.value,
                host: hostInput.value,
                protocol: protocolSelect.value,
                authtype: authTypeSelect.value,
                username: usernameInput.value,
                password: passwordInput.value,
                key: keyInput.value,
                date: new Date()
            }

            if (!server.host) {
                box.error('Host cannot be empty')
                return true
            }

            if (!authenticationTypes.includes(server.authtype)) {
                box.error('Invalid authentication type')
                return true
            }
            
            if (!protocols.includes(server.protocol)) {
                box.error('Invalid protocol')
                return true
            }

            if (server.protocol != 'sftp' && server.authtype == 'key') {
                box.error('Invalid Authentication type')
                return true
            }

            if (server.authtype == 'key' && !server.key) {
                box.error('Private key cannot be empty')
                return true
            }

            if (server.authtype == 'key' && !fs.existsSync(server.key)) {
                box.error('Private key file does not exist')
                return true
            }

            if (server.authtype == 'password' && !server.password) {
                box.error('Password cannot be empty')
                return true
            }

            if (!server.username) {
                box.error('Username cannot be empty')
                return true
            }

            const config = readConfig()
            config.servers.push(server)
            fs.writeFileSync('./data/config/config.json', JSON.stringify(config, null, 4))

            addServer(server)
        })

        const errorText = box.querySelector('[error]')
        const browseButton = box.querySelector('.server-settings-browse-btn')
        const nameInput = box.querySelector('[input-name]')
        const hostInput = box.querySelector('[input-host]')
        const protocolSelect = box.querySelector('[input-protocol]')
        const keySelect = box.querySelector('.server-settings-key')
        const keyOption = box.querySelector('[key-option]')
        const keyInput = box.querySelector('[input-key]')
        const usernameInput = box.querySelector('[input-username]')
        const passwordInput = box.querySelector('[input-password]')
        const authTypeSelect = box.querySelector('[input-auth-type]')

        browseButton.addEventListener('click', () => {
            dialog.showOpenDialog()
            .then(result => {
                keyInput.value = result.filePaths[0] || ''
            })
        })

        const updateProtocol = () => {
            if (protocolSelect.value == 'ftp') {
                keyOption.style.display = 'none'
                keyOption.selected = false
                protocolSelect.firstChild.selected = true
                updateAuthType()
            } else {
                keyOption.style.display = 'block'
            }
        }

        const updateAuthType = () => {
            keySelect.style.display = authTypeSelect.value == 'key'
                ? 'flex'
                : 'none'

            passwordInput.style.display = authTypeSelect.value == 'password'
                ? 'block'
                : 'none'
        }

        updateAuthType()
        updateProtocol()
        authTypeSelect.addEventListener('change', updateAuthType)
        protocolSelect.addEventListener('change', updateProtocol)
    })

    const win = BrowserWindow.getFocusedWindow()

    closeButton.addEventListener('click', () => {
        win.close()
    })
    
    minimizeButton.addEventListener('click', () => {
        win.minimize()
    })
    
    maximizeButton.addEventListener('click', () => {
        win.setFullScreen(!win.isFullScreen())
    })

    document.addEventListener('click', (e) => {
        const menu = document.querySelector('.contextmenu-container')

        if (!menu || isChildOf(menu, e.target) || menu == e.target) {
            return
        }

        menu.remove()
    })

    document.addEventListener('contextmenu', (e) => {
        const menu = document.querySelector('.contextmenu-container')
        menu && menu.remove()
    })

    if (!fs.existsSync('./data/')) {
        fs.mkdirSync('./data/')
    }

    const connect = async (config) => 
    {
        const container = document.querySelector('.content-right')
        container.querySelector('.explorer-container').remove()
        const client = createClient(config.type)
        const fileExplorer = new FileExplorer(container, client)

        print('CLIENT_CONNECT'.mf(config.host))
        client.connect(config)
        .then(async () => {
            print('CLIENT_CONNECT_SUCCESS'.mf(config.host))
            fileExplorer.currentDirectory = await client.currentDir()
            fileExplorer.listFiles()
        })
        .catch(err => {
            error('CLIENT_CONNECT_FAIL'.mf(config.host, baseErrorMessage(err)))
        })
    }

    const config = readConfig()
    
    for (const server of config.servers) {
        addServer(server)
    }
})