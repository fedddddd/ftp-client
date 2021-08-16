const { 
    BrowserWindow,
    dialog
}              = require('@electron/remote')
const filesize = require('filesize')
const fs       = require('fs')
const moment   = require('moment')
const open     = require('open')
const os       = require('os')
const path     = require('path')
const Mutex    = require('../utils/mutex')

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

const getFileIcon = (type, name) => {
    if (type != '-') {
        return 'fa-folder'
    }

    return 'fa-file'
}

const getFileSize = (type, size) => {
    if (type != '-') {
        return '——'
    }

    return filesize(size)
}

const templates = {
    'file': (data) => {
        return `
        <div class="file left-right-container" file-element>
            <div class="left">
                <i class="fas ${getFileIcon(data.type, data.name)} fa-1x file-icon"></i>
                <div class="file-name">${data.name}</div>
            </div>
            <div class="right">
                <div class="file-size">${getFileSize(data.type, data.size)}</div>
                <div class="file-date">${moment(data.date).fromNow()}</div>
            </div>
        </div>
        `
    },
    'back': () => {
        return `
        <div class="file left-right-container">
            <div class="left">
                <i class="fas fa-folder fa-1x file-icon"></i>
                <div class="file-name">..</div>
            </div>
            <div class="right">
            </div>
        </div>
        `
    },
    'contextmenu-container': () => {
        return `
            <div class='contextmenu-container'>
            </div>
        `
    },
    'contextmenu': () => {
        return `
            <div class='contextmenu'>
            </div>
        `
    },
    'contextmenu-entry': (text, icon) => {
        return `
            <div class='contextmenu-entry vertical-align'>
                <i class="fas ${icon} fa-1x contextmenu-icon"></i>
                <div>${text}</div>
            </div>
        `
    },
    'contextmenu-section': () => {
        return `
            <div class='contextmenu-section'>
            </div>
        `
    },
    'messagebox': (title, text, buttons) => {
        return `
            <div class='messagebox-container'>
                <div class='messagebox'>
                    <div class='messagebox-top'>
                        ${title}
                    </div>
                    <div class='messagebox-body'>
                        ${text}
                    </div>
                    <div class='messagebox-bottom'>
                        <div class='messagebox-button' no-btn>
                            ${buttons.no || 'No'}
                        </div>
                        <div class='messagebox-button' yes-btn>
                            ${buttons.yes || 'Yes'}
                        </div>
                    </div>
                </div>
            </div>
        `
    },
    'addserver': () => {
        return `
            <div class='left-right-container'>
                <div class='left server-settings'>
                    <div>Name</div>
                    <div>Protocol</div>
                    <div>Host</div>
                </div>
                <div class='right server-settings'>
                    <input class='form' input-name type='text' placeholder='(optional)'>
                    <select name='Protocol' input-protocol class='form select'>
                        <option value="ftp">FTP</option>
                        <option value="sftp">SFTP</option>
                    </select>
                    <input class='form' type='text' input-host placeholder='1.1.1.1'>
                </div>
            </div>
            <div class='line'></div>
            <div class='left-right-container'>
                <div class='left server-settings'>
                    <div>Authentication type</div>
                </div>
                <div class='right server-settings'>
                    <select name='Authentication type' input-auth-type class='form select'>
                        <option value="password">Password</option>
                        <option value="ask">Ask password</option>
                        <option value="key" key-option>Private key</option>
                    </select>
                    <input class='form' type='text' input-username placeholder='Username'>
                    <input class='form' type='password' input-password placeholder='Password'>
                    <div class='server-settings-key'>
                        <input type='text' input-key placeholder='Key file'>
                        <div class='server-settings-browse-btn' browse-btn>Browse</div>
                    </div>
                </div>
            </div>
        `
    },
    'connect': () => {
        return `
            <div class='left-right-container'>
                <div class='left server-settings'>
                    <div>Protocol</div>
                    <div>Host</div>
                </div>
                <div class='right server-settings'>
                    <select name='Protocol' input-protocol class='form select'>
                        <option value="ftp">FTP</option>
                        <option value="sftp">SFTP</option>
                    </select>
                    <input class='form' type='text' input-host placeholder='1.1.1.1'>
                </div>
            </div>
            <div class='line'></div>
            <div class='left-right-container'>
                <div class='left server-settings'>
                    <div>Authentication type</div>
                </div>
                <div class='right server-settings'>
                    <select name='Authentication type' input-auth-type class='form select'>
                        <option value="password">Password</option>
                        <option value="key" key-option>Private key</option>
                    </select>
                    <input class='form' type='text' input-username placeholder='Username'>
                    <input class='form' type='password' input-password placeholder='Password'>
                    <div class='server-settings-key'>
                        <input type='text' input-key placeholder='Key file'>
                        <div class='server-settings-browse-btn' browse-btn>Browse</div>
                    </div>
                </div>
            </div>
        `
    },
    'messagebox-input': () => {
        return `
            <div class='left-right-container'>
                <div class='left server-settings'>
                </div>
                <div class='right server-settings'>
                </div>
            </div>
        `
    },
    'server': (name, host) => {
            return `
                <div class='server'>
                    <div class='server-name'>
                        ${name}
                    </div>
                    <div class='server-hostname'>
                        ${host}
                    </div>
                </div>
            `
    },
    'directory': (name) => {
        return `
            <div class="directory">
                <div class="directory-name">
                    ${name}
                </div>
                <i class="fas fa-long-arrow-alt-right directory-arrow"></i>
            </div>
        `
    }
}

const messageBoxMutex = new Mutex()
window.messageBox = async (data = {}, _callback) => {
    callback = (result, inputs) => {
        box.clearError()

        if (typeof _callback == 'function') {
            if (!_callback(result, inputs)) {
                close()
            }
        } else {
            close()
        }
    }

    await messageBoxMutex.lock()

    const box = htmlElement(templates['messagebox'](data.title || '', data.text || '', data.buttons || {}))
    for (const key in data.style) {
        box.children[0].style[key] = data.style[key]
    }

    const body = box.querySelector('.messagebox-body')

    const close = () => {
        document.removeEventListener('keydown', onKeyDown)
        box.style.opacity = 0
        setTimeout(() => {
            box.remove()
            messageBoxMutex.unlock()
        }, 100)
    }

    box.querySelector('[yes-btn]').addEventListener('click', () => {
        callback(true, inputs)
    })

    box.querySelector('[no-btn]').addEventListener('click', () => {
        callback(false, inputs)
    })

    const inputs = {}
    var firstInput = null
    if (data.inputs) {
        data.inputs.forEach(section => {
            const container = htmlElement(templates['messagebox-input']())
            const left = container.querySelector('.left')
            const right = container.querySelector('.right')

            section.forEach(input => {
                left.appendChild(htmlElement(`
                    <div>${input.name}</div>
                `))

                const element = htmlElement(`
                    <input class='form' type='${input.type || 'text'}' ${input.id} placeholder='${input.placeholder || ''}'>
                `)

                firstInput = firstInput || element

                right.appendChild(element)

                element.addEventListener('input', () => {
                    inputs[input.id] = element.value.trim()
                })
            })

            body.appendChild(container)
            body.appendChild(htmlElement(`<div class='messagebox-section-line'></div>`))
        })
    }

    const errorMessage = htmlElement(`<div error class='server-settings-error'></div>`)
    body.appendChild(errorMessage)

    box.error = (message) => {
        errorMessage.style.display = 'block'
        errorMessage.innerText = message
    }

    box.clearError = () => {
        errorMessage.style.display = 'none'
        errorMessage.innerText = ''
    }

    const onKeyDown = (e) => {
        switch (e.key) {
            case 'Enter':
                callback(true, inputs)
                break
            case 'Escape':
                callback(false, inputs)
                break
        }
    }

    box.style.opacity = 0
    document.addEventListener('keydown', onKeyDown)
    document.querySelector('.content').appendChild(box)

    setTimeout(() => {
        box.style.opacity = 1

        if (firstInput) {
            firstInput.focus()
        }
    }, 10)

    return box
}

const createContextMenu = (sections) => {
    Array.from(document.querySelectorAll('.contextmenu-container')).forEach(menu => {
        menu.remove()
    })

    const container = htmlElement(templates['contextmenu-container']())
    const menu = htmlElement(templates['contextmenu']())
    container.appendChild(menu)

    for (const section of sections) {
        if (!section) {
            continue
        }

        const _section = htmlElement(templates['contextmenu-section']())
        menu.appendChild(_section)

        for (const entry of section) {
            const _entry = htmlElement(templates['contextmenu-entry'](entry.text, entry.icon))

            _entry.addEventListener('click', () => {
                if (typeof entry.callback == 'function') {
                    entry.callback()
                }

                container.remove()
            })

            _section.appendChild(_entry)
        }
    }

    document.body.appendChild(container)
    setTimeout(() => {
        container.style.opacity = 1
    }, 10)

    return container
}

const htmlElement = (html) => {
    const e = document.createElement('div')
    e.innerHTML = html.trim()

    return e.firstChild
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

const sortFunctions = {
    name: (list, reverse = false) => {
        const sort = (a, b) => {
            return a.name.localeCompare(b.name)
        }

        const folders = list.filter(file => file.type == 'd').sort(sort)
        const files = list.filter(file => file.type != 'd').sort(sort)

        return reverse
            ? [...files.reverse(), ...folders.reverse()]
            : [...folders, ...files]
    },
    date: (list, reverse = false) => {
        const sort = (a, b) => {
            const aTime = a.date || a.modifyTime
            const bTime = b.date || b.modifyTime
    
            return bTime - aTime
        }

        const folders = list.filter(file => file.type == 'd').sort(sort)
        const files = list.filter(file => file.type != 'd').sort(sort)

        return reverse
            ? [...files.reverse(), ...folders.reverse()]
            : [...folders, ...files]
    },
    size: (list, reverse = false) => {
        const sort = (a, b) => {
            return b.size - a.size
        }

        const folders = list.filter(file => file.type == 'd').sort(sort)
        const files = list.filter(file => file.type != 'd').sort(sort)

        return reverse
            ? [...files.reverse(), ...folders.reverse()]
            : [...folders, ...files]
    }
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
        const query = searchBox.innerText.trim()

        for (const server of servers) {
            if (!server.innerText.match(query)) {
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

    const directoryList = document.querySelector('.directory-list')
    const explorer = document.getElementById('explorer')
    explorer.currentFiles = []

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

    explorer.addEventListener('contextmenu', (e) => {
        if (!window.client) {
            return
        }

        fileExplorer.rightClickedItem = e.path.find(element => {
            if (typeof element.hasAttribute == 'function') {
                return element.hasAttribute('file-element')
            }
        })

        setTimeout(() => {
            const options = [
                [
                    {
                        text: 'Open',
                        icon: '',
                        callback: () => {
                            const file = fileExplorer.rightClickedItem.file
                            
                            if (file.type == '-') {
                                fileExplorer.open(file.name)
                            } else {
                                fileExplorer.listFiles(fileExplorer.currentDirectory + '/' + file.name + '/')
                            }
                        }
                    },
                    {
                        text: 'Download',
                        icon: 'fa-download',
                        callback: () => {

                        }
                    }
                ],
                [
                    {
                        text: 'Create new directory',
                        icon: 'fa-folder',
                        callback: async () => {
                            menu.remove()

                            const box = await messageBox({
                                title: 'Create new directory',
                                buttons: {
                                    yes: 'Create',
                                    no: 'Cancel'
                                },
                                inputs: [
                                    [
                                        {
                                            type: 'text',
                                            id: 'dirname',
                                            name: 'Directory name'
                                        }
                                    ]
                                ]
                            }, (result, inputs) => {
                                if (!result) {
                                    return
                                }

                                const dirname = inputs.dirname
                                if (!dirname) {
                                    box.error('Invalid directory name')
                                    return true
                                }

                                if (dirname.match(/(\\|\/)/g)) {
                                    box.error('Directory name cannot contain the following characters: \\, /')
                                    return true
                                }

                                if (dirname.startsWith('..')) {
                                    box.error('Directory name cannot start with ".."')
                                    return true
                                }

                                fileExplorer.createDirectory(dirname)
                                .then(() => {
                                    fileExplorer.listFiles(fileExplorer.currentDirectory)
                                })
                            })
                        }
                    },
                    {
                        text: 'Create new directory and enter it',
                        icon: 'fa-folder-open',
                        callback: async () => {
                            menu.remove()

                            const box = await messageBox({
                                title: 'Create new directory and enter it',
                                buttons: {
                                    yes: 'Create',
                                    no: 'Cancel'
                                },
                                inputs: [
                                    [
                                        {
                                            type: 'text',
                                            id: 'dirname',
                                            name: 'Directory name'
                                        }
                                    ]
                                ]
                            }, (result, inputs) => {
                                if (!result) {
                                    return
                                }

                                const dirname = inputs.dirname
                                if (!dirname) {
                                    box.error('Invalid directory name')
                                    return true
                                }

                                if (dirname.match(/(\\|\/)/g)) {
                                    box.error('Directory name cannot contain the following characters: \\, /')
                                    return true
                                }

                                if (dirname.startsWith('..')) {
                                    box.error('Directory name cannot start with ".."')
                                    return true
                                }

                                fileExplorer.createDirectory(dirname)
                                .then(() => {
                                    fileExplorer.listFiles(fileExplorer.currentDirectory + '/' + dirname)
                                })
                            })
                        }
                    },
                    {
                        text: 'Create new file',
                        icon: 'fa-edit'
                    },
                    {
                        text: 'Refresh',
                        icon: 'fa-sync-alt',
                        callback: () => {
                            fileExplorer.listFiles(fileExplorer.currentDirectory)
                        }
                    }
                ],
                [
                    {
                        text: 'Delete',
                        icon: 'fa-trash',
                        callback: () => {
                            for (const item of fileExplorer.selectedItems) {
                                fileExplorer.delete(item.file)
                                item.remove()
                            }
                        }
                    },
                    {
                        text: 'Rename',
                        icon: 'fa-tag'
                    }
                ],
            ]

            if (!fileExplorer.rightClickedItem) {
                options[0] = null
            }

            const menu = createContextMenu(options)
    
            menu.style.left = e.clientX
            menu.style.top = e.clientY
        }, 0)
    })

    const nameSort = document.querySelector('[sort-name]')
    const dateSort = document.querySelector('[sort-date]')
    const sizeSort = document.querySelector('[sort-size]')

    nameSort.addEventListener('click', () => {
        if (fileExplorer.sortFunction == 'name') {
            fileExplorer.reverseSort = !fileExplorer.reverseSort
        } else {
            fileExplorer.reverseSort = false
            fileExplorer.sortFunction = 'name'
        }

        fileExplorer.viewFiles()
    })

    dateSort.addEventListener('click', () => {
        if (fileExplorer.sortFunction == 'date') {
            fileExplorer.reverseSort = !fileExplorer.reverseSort
        } else {
            fileExplorer.reverseSort = false
            fileExplorer.sortFunction = 'date'
        }

        fileExplorer.viewFiles()
    })

    sizeSort.addEventListener('click', () => {
        if (fileExplorer.sortFunction == 'size') {
            fileExplorer.reverseSort = !fileExplorer.reverseSort
        } else {
            fileExplorer.reverseSort = false
            fileExplorer.sortFunction = 'size'
        }

        fileExplorer.viewFiles()
    })

    const updateItems = () => {
        for (const child of explorer.children) {
            child.style.backgroundColor = ''
        }

        for (const item of fileExplorer.selectedItems) {
            item.style.backgroundColor = 'rgba(90, 90, 90)'
        }
    }

    explorer.addFile = (file) => {
        explorer.currentFiles.push(file)
        const element = htmlElement(templates['file'](file))
        element.fileId = explorer.fileId++
        element.file = file

        element.addEventListener('dblclick', () => {
            if (file.type == '-') {
                fileExplorer.open(file.name)
            } else {
                fileExplorer.listFiles(fileExplorer.currentDirectory + '/' + file.name + '/')
            }
        })

        element.addEventListener('contextmenu', (e) => {
            if (!fileExplorer.selectedItems.find(item => item.fileId == element.fileId)) {
                fileExplorer.selectedItems = [element]
            }

            updateItems()
        })

        element.addEventListener('click', () => {
            if ((!keys['Shift'] && !keys['Control'])) {
                fileExplorer.selectedItems = []
                fileExplorer.selectedItems.push(element)
            } else if (keys['Shift'] && fileExplorer.selectedItems.length > 0) {
                const first = fileExplorer.selectedItems[0]
                fileExplorer.selectedItems = [first]
                    
                const start = first.fileId < element.fileId 
                    ? first.fileId
                    : element.fileId

                const end = first.fileId > element.fileId 
                    ? first.fileId
                    : element.fileId

                for (const child of explorer.children) {
                    if (child.fileId >= start && child.fileId <= end) {
                        if (fileExplorer.selectedItems.find(item => item.fileId == child.fileId)) {
                            continue
                        }

                        fileExplorer.selectedItems.push(child)
                    }
                }

            } else if (keys['Control']) {
                if (fileExplorer.selectedItems.find(item => item.fileId == element.fileId)) {
                    for (var i = 0; i < fileExplorer.selectedItems.length; i++) {
                        const item = fileExplorer.selectedItems[i]
                        if (item.fileId == element.fileId) {
                            fileExplorer.selectedItems.splice(i, 1)
                        }
                    }
                } else {
                    fileExplorer.selectedItems.push(element)
                }
            }

            updateItems()
        })

        explorer.appendChild(element)
        return element
    }

    const keys = {}

    window.addEventListener('keydown', (e) => {
        keys[e.key] = true
    })

    window.addEventListener('keyup', (e) => {
        keys[e.key] = false
    })

    explorer.fileId = 0
    explorer.clear = () => {
        explorer.fileId = 0
        explorer.innerHTML = null
        explorer.currentFiles = []
    }

    const searchFile = document.querySelector('[search-file]')
    searchFile.addEventListener('input', () => {
        fileExplorer.viewFiles(searchFile.innerText)
    })

    const connect = async (config) => 
    {
        window.fileExplorer = {
            currentDirectory: './',
            selectedItems: [],
            selectedItem: null
        }

        window.client = createClient(config.type)

        print(`Connecting to ^2${config.host}^7...`)
        client.connect(config)
        .then(async () => {
            print(`Connected to ^2${config.host}`)
    
            fileExplorer.currentDirectory = await client.currentDir()
        
            path.__normalize = path.normalize
            path.normalize = (_path) => {
                return path.__normalize(_path).replace(new RegExp(/\\/g), '/')
            }
        
            if (!fs.existsSync('./data/')) {
                fs.mkdirSync('./data/')
            }
        
            fileExplorer.sortFunction = 'name'
            fileExplorer.reverseSort = false
    
            fileExplorer.viewFiles = (match = searchFile.innerText) => {
                directoryList.innerHTML = null
                const split = fileExplorer.currentDirectory.split('/')
                split.forEach((directory, index) => {
                    if (directory.length == 0 && index == 0) {
                        directory = 'root'
                    } else if (directory.length == 0 && index > 0) {
                        return
                    }

                    const element = htmlElement(templates['directory'](directory))
                    const newDirectory = split.slice(0, index + 1).join('/') + '/'

                    element.querySelector('.directory-name').addEventListener('click', () => {
                        fileExplorer.listFiles(newDirectory)
                    })

                    directoryList.appendChild(element)
                })

                const selectedFiles = Array.from(fileExplorer.selectedItems).map(item => item.file)
                fileExplorer.selectedItems = []
                const files = sortFunctions[fileExplorer.sortFunction](fileExplorer.currentFiles, fileExplorer.reverseSort)
        
                explorer.clear()
        
                const back = htmlElement(templates['back']())
                explorer.appendChild(back)
        
                back.addEventListener('dblclick', () => {
                    fileExplorer.listFiles(fileExplorer.currentDirectory + '/../')
                })
            
                files.forEach(file => {
                    if (match && !file.name.match(match)) {
                        return
                    }

                    file.date = file.date || file.modifyTime
                    const element = explorer.addFile(file)
                    if (selectedFiles.find(file => file.id == element.file.id)) {
                        fileExplorer.selectedItems.push(element)
                    }
                })
        
                updateItems()
            }
    
            fileExplorer.listFiles = async (directory) => {
                directory = path.normalize(directory + '/')
                print(`Listing directory ^3'${directory}'^7...`)

                client.list(directory)
                .then((files) => {
                    var i = 0
                    files.forEach(file => {
                        file.id = i++
                    })
        
                    fileExplorer.currentFiles = sortFunctions[fileExplorer.sortFunction](files, fileExplorer.reverseSort)
                    fileExplorer.selectedItems = []
                    fileExplorer.currentDirectory = directory
        
                    fileExplorer.viewFiles()
                    print(`Directory listing of ^3'${directory}'^7 successful`)
                })
                .catch((err) => {
                    error(baseErrorMessage(err))
                })
            }
    
            fileExplorer.createDirectory = async (name) => {
                print(`Creating directory ^2'${name}'`)
                client.mkdir(path.normalize(fileExplorer.currentDirectory + '/' + name))
                .then(() => {
                    print(`Creation of directory ^2'${name}' successful`)
                })
                .catch((err) => {
                    error(`Failed to create directory ^2'${name}':^1 ${baseErrorMessage(err)}`)
                })
            }

            fileExplorer.open = async (name) => {
                const source = path.normalize(fileExplorer.currentDirectory + '/' + name)
                const folder = './data/temp/'
        
                if (!fs.existsSync(folder)) {
                    fs.mkdirSync(folder)
                }
        
                const destination = folder + name
        
                if (!fs.existsSync(destination)) {
                    fs.writeFileSync(destination, '')
                }
        
                print(`Downloading file ^3'${source}'`)
                await client.get(source, destination)
                print(`Successfully downloaded file ^3'${source}'^7`)
                
                var messageBoxOpen = false
                fs.watch(destination, async (event) => {
                    if (messageBoxOpen || event != 'change') {
                        return
                    }
        
                    messageBoxOpen = true
                    messageBox({
                        title: 'File has changed',
                        text: `A previously opened file has changed.<br>Filename:\t\t${path.basename(destination)}<br>Remote path: ${source}`
                    }, (result) => {
                        messageBoxOpen = false
        
                        if (!result) {
                            return
                        }
            
                        print(`Transfering file ^3'${destination}'...`)
                        client.put(destination, source)
                        .then(() => {
                            print(`Transfer of file ^3'${destination}' successful`)
                        })
                    })
                })
        
                open(destination)
            }

            fileExplorer.delete = async (file) => {
                if (file.type == 'd') {
                    print(`Recursively deleting folder ^2'${file.name}'^7...`)
                    await client.rmdir(fileExplorer.currentDirectory + '/' + file.name, true)
                    print(`Successfully deleted folder ^2'${file.name}'^7`)
                } else {
                    print(`Deleting ^2'${file.name}'^7...`)
                    await client.delete(fileExplorer.currentDirectory + '/' + file.name)
                    print(`Successfully deleted ^2'${file.name}'^7`)
                }
            }
    
            fileExplorer.download = (name) => {
                const source = path.normalize(fileExplorer.currentDirectory + '/' + name)
                const destination = os.homedir() + '/Downloads/' + name
        
                if (!fs.existsSync(destination)) {
                    fs.writeFileSync(destination, '')
                }
        
                client.get(source, destination)
        
            }
        
            fileExplorer.listFiles(fileExplorer.currentDirectory)
        })
        .catch(err => {
            console.log(err)
            error(`Failed to connect to ^2${config.host}^1: ${baseErrorMessage(err)}`)
        })
    }

    const config = readConfig()
    
    for (const server of config.servers) {
        addServer(server)
    }
})