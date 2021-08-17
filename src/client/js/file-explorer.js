const path         = require('path')
const os           = require('os')
const fs           = require('fs')
const open         = require('open')
const templates    = require('./templates')
const messageBox   = require('./message-box')
const localization = require('./localization')

const normalizePath = (_path) => {
    return path.normalize(_path).replace(new RegExp(/\\/g), '/')
}

const baseErrorMessage = (err) => {
    const message = err.message
    const split = message.split(':')
    return split[split.length - 1].trim()
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

if (!window.keys) {
    window.keys = {}
    window.keyState = 0

    window.addEventListener('keydown', (e) => {
        if (window.keys[e.key]) {
            return
        }

        window.keys[e.key] = true

        if (e.key != 'Shift' && e.key != 'Control') {
            return
        }

        window.keyState += e.keyCode
    })
    
    window.addEventListener('keyup', (e) => {
        if (!window.keys[e.key]) {
            return
        }

        window.keys[e.key] = false

        if (e.key != 'Shift' && e.key != 'Control') {
            return
        }

        window.keyState -= e.keyCode
    })
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

window.FileExplorer = class FileExplorer {
    constructor(parent, client) {
        this.client = client
        this.selectedItem = null,
        this.history = [],
        this.historyIndex = 0,
        this.cachedDirectories = {}
        this.fileId = 0
        this.sortFunction = 'name'
        this.reverseSort = false
        this.history = []
        this.historyIndex = -1
        this.cachedDirectories = {}
        this.openedFiles = []

        Object.defineProperties(this, {
            __currentDirectory: {
                value: './',
                writable: true
            },
            currentDirectory: {
                set: function(value) {
                    this.__currentDirectory = normalizePath(value)
                },
                get: function() {
                    return this.__currentDirectory
                }
            }
        })

        this.elements = {}

        this.elements.explorer = htmlElement(templates['explorer']())
        this.elements.fileList = this.elements.explorer.querySelector('#explorer')
        this.elements.explorerBar = this.elements.explorer.querySelector('.explorer-bar')
        this.elements.forwardButton = this.elements.explorerBar.querySelector('[explorer-forward-btn]')
        this.elements.backButton = this.elements.explorerBar.querySelector('[explorer-back-btn]')
        this.elements.upButton = this.elements.explorerBar.querySelector('[explorer-up-btn]')
        this.elements.searchFile = this.elements.explorerBar.querySelector('[search-file]')
        this.elements.directoryList = this.elements.explorerBar.querySelector('.directory-list')

        this.elements.nameSort = this.elements.explorer.querySelector('[sort-name]')
        this.elements.dateSort = this.elements.explorer.querySelector('[sort-date]')
        this.elements.sizeSort = this.elements.explorer.querySelector('[sort-size]')
    
        this.elements.nameSort.addEventListener('click', () => {
            if (this.sortFunction == 'name') {
                this.reverseSort = !this.reverseSort
            } else {
                this.reverseSort = false
                this.sortFunction = 'name'
            }
    
            this.viewFiles()
        })
    
        this.elements.dateSort.addEventListener('click', () => {
            if (this.sortFunction == 'date') {
                this.reverseSort = !this.reverseSort
            } else {
                this.reverseSort = false
                this.sortFunction = 'date'
            }
    
            this.viewFiles()
        })
    
        this.elements.sizeSort.addEventListener('click', () => {
            if (this.sortFunction == 'size') {
                this.reverseSort = !this.reverseSort
            } else {
                this.reverseSort = false
                this.sortFunction = 'size'
            }
    
            this.viewFiles()
        })

        this.elements.searchFile.addEventListener('input', () => {
            this.viewFiles()
        })

        this.elements.forwardButton.addEventListener('click', () => {
            if (this.historyIndex >= this.history.length - 1) {
                return
            }
    
            this.historyIndex++
            this.listFiles(this.history[this.historyIndex], false)
        })
    
        this.elements.backButton.addEventListener('click', () => {
            if (this.historyIndex <= 0) {
                return
            }
    
            this.historyIndex--
            this.listFiles(this.history[this.historyIndex], false)
        })

        this.elements.upButton.addEventListener('click', () => {
            this.listFiles(this.currentDirectory + '/../')
        })

        this.elements.explorer.self = this
        parent.appendChild(this.elements.explorer)
        this.initalizeContextMenu()
        this.updateNavigationButtons()
    }

    initalizeContextMenu = () => {
        this.elements.fileList.addEventListener('contextmenu', (e) => {
            this.rightClickedItem = e.path.find(element => {
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
                                const file = this.rightClickedItem.file
                                const dir = this.currentDirectory + '/' + file.name + '/'
                                
                                file.type == '-'
                                    ? this.open(file.name)
                                    : this.listFiles(dir)
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
    
                                    this.createDirectory(dirname)
                                    .then(() => {
                                        this.listFiles(this.currentDirectory)
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
    
                                    this.createDirectory(dirname)
                                    .then(() => {
                                        this.listFiles(this.currentDirectory + '/' + dirname)
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
                                this.cachedDirectories[this.currentDirectory] = null
                                this.listFiles(this.currentDirectory)
                            }
                        }
                    ],
                    [
                        {
                            text: 'Delete',
                            icon: 'fa-trash',
                            callback: () => {
                                for (const item of this.selectedItems) {
                                    this.delete(item.file)
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
    
                if (!this.rightClickedItem) {
                    options[0] = null
                }
    
                const menu = createContextMenu(options)
        
                menu.style.left = e.clientX
                menu.style.top = e.clientY
            }, 0)
        })
    }

    updateNavigationButtons = () => {
        const back = this.historyIndex > 0
        const forward = this.historyIndex < this.history.length - 1
        const up = this.currentDirectory.match(/\//g).length > 1

        forward
            ? this.elements.forwardButton.classList.add('hover')
            : this.elements.forwardButton.classList.remove('hover')
            
        back
            ? this.elements.backButton.classList.add('hover')
            : this.elements.backButton.classList.remove('hover')

        up
            ? this.elements.upButton.classList.add('hover')
            : this.elements.upButton.classList.remove('hover')
    }

    updateItems = () => {
        for (const child of this.elements.fileList.children) {
            child.style.backgroundColor = ''
        }

        for (const item of this.selectedItems) {
            item.style.backgroundColor = 'rgba(90, 90, 90)'
        }
    }

    addFile = (file) => {
        const element = htmlElement(templates['file'](file))
        element.fileId = this.fileId++
        element.file = file

        element.addEventListener('dblclick', () => {
            if (file.type == '-') {
                this.open(file.name)
            } else {
                this.listFiles(this.currentDirectory + '/' + file.name + '/')
            }
        })

        element.addEventListener('contextmenu', (e) => {
            if (!this.selectedItems.find(item => item.fileId == element.fileId)) {
                this.selectedItems = [element]
            }

            this.updateItems()
        })

        element.addEventListener('click', () => {
            switch (keyState) {
                case 0:
                    this.selectedItems = []
                    this.selectedItems.push(element)
                    break
                case 33:
                case 16:
                    {
                        if (this.selectedItems.length < 0) {
                            return
                        }
    
                        const first = this.selectedItems[0]
                        this.selectedItems = [first]
                            
                        const start = first.fileId < element.fileId 
                            ? first.fileId
                            : element.fileId
        
                        const end = first.fileId > element.fileId 
                            ? first.fileId
                            : element.fileId
        
                        for (const child of explorer.children) {
                            if (child.fileId >= start && child.fileId <= end) {
                                if (this.selectedItems.find(item => item.fileId == child.fileId)) {
                                    continue
                                }
        
                                this.selectedItems.push(child)
                            }
                        }
                        break
                    }
                case 17:
                    if (this.selectedItems.find(item => item.fileId == element.fileId)) {
                        for (var i = 0; i < this.selectedItems.length; i++) {
                            const item = this.selectedItems[i]
                            if (item.fileId == element.fileId) {
                                this.selectedItems.splice(i, 1)
                            }
                        }
                    } else {
                        this.selectedItems.push(element)
                    }
                    break
            }

            this.updateItems()
        })

        this.elements.fileList.appendChild(element)
        return element
    }

    viewFiles = (match = this.elements.searchFile.innerText) => {
        match = match.trim().toLowerCase()

        this.elements.directoryList.innerHTML = null
        const split = this.currentDirectory.split('/')
        split.forEach((directory, index) => {
            if (directory.length == 0 && index == 0) {
                directory = 'root'
            } else if (directory.length == 0 && index > 0) {
                return
            }

            const element = htmlElement(templates['directory'](directory))
            const newDirectory = split.slice(0, index + 1).join('/') + '/'

            element.querySelector('.directory-name').addEventListener('click', () => {
                this.listFiles(newDirectory)
            })

            this.elements.directoryList.appendChild(element)
        })

        this.elements.directoryList.scrollLeft = this.elements.directoryList.scrollWidth

        const selectedFiles = Array.from(this.selectedItems).map(item => item.file)
        this.selectedItems = []
        const filteredFiles = this.currentFiles.filter(file => !match || file.name.match(match))
        const files = sortFunctions[this.sortFunction](filteredFiles, this.reverseSort)

        this.elements.fileList.innerHTML = null

        const back = htmlElement(templates['back']())
        this.elements.fileList.appendChild(back)

        back.addEventListener('dblclick', () => {
            this.listFiles(this.currentDirectory + '/../')
        })
    
        files.forEach(file => {
            file.date = file.date || file.modifyTime
            const element = this.addFile(file)
            if (selectedFiles.find(file => file.id == element.file.id)) {
                this.selectedItems.push(element)
            }
        })

        this.updateItems()
    }

    listFiles = async (directory = this.__currentDirectory, addHistory = true) => {
        return new Promise((resolve, reject) => {
            directory = normalizePath(directory + '/')

            const callback = (files) => {
                this.cachedDirectories[directory] = files
    
                var i = 0
                files.forEach(file => {
                    file.id = i++
                })
    
                this.currentFiles = sortFunctions[this.sortFunction](files, this.reverseSort)
                this.selectedItems = []
                this.currentDirectory = directory

                if (addHistory) {
                    const currentDepth = this.currentDirectory.match(/\//g).length
                    const lastDepth = this.history.length 
                                      && this.historyIndex < this.history.length - 1 
                                      && this.history[this.historyIndex + 1].match(/\//g).length || -1

                    if (currentDepth <= lastDepth) {
                        this.history = this.history.slice(0, this.historyIndex + 1)
                    }

                    if (this.history.length < 0 || this.history[this.history.length - 1] != this.currentDirectory) {
                        this.history.push(this.currentDirectory)
                    }

                    this.historyIndex = this.history.length - 1
                }

                this.updateNavigationButtons()
                this.viewFiles()
            }
    
            if (this.cachedDirectories[directory]) {
                resolve()
                callback(this.cachedDirectories[directory])
                return
            }
    
            print('CLIENT_LIST_DIRECTORY'.mf(directory))
            this.client.list(directory)
            .then((files) => {
                callback(files)
                print('CLIENT_LIST_DIRECTORY_SUCCESS'.mf(directory))
                resolve()
            })
            .catch((err) => {
                error('CLIENT_LIST_DIRECTORY_FAIL'.mf(directory, baseErrorMessage(err)))
                resolve(err)
            })
        })
    }

    createDirectory = async (name) => {
        const target = this.currentDirectory + '/' + name
        return this.client.mkdir(normalizePath(target))
    }

    delete = async (file) => {
        
        const target = this.currentDirectory + '/' + file.name

        return file.type == 'd'
            ? this.client.rmdir(target, true)
            : this.client.delete(target)
    }

    download = (name) => {
        const source = normalizePath(this.currentDirectory + '/' + name)
        const destination = os.homedir() + '/Downloads/' + name

        if (!fs.existsSync(destination)) {
            fs.writeFileSync(destination, '')
        }

        return this.client.get(source, destination)
    }

    open = async (name) => {
        const source = normalizePath(this.currentDirectory + '/' + name)
        const folder = './data/temp/'

        if (!fs.existsSync(folder)) {
            fs.mkdirSync(folder)
        }

        const destination = folder + name

        if (!fs.existsSync(destination)) {
            fs.writeFileSync(destination, '')
        }

        const callback = () => {
            print('CLIENT_DOWNLOAD'.mf(source))
            this.client.get(source, destination)
            .then(() => {
                print('CLIENT_DOWNLOAD_SUCCESS'.mf(source))
            
                var messageBoxOpen = false
                const watcher = fs.watch(destination, async (event) => {
                    if (messageBoxOpen || event != 'change') {
                        return
                    }
        
                    messageBoxOpen = true
                    messageBox({
                        title: 'FS_FILE_CHANGED'.t,
                        text: `A previously opened file has changed.<br>Filename:\t\t${path.basename(destination)}<br>Remote path: ${source}`
                    }, (result) => {
                        messageBoxOpen = false
        
                        if (!result) {
                            return
                        }
            
                        print('CLIENT_UPLOAD'.mf(destination))
                        this.client.put(destination, source)
                        .then(() => {
                            print('CLIENT_UPLOAD_SUCCESS'.mf(destination))
                        })
                        .catch(() => {
                            print('CLIENT_UPLOAD_FAIL'.mf(destination))
                        })
                    })
                })

                this.openedFiles.push({
                    name: source,
                    watcher
                })
    
                open(destination)
            })
            .catch(() => {
                print('CLIENT_DOWNLOAD_FAIL'.mf(source))
            })
        }

        const foundIndex = this.openedFiles.findIndex(file => file.name == source)
        if (foundIndex != -1) {
            const found = this.openedFiles[foundIndex]

            const box = await messageBox({
                title: 'FS_FILE_ALREADY_OPEN_TITLE'.t,
                text: templates['file-already-open'](path.basename(destination)),
            }, (result) => {
                if (!result) {
                    return
                }

                const button = box.querySelector('input[type="radio"][checked="true"]')
                if (!button) {
                    return
                }

                if (button.value == 'redownload') {
                    found.watcher.close()
                    this.openedFiles.slice(foundIndex, 1)
                    callback()
                    return
                }

                open(destination)
            })

            return
        }

        callback()
    }
}

module.exports = window.FileExplorer