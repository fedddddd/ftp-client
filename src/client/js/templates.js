const moment       = require('moment')
const filesize     = require('filesize')
const localization = require('./localization')

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
window.htmlElement = (html) => {
    const e = document.createElement('div')
    e.innerHTML = html.trim()

    return e.firstChild
}

window.templates = {
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
    },
    'explorer-bar': () => {
        return `

        `
    },
    'explorer': () => {
        return `
            <div class="explorer-container">
                <div class="explorer-bar">
                    <div class="left-right-container explorer-bar-container">
                        <div class="left explorer-left">
                            <i class="fas fa-arrow-left explorer-button hover hover-disabled" explorer-back-btn></i>
                            <i class="fas fa-arrow-right explorer-button hover hover-disabled" explorer-forward-btn></i>
                            <i class="fas fa-arrow-up explorer-button hover hover-disabled" explorer-up-btn></i>
                            <div class="directory-list hide-scrollbar" horizontal-scrolling>
                            </div>
                        </div>
                    <div class="right">
                        <div class="search-box-wrap file-search">
                            <div class="search-box" contenteditable="true" search-file placeholder="Search file..."></div>
                        </div>
                    </div>
                </div>
                </div>
                <div class="explorer-wrap">
                    <div class="explorer-header">
                        <div class="file left-right-container no-border">
                            <div class="left">
                                <div class="file-name click" sort-name>Filename</div>
                            </div>
                            <div class="right">
                                <div class="file-size click" sort-size>Size</div>
                                <div class="file-date click" sort-date>Last modified</div>
                            </div>
                        </div>
                    </div>
                    <div class="explorer scroll" id="explorer">
                    </div>
                </div>
            </div>
        `
    },
    'file-already-open': (name) => {
        return `
            <div>
                ${'FS_FILE_ALREADY_OPEN'.mf(name).cc}
            </div>
            <div class='messagebox-radio'>
                <label class="radio-container">
                    <input type="radio" class='radio' value='redownload' name="action" checked="true">
                    <div class='radio-button-container'>
                        <div class='radio-button'></div>
                    </div>
                    <div>${'FS_REDOWNLOAD_FILE'.t}</div>
                </label>
                <label class="radio-container">
                    <input type="radio" value='reopen' name="action">
                    <div class='radio-button-container'>
                        <div class='radio-button'></div>
                    </div>
                    <div>${'FS_REOPEN_FILE'.t}</div>
                </label>
            </div>
        `
    }
}

module.exports = window.templates