const { 
    BrowserWindow,
    dialog,
    Notification
}                  = require('@electron/remote')
const fs           = require('fs')
const path         = require('path')
const moment       = require('moment')

const templates    = require('./js/templates')
const FileExplorer = require('./js/file-explorer')
const messageBox   = require('./js/message-box')
const localization = require('./js/localization')
const io           = require('../utils/io')

const authenticationTypes = ['ask', 'password', 'key']
const protocols = ['ftp', 'sftp']

const baseConfig = {
    servers: []
}

const clientTypes = {
    ftp: require('ftp'),
    sftp: require('ssh2-sftp-client')
}

io.createDirectory('./data/config/')
io.createDirectory('./data/temp/')

const appConfig = new io.ConfigFile('./data/config/config.json', baseConfig)
const knownHosts = new io.ConfigFile('./data/config/known-hosts.json')

knownHosts.add = (host, os) => {
    knownHosts.current[host] = os
    knownHosts.save()
}

knownHosts.find = (host) => {
    return knownHosts.current[host]
}

const osIcons = {
    'linux': 'fab fa-linux',
    'ubuntu': 'fab fa-ubuntu',
    'suse': 'fab fa-suse',
    'redhat': 'fab fa-redhat',
    'fedora': 'fab fa-fedora',
    'centos': 'fab fa-centos',
    'raspbian': 'fab fa-raspberry-pi',
    'raspberrypi': 'fab fa-raspberry-pi',
    'raspberry-pi': 'fab fa-raspberr-ypi',
    'windows': 'fab fa-windows',
    'unknown': 'fad fa-question-circle',
    'ftp': 'fas fa-server'
}

const getOSIcon = (type, os) => {
    return type == 'sftp' ? osIcons[os] || osIcons['unknown'] : osIcons['ftp']
}

const createClient = (type) => {
    switch (type) {
        case 'sftp':
            {
                const client = new clientTypes.sftp()
                client.original = {}
                client._get = client.get
                client._put = client.put
                client.currentDir = client.cwd
                client.getOS = async () => {
                    const resultRegex = /Distributor ID:(?: +|\t+)(.+)/g
                    
                    return new Promise((resolve, reject) => {
                        var resolved = false

                        client.client.exec('lsb_release -i', (err, stream) => {
                            stream.on('data', (data) => {
                                const string = data.toString()
                                const match = resultRegex.exec(string)

                                if (!match) {
                                    return
                                }

                                resolved = true
                                resolve(match[1].toLowerCase())
                            })

                            stream.on('close', () => {
                                if (resolved) {
                                    return
                                }

                                client.client.exec('ver', (err, stream) => {
                                    stream.on('data', (data) => {
                                        const string = data.toString()

                                        if (!string.toLowerCase().match('microsoft')) {
                                            resolved = true
                                            resolve('unknown')
                                            return
                                        }

                                        resolved = true
                                        resolve('windows')
                                    })

                                    stream.on('close', () => {
                                        if (resolved) {
                                            return
                                        }

                                        resolve('unknown')
                                    })
                                })
                            })
                        })
                    })
                }

                return client
            }
        case 'ftp':
        default:
            {
                const client = new clientTypes.ftp()
                client._connect = client.connect
                client._get = client.get
                client.currentDir = client.pwd
                client.getOS = () => {
                    return 'ftp'
                }

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

const validateServer = (server) => {
    if (!server.host) {
        return 'Host cannot be empty'
    }

    if (!authenticationTypes.includes(server.authtype)) {
        return 'Invalid authentication type'
    }
    
    if (!protocols.includes(server.protocol)) {
        return 'Invalid protocol'
    }

    if (server.protocol != 'sftp' && server.authtype == 'key') {
        return 'Invalid Authentication type'
    }

    if (server.authtype == 'key' && !server.key) {
        return 'Private key cannot be empty'
    }

    if (server.authtype == 'key' && !fs.existsSync(server.key)) {
        return 'Private key file does not exist'
    }

    if (!server.username) {
        return 'Username cannot be empty'
    }

    if (server.authtype == 'password' && !server.password) {
        return 'Password cannot be empty'
    }
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
    const connectWrap = (config, element) => {
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
                connect(config, element)
            })

            return
        }

        connect(config, element)
    }

    const addServer = (config) => {
        const name = config.name || config.host
        const os = knownHosts.find(config.host)
        const osText = `${os ? `${os}, ${config.protocol}` : config.protocol}`
        const date = moment(config.lastConnection).fromNow()
        const element = htmlElement(templates['server'](name, osText, getOSIcon(config.protocol, os), date))
        element.config = config

        const deleteButton = element.querySelector('[delete-btn]')
        const editButton = element.querySelector('[edit-btn]')

        deleteButton.addEventListener('click', () => {
            messageBox({
                title: 'SL_DELETE_SERVER'.t,
                text: 'SL_DELETE_SERVER_FORMAT'.mf(name).cc
            }, (result) => {
                if (!result) {
                    return
                }

                element.remove()
                const index = appConfig.current.servers.findIndex(server => new Date(server.date) - 0 == new Date(config.date) - 0)
                appConfig.current.servers.splice(index, 1)
                appConfig.save()
            })
        })

        editButton.addEventListener('click', async () => {
            const box = await messageBox({
                title: 'Edit server',
                text: templates['addserver'](),
                buttons: {
                    yes: 'Ok',
                    no: 'Cancel'
                }
            }, (result) => {
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
                    date: config.date,
                    lastConnection: new Date()
                }

                const error = validateServer(server)
                if (error) {
                    box.error(error)
                    return true
                }
    
                const index = appConfig.current.servers.findIndex((server) => new Date(server.date) - 0 == new Date(config.date) - 0)
                appConfig.current.servers[index] = server
                appConfig.save()
                element.remove()
                addServer({...server})
            })
    
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

            nameInput.value = config.name
            hostInput.value = config.host
            protocolSelect.value = config.protocol
            authTypeSelect.value = config.authtype
            usernameInput.value = config.username
            passwordInput.value = config.password
            keyInput.value = config.key
            keyInput.value = config.key
    
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

        element.addEventListener('dblclick', (e) => {
            if (e.target.className.match('server-button')) {
                return
            }

            connectWrap(config, element)
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

    var serverSort = 'date'
    const serverSortFunctions = {
        'date': (a, b) => {
            return new Date(b.config.date) - new Date(a.config.date)
        },
        'name': (a, b) => {
            return a.innerText.localeCompare(b.innerText)
        }
    }

    const sortServers = () => {
        const servers = Array.from(serverList.children)
        const query = searchBox.innerText.trim().toLowerCase()
        const sortedServers = servers.sort(serverSortFunctions[serverSort])

        for (const server of sortedServers) {
            server.parentNode.appendChild(server)

            if (!server.innerText.toLowerCase().match(query)) {
                server.style.display = 'none'
            } else {
                server.style.display = ''
            }
        }
    }

    const serverNameSort = document.querySelector('[server-name-sort]')
    const serverDateSort = document.querySelector('[server-date-sort]')
    serverNameSort.addEventListener('change', () => {
        serverSort = serverNameSort.checked ? 'name' : 'date'
        sortServers()
    })

    serverDateSort.addEventListener('change', () => {
        serverSort = serverDateSort.checked ? 'date' : 'name'
        sortServers()
    })

    const searchBox = document.querySelector('[search-server]')
    searchBox.addEventListener('input', sortServers)

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

            const error = validateServer(server)
            if (error) {
                box.error(error)
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
                date: new Date(),
                lastConnection: new Date(),
            }


            const error = validateServer(server)
            if (error) {
                box.error(error)
                return true
            }

            appConfig.current.servers.push(server)
            appConfig.save()
            addServer({...server})
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

    const connect = async (config, element) => 
    {
        const index = appConfig.current.servers.findIndex(server => new Date(server.date) - 0 == new Date(config.date) - 0)

        if (index != -1) {
            appConfig.current.servers[index].lastConnection = new Date()
            appConfig.save()
        }

        const container = document.querySelector('.content-right')
        container.querySelector('.explorer-container').remove()
        const client = createClient(config.type)
        const fileExplorer = new FileExplorer(container, client)

        print('CLIENT_CONNECT'.mf(config.host))
        client.connect(config)
        .then(async () => {
            const os = await client.getOS()
            const icon = element.querySelector('.server-icon')
            const osTextEl = element.querySelector('.server-os')

            const osText = `${os ? `${os}, ${config.protocol}` : config.protocol}`

            icon.className = `${getOSIcon(config.protocol, os)} server-icon`
            osTextEl.innerText = osText

            knownHosts.add(config.host, os)

            print('CLIENT_CONNECT_SUCCESS'.mf(config.host))
            fileExplorer.currentDirectory = await client.currentDir()
            fileExplorer.listFiles()
        })
        .catch(err => {
            error('CLIENT_CONNECT_FAIL'.mf(config.host, baseErrorMessage(err)))
        })
    }

    const validServers = appConfig.current.servers.filter((server) => {
        return !validateServer(server)
    })

    validServers.forEach((server) => {
        addServer({...server})
    })
})