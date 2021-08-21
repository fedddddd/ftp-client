const path         = require('path')
const os           = require('os')
const fs           = require('fs')
const open         = require('open')
const templates    = require('./templates')
const messageBox   = require('./message-box')
const localization = require('./localization')
const progress     = require('progress-stream')
const { Readable } = require('stream')
const Throttle     = require('throttle')

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
    const container = htmlElement(templates['contextmenu-container']())
    const menu = htmlElement(templates['contextmenu']())
    container.appendChild(menu)

    for (const section of sections) {
        if (!section) {
            continue
        }

        const sectionElement = htmlElement(templates['contextmenu-section']())

        for (const entry of section) {
            if (typeof entry.show == 'function' && !entry.show()) {
                continue
            }

            const entryElement = htmlElement(templates['contextmenu-entry'](entry.text, entry.icon, entry.rightIcon))

            if (typeof entry.sub == 'object') {
                entryElement.addEventListener('mouseenter', () => {
                    const mainRect = menu.getBoundingClientRect()
                    const entryRect = entryElement.getBoundingClientRect()

                    Array.from(sectionElement.querySelectorAll('.contextmenu-container')).forEach(child => {
                        child.remove()
                    })

                    const subMenu = createContextMenu(entry.sub)
                    entryElement.appendChild(subMenu)

                    if (mainRect.x + mainRect.width + entryElement.offsetWidth >= window.outerWidth - 10) {
                        subMenu.style.left = -1 * subMenu.offsetWidth - 5
                        subMenu.style.paddingRight = 25
                    } else {
                        subMenu.style.left = entryElement.offsetWidth
                        subMenu.style.paddingLeft = 25
                    }

                    const delta = (entryRect.y + subMenu.offsetHeight - 10) - window.outerHeight
                    const top = entryRect.y - mainRect.y - 10

                    subMenu.style.top = delta < 0
                        ? top
                        : top - delta - 10
                })

                entryElement.addEventListener('mouseleave', () => {
                    Array.from(sectionElement.querySelectorAll('.contextmenu-container')).forEach(child => {
                        //child.remove()
                    })
                })
            } else {
                entryElement.addEventListener('click', () => {
                    if (typeof entry.callback == 'function') {
                        if (!entry.callback(sectionElement, entryElement)) {
                            container.remove()
                        }
                    } else {
                        container.remove()
                    }
                })
            }

            if (entry == section[section.length - 1]) {
                entryElement.style.marginBottom = '0px'
            }

            sectionElement.appendChild(entryElement)
        }

        if (sectionElement.children.length) {
            menu.appendChild(sectionElement)
        }
    }

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
        this.elements.fileList = this.elements.explorer.querySelector('.explorer')
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
        this.initializeEventListeners()
        this.updateNavigationButtons()
    }

    initializeEventListeners = () => {
        this.elements.fileList.addEventListener('dragover', (e) => {
            e.preventDefault()
        })

        this.elements.fileList.addEventListener('drop', (e) => {
            if (e.target != this.elements.fileList) {
                return
            }

            if (!e.dataTransfer.files.length) {
                return
            }

            for (const file of e.dataTransfer.files) {
                this.upload(file, file.name)
                .then((err) => {
                    if (err) {
                        return
                    }

                    this.listFiles(this.currentDirectory, false, false)
                })
            }
        })

        const selection = {
            start: {x: 0, y: 0},
            maxHeight: 0,
            element: null
        }

        const mousedown = (e) => {
            if (e.target != this.elements.fileList || e.offsetX >= this.elements.fileList.clientWidth) {
                return
            }

            this.selectedItems = []
            this.updateItems()

            selection.start = {
                x: e.offsetX, 
                y: e.offsetY + this.elements.fileList.scrollTop,
                maxHeight: this.elements.fileList.scrollHeight - e.offsetY - 2
            }

            selection.element = htmlElement(templates['selection']())
            selection.element.style.left = selection.start.x
            selection.element.style.top = selection.start.y

            this.elements.fileList.appendChild(selection.element)
        }

        const mouseup = (e) => {
            if (!selection.element) {
                return
            }

            selection.start = {x: 0, y: 0}
            selection.element.remove()
            selection.element = null
        }
        
        const mousemove = (e) => {
            const parentRect = this.elements.fileList.getBoundingClientRect()

            if (!selection.element) {
                return
            }

            const width = (e.clientX - parentRect.x) - selection.start.x
            const height = (e.clientY - parentRect.y) + this.elements.fileList.scrollTop - selection.start.y

            if (width > 0) {
                selection.element.style.width = width
            } else {
                selection.element.style.width = width * -1
                selection.element.style.left = selection.start.x + width
            }

            if (height > 0) {
                selection.element.style.height = Math.min(selection.start.maxHeight, height)
            } else {
                selection.element.style.height = height * -1
                selection.element.style.top = selection.start.y + height
            }

            const overlaps = (a, b) => {
                if (a.x >= b.x + b.width || b.x >= a.x + a.width) {
                    return false
                }

                if (a.y >= b.y + b.height || b.y >= a.y + a.height) {
                    return false
                }
            
                return true;
            }

            this.selectedItems = []
            const rect = selection.element.getBoundingClientRect()
            for (const child of this.elements.fileList.children) {
                const childRect = child.getBoundingClientRect()

                if (overlaps(rect, childRect) && child != selection.element) {
                    this.selectedItems.push(child)
                }
            }

            this.updateItems()
        }

        this.elements.fileList.addEventListener('mousedown', mousedown)
        document.addEventListener('mouseup', mouseup)
        document.addEventListener('mousemove', mousemove)

        const onRemoved = (e) => {
            if (e.target != this.elements.explorer) {
                return
            }

            document.removeEventListener('mouseup', mousedown)
            document.removeEventListener('mouseup', mouseup)
            document.removeEventListener('mousemove', mousemove)
            this.elements.explorer.parentNode.removeEventListener('DOMNodeRemoved', onRemoved)
        }

        this.elements.explorer.parentNode.addEventListener('DOMNodeRemoved', onRemoved)
    }

    initalizeContextMenu = () => {
        this.elements.fileList.addEventListener('contextmenu', (e) => {
            Array.from(document.querySelectorAll('.contextmenu-container')).forEach(menu => {
                menu.remove()
            })

            this.rightClickedItem = e.path.find(element => {
                if (typeof element.hasAttribute == 'function') {
                    return element.hasAttribute('file-element')
                }
            })
    
            const viewType = this.elements.explorer.getAttribute('viewtype')

            setTimeout(() => {
                const options = [
                    [
                        {
                            text: 'MENU_OPEN'.t,
                            icon: 'fa-external-link-square-alt',
                            show: () => {
                                return this.rightClickedItem || this.selectedItems[0]
                            },
                            callback: () => {
                                const item = this.rightClickedItem || this.selectedItems[0]
                                const file = item.file
                                const dir = this.currentDirectory + '/' + file.name + '/'
                                
                                file.type == '-'
                                    ? this.open(file)
                                    : this.listFiles(dir)
                            }
                        },
                        {
                            text: 'MENU_DOWNLOAD'.t,
                            icon: 'fa-download',
                            show: () => {
                                return this.selectedItems.length
                            },
                            callback: () => {
                                for (const item of this.selectedItems) {
                                    this.download(item.file)
                                }
                            }
                        }
                    ],
                    [
                        {
                            text: 'MENU_CREATE_DIR'.t,
                            icon: 'fa-folder',
                            callback: async () => {
                                menu.remove()
    
                                const box = await messageBox({
                                    title: 'MENU_CREATE_DIR'.t,
                                    buttons: {
                                        yes: 'CREATE'.t,
                                        no: 'CANCEL'.t
                                    },
                                    inputs: [
                                        [
                                            {
                                                type: 'text',
                                                id: 'dirname',
                                                name: 'DIRECTORY_NAME'.t
                                            }
                                        ]
                                    ]
                                }, (result, inputs) => {
                                    if (!result) {
                                        return
                                    }
    
                                    const dirname = inputs.dirname
                                    if (!dirname) {
                                        box.error('MENU_INVALID_DIR_NAME'.t)
                                        return true
                                    }
    
                                    if (dirname.match(/(\\|\/|\:|\*|\?|"|<|>|\|)/g)) {
                                        box.error('MENU_DIRNAME_INVALID_CHARS'.mf('\\ / : * ? " < > |'))
                                        return true
                                    }
    
                                    this.createDirectory(dirname)
                                    .then((err) => {
                                        if (err) {
                                            return
                                        }

                                        this.listFiles(this.currentDirectory, false, false)
                                    })
                                })
                            }
                        },
                        {
                            text: 'MENU_CREATE_DIR_ENTER'.t,
                            icon: 'fa-folder-open',
                            callback: async () => {
                                menu.remove()
    
                                const box = await messageBox({
                                    title: 'MENU_CREATE_DIR_ENTER'.t,
                                    buttons: {
                                        yes: 'CREATE'.t,
                                        no: 'CANCEL'.t
                                    },
                                    inputs: [
                                        [
                                            {
                                                type: 'text',
                                                id: 'dirname',
                                                name: 'DIRECTORY_NAME'.t
                                            }
                                        ]
                                    ]
                                }, (result, inputs) => {
                                    if (!result) {
                                        return
                                    }
    
                                    const dirname = inputs.dirname
                                    if (!dirname) {
                                        box.error('MENU_INVALID_DIR_NAME'.t)
                                        return true
                                    }
    
                                    if (dirname.match(/(\\|\/|\:|\*|\?|"|<|>|\|)/g)) {
                                        box.error('MENU_DIRNAME_INVALID_CHARS'.mf('\\ / : * ? " < > |'))
                                        return true
                                    }
    
                                    this.createDirectory(dirname)
                                    .then((err) => {
                                        if (err) {
                                            return
                                        }

                                        this.listFiles(this.currentDirectory + '/' + dirname)
                                    })
                                })
                            }
                        },
                        {
                            text: 'MENU_CREATE_FILE'.t,
                            icon: 'fa-edit',
                            callback: async () => {
                                menu.remove()
    
                                const box = await messageBox({
                                    title: 'MENU_CREATE_FILE'.t,
                                    buttons: {
                                        yes: 'CREATE'.t,
                                        no: 'CANCEL'.t
                                    },
                                    inputs: [
                                        [
                                            {
                                                type: 'text',
                                                id: 'filename',
                                                name: 'FILENAME'.t
                                            }
                                        ]
                                    ]
                                }, (result, inputs) => {
                                    if (!result) {
                                        return
                                    }
    
                                    const filename = inputs.filename
                                    if (!filename) {
                                        box.error('MENU_INVALID_FILENAME'.t)
                                        return true
                                    }
    
                                    if (filename.match(/(\\|\/|\:|\*|\?|"|<|>|\|)/g)) {
                                        box.error('MENU_FILENAME_INVALID_CHARS'.mf('\\ / : * ? " < > |'))
                                        return true
                                    }

                                    if (this.currentFiles.find(file => file.type != 'd' && file.name == filename)) {
                                        box.error('MENU_FILE_ALREADY_EXISTS'.t)
                                        return true
                                    }
    
                                    this.createFile(filename)
                                    .then((err) => {
                                        if (err) {
                                            return
                                        }

                                        this.listFiles(this.currentDirectory, false, false)
                                    })
                                })
                            }
                        }
                    ],
                    [
                        {
                            text: 'MENU_DELETE'.t,
                            icon: 'fa-trash',
                            show: () => {
                                return this.selectedItems.length
                            },
                            callback: () => {
                                for (const item of this.selectedItems) {
                                    const index = this.currentFiles.findIndex(file => file.id == item.file.id)
                                    this.currentFiles.splice(index, 1)
                                    this.delete(item.file)
                                    item.remove()
                                }
                            }
                        },
                        {
                            text: 'MENU_RENAME'.t,
                            icon: 'fa-tag',
                            show: () => {
                                return this.rightClickedItem || this.selectedItems[0]
                            },
                            callback: () => {
                                const item = this.rightClickedItem || this.selectedItems[0]

                                if (!item) {
                                    return
                                }

                                const name = item.querySelector('.file-name')
                                const current = name.innerText
                                name.setAttribute('contenteditable', 'true')
                                name.focus()

                                const rename = () => {
                                    if (name.innerText.match(/(\\|\/|\:|\*|\?|"|<|>|\|)/g) || name.innerText == '..' || item.file.name == name.innerText) {
                                        name.innerText = current
                                        return
                                    }

                                    this.rename({...item.file}, name.innerText)
                                    item.file.name = name.innerText
                                }

                                const removeListeners = () => {
                                    document.removeEventListener('click', click)
                                    document.removeEventListener('contextmenu', click)
                                    document.removeEventListener('drag', click)
                                    document.removeEventListener('keydown', keydown)
                                    name.removeEventListener('keydown', nameKeydown)
                                }

                                const click = (e) => {
                                    if (e.target == name) {
                                        return
                                    }

                                    name.setAttribute('contenteditable', 'false')
                                    removeListeners()
                                    rename()
                                }

                                const nameKeydown = (e) => {
                                    if (e.key.match(/(\\|\/|\:|\*|\?|"|<|>|\|)/g)) {
                                        e.preventDefault()
                                    }
                                }

                                name.addEventListener('keydown', nameKeydown)

                                const keydown = (e) => {
                                    switch (e.key) {
                                        case 'Escape':
                                            name.setAttribute('contenteditable', 'false')
                                            name.innerText = current
                                            removeListeners()
                                            break
                                        case 'Enter':
                                            name.setAttribute('contenteditable', 'false')
                                            removeListeners()
                                            rename()
                                            break
                                    }
                                }

                                setTimeout(() => {
                                    document.addEventListener('click', click)
                                    document.addEventListener('drag', click)
                                    document.addEventListener('contextmenu', click)
                                    document.addEventListener('keydown', keydown)
                                }, 0)
                            }
                        }
                    ],
                    [
                        {
                            text: 'MENU_SWITCH_VIEW'.t,
                            icon: 'fa-line-columns',
                            rightIcon: 'fa-arrow-right',
                            sub:
                            [
                                [
                                    {
                                        text: 'MENU_LIST_VIEW'.t,
                                        icon: !viewType || viewType == 'list' && 'fa-check',
                                        callback: (section, entry) => {
                                            Array.from(section.querySelectorAll('.contextmenu-entry')).forEach(child => {
                                                const icon = child.querySelector('.contextmenu-icon')

                                                if (entry == child) {
                                                    icon.classList.add('fa-check')
                                                } else {
                                                    icon.classList.remove('fa-check')
                                                }
                                            })

                                            this.elements.explorer.setAttribute('viewType', 'list')
                                            return true
                                        }
                                    },
                                    {
                                        text: 'MENU_ICON_VIEW'.t,
                                        icon: viewType == 'icon' && 'fa-check',
                                        callback: (section, entry) => {
                                            Array.from(section.querySelectorAll('.contextmenu-entry')).forEach(child => {
                                                const icon = child.querySelector('.contextmenu-icon')

                                                if (entry == child) {
                                                    icon.classList.add('fa-check')
                                                } else {
                                                    icon.classList.remove('fa-check')
                                                }
                                            })

                                            this.elements.explorer.setAttribute('viewType', 'icon')
                                            return true
                                        }
                                    },
                                    {
                                        text: 'MENU_SMALL_ICON_VIEW'.t,
                                        icon: viewType == 'small-icon' && 'fa-check',
                                        callback: (section, entry) => {
                                            Array.from(section.querySelectorAll('.contextmenu-entry')).forEach(child => {
                                                const icon = child.querySelector('.contextmenu-icon')

                                                if (entry == child) {
                                                    icon.classList.add('fa-check')
                                                } else {
                                                    icon.classList.remove('fa-check')
                                                }
                                            })

                                            this.elements.explorer.setAttribute('viewType', 'small-icon')
                                            return true
                                        }
                                    }
                                ]
                            ]
                        },
                        {
                            text: 'MENU_CHANGE_SORT'.t,
                            icon: 'fa-sort',
                            rightIcon: 'fa-arrow-right',
                            sub: 
                            [
                                [
                                    {
                                        text: 'FILENAME'.t,
                                        icon: this.sortFunction == 'name' && 'fa-check',
                                        callback: (section, entry) => {
                                            Array.from(section.querySelectorAll('.contextmenu-entry')).forEach(child => {
                                                const icon = child.querySelector('.contextmenu-icon')

                                                if (entry == child) {
                                                    icon.classList.add('fa-check')
                                                } else {
                                                    icon.classList.remove('fa-check')
                                                }
                                            })

                                            this.sortFunction = 'name'
                                            this.viewFiles()
                                            return true
                                        }
                                    },
                                    {
                                        text: 'DATE'.t,
                                        icon: this.sortFunction == 'date' && 'fa-check',
                                        callback: (section, entry) => {
                                            Array.from(section.querySelectorAll('.contextmenu-entry')).forEach(child => {
                                                const icon = child.querySelector('.contextmenu-icon')

                                                if (entry == child) {
                                                    icon.classList.add('fa-check')
                                                } else {
                                                    icon.classList.remove('fa-check')
                                                }
                                            })

                                            this.sortFunction = 'date'
                                            this.viewFiles()
                                            return true
                                        }
                                    },
                                    {
                                        text: 'SIZE'.t,
                                        icon: this.sortFunction == 'size' && 'fa-check',
                                        callback: (section, entry) => {
                                            Array.from(section.querySelectorAll('.contextmenu-entry')).forEach(child => {
                                                const icon = child.querySelector('.contextmenu-icon')

                                                if (entry == child) {
                                                    icon.classList.add('fa-check')
                                                } else {
                                                    icon.classList.remove('fa-check')
                                                }
                                            })

                                            this.sortFunction = 'size'
                                            this.viewFiles()
                                            return true
                                        }
                                    }
                                ],
                                [
                                    {
                                        text: 'DESCENDING'.t,
                                        icon: !this.reverseSort && 'fa-check',
                                        callback: (section, entry) => {
                                            Array.from(section.querySelectorAll('.contextmenu-entry')).forEach(child => {
                                                const icon = child.querySelector('.contextmenu-icon')

                                                if (entry == child) {
                                                    icon.classList.add('fa-check')
                                                } else {
                                                    icon.classList.remove('fa-check')
                                                }
                                            })

                                            this.reverseSort = false
                                            this.viewFiles()
                                            return true
                                        }
                                    },
                                    {
                                        text: 'ASCENDING'.t,
                                        icon: this.reverseSort && 'fa-check',
                                        callback: (section, entry) => {
                                            Array.from(section.querySelectorAll('.contextmenu-entry')).forEach(child => {
                                                const icon = child.querySelector('.contextmenu-icon')

                                                if (entry == child) {
                                                    icon.classList.add('fa-check')
                                                } else {
                                                    icon.classList.remove('fa-check')
                                                }
                                            })

                                            this.reverseSort = true
                                            this.viewFiles()
                                            return true
                                        }
                                    }
                                ]
                            ]
                        },
                        {
                            text: 'MENU_REFRESH'.t,
                            icon: 'fa-sync-alt',
                            callback: () => {
                                this.cachedDirectories[this.currentDirectory] = null
                                this.listFiles(this.currentDirectory, false, false)
                            }
                        }
                    ]
                ]
    
                const menu = createContextMenu(options)
                document.body.appendChild(menu)

                const delta = (e.clientY + menu.offsetHeight) - window.outerHeight

                menu.style.left = e.clientX + menu.offsetWidth >= window.outerWidth
                    ? e.clientX - menu.offsetWidth
                    : e.clientX

                menu.style.top = delta < 0
                    ? e.clientY
                    : e.clientY - delta - 10
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
            child.style.opacity = '100%'
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
            const name = element.querySelector('.file-name')
            if (name.getAttribute('contenteditable') == 'true') {
                return
            }

            if (file.type == '-') {
                this.open(file)
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

        element.draggable = true
        element.addEventListener('dragstart', (e) => {
            if (!this.selectedItems.find(item => item == element)) {
                this.selectedItems = []
                this.updateItems()
                this.selectedItems.push(element)
            }

            const draggedElements = document.createElement('div')
            draggedElements.setAttribute('file-drag', '')

            const selectedItems = this.selectedItems.sort((a, b) => {
                return a.fileId - b.fileId
            })

            const first = selectedItems[0]
            const last = selectedItems[selectedItems.length - 1]

            var next = first

            while (next != last.nextElementSibling) {
                const clone = next.cloneNode(true)
                next.style.opacity = 0.5
                next.style.backgroundColor = 'rgb(30, 30, 30)'
                clone.style.visibility = selectedItems.find(item => item == next)
                    ? 'visible'
                    : 'hidden'

                draggedElements.appendChild(clone)

                next = next.nextElementSibling
            }

            const rect = first.getBoundingClientRect()

            document.body.appendChild(draggedElements)
            e.dataTransfer.setDragImage(draggedElements, e.clientX - rect.x, e.screenY - rect.y + rect.height)
        })

        element.addEventListener('dragend', (e) => {
            Array.from(document.querySelectorAll('[file-drag]')).forEach((element) => {
                element.remove()
            })

            this.selectedItems = []
            this.updateItems()
        })

        element.addEventListener('dragenter', (e) => {
            if (element.file.type != 'd' || this.selectedItems.find(item => item == element)) {
                return
            }

            element.style.opacity = 1
            element.style.backgroundColor = 'rgb(90, 90, 90)'
        })

        element.addEventListener('dragleave', (e) => {
            if (element.file.type != 'd' || this.selectedItems.find(item => item == element)) {
                return
            }

            element.style.opacity = null
            element.style.backgroundColor = null
        })

        element.addEventListener('dragover', (e) => {
            e.preventDefault()
        })

        element.addEventListener('drop', (e) => {
            const folder = normalizePath(this.currentDirectory + '/' + element.file.name + '/')

            if (element.file.type != 'd' || this.selectedItems.find(item => item == element)) {
                return
            }

            if (e.dataTransfer.files.length) {
                for (const file of e.dataTransfer.files) {
                    const dest = normalizePath(element.file.name + '/' + file.name)
                    this.upload(file, dest)
                    .then((err) => {
                        if (err) {
                            return
                        }

                        this.cachedDirectories[normalizePath(this.currentDirectory + '/' + element.file.name + '/')] = null
                    })
                }

                return
            }

            for (const item of this.selectedItems) {
                if (item == element) {
                    continue
                }

                this.move(item.file, element.file.name)
                .then((err) => {
                    if (err) {
                        return
                    }

                    this.cachedDirectories[folder] = null
                    this.listFiles(this.currentDirectory, false, false)

                })
            }
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
                        if (this.selectedItems.length <= 0) {
                            break
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
            const newDirectory = normalizePath(split.slice(0, index + 1).join('/') + '/')

            element.querySelector('.directory-name').addEventListener('click', () => {
                this.listFiles(newDirectory)
            })
    
            element.addEventListener('drop', (e) => {
                if (e.dataTransfer.files.length) {
                    for (const file of e.dataTransfer.files) {
                        const dest = normalizePath(newDirectory + '/' + file.name)
                        this.upload(file, dest, true)
                        .then((err) => {
                            if (err) {
                                return
                            }
    
                            this.cachedDirectories[newDirectory] = null
                        })
                    }
    
                    return
                }

                for (const item of this.selectedItems) {
                    this.move(item.file, newDirectory, true)
                    .then((err) => {
                        if (err) {
                            return
                        }
    
                        this.cachedDirectories[newDirectory] = null
                        this.listFiles(this.currentDirectory, false, false)
                    })
                }
            })

            const name = element.querySelector('.directory-name')
    
            name.addEventListener('dragenter', (e) => {
                name.style.opacity = 1
                name.style.backgroundColor = 'rgba(90, 90, 90)'
            })
    
            name.addEventListener('dragleave', (e) => {
                name.style.opacity = null
                name.style.backgroundColor = null
            })
        
            name.addEventListener('dragover', (e) => {
                e.preventDefault()
            })

            this.elements.directoryList.appendChild(element)
        })

        this.elements.directoryList.scrollLeft = this.elements.directoryList.scrollWidth

        const selectedFiles = Array.from(this.selectedItems).map(item => item.file)
        this.selectedItems = []
        const filteredFiles = this.currentFiles.filter(file => !match || file.name.trim().toLowerCase().match(match))
        const files = sortFunctions[this.sortFunction](filteredFiles, this.reverseSort)

        this.elements.fileList.innerHTML = null

        const back = htmlElement(templates['back']())
        this.elements.fileList.appendChild(back)

        back.addEventListener('dblclick', () => {
            this.listFiles(this.currentDirectory + '/../')
        })

        back.addEventListener('drop', (e) => {
            const split = this.currentDirectory.split('/')
            const backDir = normalizePath(split.slice(0, split.length - 2).join('/') + '/')

            if (e.dataTransfer.files.length) {
                for (const file of e.dataTransfer.files) {
                    const dest = normalizePath(backDir + '/' + file.name)
                    this.upload(file, dest, true)
                    .then((err) => {
                        if (err) {
                            return
                        }

                        this.cachedDirectories[backDir] = null
                    })
                }

                return
            }

            for (const item of this.selectedItems) {
                this.move(item.file, backDir, true)
                .then((err) => {
                    if (err) {
                        return
                    }

                    this.cachedDirectories[backDir] = null
                    this.listFiles(this.currentDirectory, false, false)
                })
            }
        })

        back.addEventListener('dragenter', (e) => {
            back.style.opacity = 1
            back.style.backgroundColor = 'rgba(90, 90, 90)'
        })

        back.addEventListener('dragleave', (e) => {
            back.style.opacity = null
            back.style.backgroundColor = null
        })
    
        back.addEventListener('dragover', (e) => {
            e.preventDefault()
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

    listFiles = async (directory = this.__currentDirectory, addHistory = true, useCache = true) => {
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
    
            if (this.cachedDirectories[directory] && useCache) {
                resolve()
                callback(this.cachedDirectories[directory])
                return
            }
    
            print('FS_LIST_DIRECTORY'.mf(directory))
            this.client.list(directory)
            .then((files) => {
                callback(files)
                print('FS_LIST_DIRECTORY_SUCCESS'.mf(directory))
                resolve()
            })
            .catch((err) => {
                error('FS_LIST_DIRECTORY_FAIL'.mf(directory, baseErrorMessage(err)))
                resolve(err)
            })
        })
    }

    createDirectory = async (name) => {
        return new Promise((resolve, reject) => {
            const target = normalizePath(this.currentDirectory + '/' + name)
            this.client.mkdir(target)
            .then(() => {
                resolve()
                print('FS_CREATE_DIR_SUCCESS'.mf(target))
            })
            .catch((err) => {
                resolve(err)
                error('FS_CREATE_DIR_FAIL'.mf(target, baseErrorMessage(err)))
            })
        })
    }

    rename = async (file, name) => {
        const oldPath = normalizePath(this.currentDirectory + '/' + file.name)
        const newPath = normalizePath(this.currentDirectory + '/' + name)

        print('FS_RENAME_FILE'.mf(oldPath, newPath))
        return new Promise((resolve, reject) => {
            this.client.rename(oldPath, newPath)
            .then(() => {
                print('FS_RENAME_FILE_SUCCESS'.mf(oldPath, newPath))
                resolve()
            })
            .catch((err) => {
                error('FS_RENAME_FILE_FAIL'.mf(oldPath, newPath, err.message))
                resolve(err)
            })
        })
    }

    move = async (file, folder, asbsolutePath) => {
        const oldPath = normalizePath(this.currentDirectory + '/' + file.name)
        const newPath = normalizePath((asbsolutePath ? '' : this.currentDirectory + '/') + folder + '/' + file.name)

        print('FS_MOVE_FILE'.mf(oldPath, newPath))
        return new Promise((resolve, reject) => {
            this.client.rename(oldPath, newPath)
            .then(() => {
                print('FS_MOVE_FILE_SUCCESS'.mf(oldPath))
                resolve()
            })
            .catch((err) => {
                error('FS_MOVE_FILE_FAIL'.mf(oldPath, err.message))
                resolve(err)
            })
        })
    }

    delete = async (file) => {
        const target = normalizePath(this.currentDirectory + '/' + file.name)

        print('FS_DELETE_FILE'.mf(target))
        return new Promise((resolve, reject) => {
            (file.type == 'd'
                ? this.client.rmdir(target, true)
                : this.client.delete(target))
            .then(() => {
                print('FS_DELETE_FILE_SUCCESS'.mf(target))
                resolve()
            })
            .catch((err) => {
                error('FS_DELETE_FILE_FAIL'.mf(target, baseErrorMessage(err)))
                resolve(err)
            })
        })
    }

    createFile = async (name) => {
        const target = normalizePath(this.currentDirectory + '/' + name)

        print('FS_CREATE_FILE'.mf(target))
        return new Promise((resolve, reject) => {
            this.client.put(Readable.from(['']), target)
            .then(() => {
                print('FS_CREATE_FILE_SUCCESS'.mf(target))
                resolve()
            })
            .catch((err) => {
                error('FS_CREATE_FILE_FAIL'.mf(target, baseErrorMessage(err)))
                resolve(err)
            })
        })
    }

    upload = (file, dest, asbsolutePath) => {
        return new Promise((resolve, reject) => {
            const destination = normalizePath((asbsolutePath ? '' : this.currentDirectory + '/') + dest)
            print('FS_UPLOAD_FILE'.mf(file.path, destination))

            const progressStream = progress({
                length: file.size,
                time: 100
            })

            progressStream.on('progress', (progress) => {
                if (progress.remaining == 0) {
                    print('FS_UPLOAD_FILE_SUCCESS'.mf(file.path))
                    resolve()
                }
            })
    
            const inStream = fs.createReadStream(file.path)
            inStream.pipe(progressStream)
    
            const transfer = {
                type: 'upload',
                file,
                progressStream,
                end: () => {
                    progressStream.end()
                    inStream.end()
                }
            }
    
            window.addTransfer(transfer)

            this.client.put(progressStream, destination)
            .catch((err) => {
                error('FS_UPLOAD_FILE_FAIL'.mf(file.path, baseErrorMessage(err)))
                resolve(err)
            })
        })
    }

    download = (file) => {
        return new Promise((resolve, reject) => {
            const source = normalizePath(this.currentDirectory + '/' + file.name)
            const desinationFolder = normalizePath(os.homedir() + '/Downloads/')
            const destination = desinationFolder + file.name

            print('FS_DOWNLOAD_FILE'.mf(source, destination))
    
            const progressStream = progress({
                length: file.size,
                time: 100
            })

            progressStream.on('progress', (progress) => {
                if (progress.remaining == 0) {
                    print('FS_DOWNLOAD_FILE_SUCCESS'.mf(source))
                    resolve()
                }
            })
    
            const outStream = fs.createWriteStream(destination)
            progressStream.pipe(outStream)
    
            const transfer = {
                type: 'download',
                file,
                progressStream,
                destination,
                desinationFolder,
                end: () => {
                    progressStream.end()
                    outStream.end()
                }
            }
    
            window.addTransfer(transfer)
    
            this.client.get(source, progressStream, {autoClose: false})
            .then(() => {})
            .catch((err) => {
                print('FS_DOWNLOAD_FILE_FAIL'.mf(source, baseErrorMessage(err)))
                resolve(err)
            })
        })
    }

    open = async (file) => {
        const source = normalizePath(this.currentDirectory + '/' + file.name)
        const folder = './data/temp/'

        if (!fs.existsSync(folder)) {
            fs.mkdirSync(folder)
        }

        const destination = folder + file.name

        if (!fs.existsSync(destination)) {
            fs.writeFileSync(destination, '')
        }

        const callback = () => {
            print('FS_DOWNLOAD_FILE'.mf(source, destination))
            this.client.get(source, destination)
            .then(() => {
                print('FS_DOWNLOAD_FILE_SUCCESS'.mf(source))
            
                var messageBoxOpen = false
                const watcher = fs.watch(destination, async (event) => {
                    if (messageBoxOpen || event != 'change') {
                        return
                    }
        
                    messageBoxOpen = true
                    messageBox({
                        title: 'FS_FILE_CHANGED_TITLE'.t,
                        text: 'FS_FILE_CHANGED'.mf(path.basename(destination), source).cc
                    }, (result) => {
                        messageBoxOpen = false
        
                        if (!result) {
                            return
                        }
            
                        print('FS_UPLOAD_FILE'.mf(destination, source))
                        this.client.put(destination, source)
                        .then(() => {
                            print('FS_UPLOAD_FILE_SUCCESS'.mf(destination))
                        })
                        .catch(() => {
                            print('FS_UPLOAD_FILE_FAIL'.mf(destination))
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
                print('FS_DOWNLOAD_FILE_FAIL'.mf(source))
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