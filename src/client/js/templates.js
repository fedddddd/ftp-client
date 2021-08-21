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
        <div class="file left-right-container no-child-pointer-events" file-element>
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
    'contextmenu-entry': (text, leftIcon, rightIcon) => {
        return `
            <div class='contextmenu-entry vertical-align'>
                <i class="fas ${leftIcon} fa-1x contextmenu-icon"></i>
                <div>${text}</div>
                <i class="fas ${rightIcon} fa-1x contextmenu-right-icon contextmenu-icon"></i>
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
                    <div t="NAME">Name</div>
                    <div t="PROTOCOL">Protocol</div>
                    <div t="HOST">Host</div>
                </div>
                <div class='right server-settings'>
                    <input class='form' input-name type='text' data-placeholder="FORM_OPTIONAL">
                    <select name='Protocol' input-protocol class='form select'>
                        <option value="ftp" t="FTP"></option>
                        <option value="sftp" t="SFTP"></option>
                    </select>
                    <input class='form' type='text' input-host data-placeholder="HOST_EXAMPLE">
                </div>
            </div>
            <div class='line'></div>
            <div class='left-right-container'>
                <div class='left server-settings'>
                    <div t="AUTHENTICATION_TYPE"></div>
                </div>
                <div class='right server-settings'>
                    <select name='Authentication type' input-auth-type class='form select'>
                        <option value="password" t="PASSWORD"></option>
                        <option value="anonymous" t="ANONYMOUS"></option>
                        <option value="ask" t="ASK_PASSWORD"></option>
                        <option value="key" key-option t="PRIVATE_KEY"></option>
                    </select>
                    <input class='form' type='text' input-username data-placeholder="USERNAME">
                    <input class='form' type='password' input-password data-placeholder="PASSWORD">
                    <div class='server-settings-key'>
                        <input type='text' input-key data-placeholder="KEY_FILE">
                        <div class='server-settings-browse-btn' browse-btn t="BROWSE"></div>
                    </div>
                </div>
            </div>
        `
    },
    'connect': () => {
        return `
            <div class='left-right-container'>
                <div class='left server-settings'>
                    <div t="PROTOCOL"></div>
                    <div t="HOST"></div>
                </div>
                <div class='right server-settings'>
                    <select name='Protocol' input-protocol class='form select'>
                        <option value="ftp" t="FTP"></option>
                        <option value="sftp" t="SFTP"></option>
                    </select>
                    <input class='form' type='text' input-host data-placeholder="HOST_EXAMPLE">
                </div>
            </div>
            <div class='line'></div>
            <div class='left-right-container'>
                <div class='left server-settings'>
                    <div t="AUTHENTICATION_TYPE"></div>
                </div>
                <div class='right server-settings'>
                    <select name='Authentication type' input-auth-type class='form select'>
                        <option value="password" t="PASSWORD"></option>
                        <option value="anonymous" t="ANONYMOUS"></option>
                        <option value="key" key-option t="PRIVATE_KEY"></option>
                    </select>
                    <input class='form' type='text' input-username data-placeholder="USERNAME">
                    <input class='form' type='password' input-password data-placeholder="PASSWORD">
                    <div class='server-settings-key'>
                        <input type='text' input-key data-placeholder="KEY_FILE">
                        <div class='server-settings-browse-btn' browse-btn t="BROWSE"></div>
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
    'server': (name, os, icon, date) => {
            return `
                <div class='server left-right-container'>
                    <div class='left'>
                        <i class="${icon} server-icon"></i>
                        <div class='server-info'>
                            <div class='server-name'>
                                ${name}
                            </div>
                            <div class='server-os'>
                                ${os}
                            </div>
                        </div>
                    </div>
                    <div class='right'>
                        <i class="fas fa-trash server-button click" delete-btn></i>
                        <i class="fas fa-edit server-button click" edit-btn></i>
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
            <div class="explorer-container" viewtype='list'>
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
                            <div class="search-box" contenteditable="true" search-file data-placeholder="SEARCH_FILE"></div>
                        </div>
                    </div>
                </div>
                </div>
                <div class="explorer-wrap">
                    <div class="explorer-header">
                        <div class="file left-right-container no-border">
                            <div class="left">
                                <div class="file-name click" sort-name t="FILENAME"></div>
                            </div>
                            <div class="right">
                                <div class="file-size click" sort-size t="SIZE">Size</div>
                                <div class="file-date click" sort-date t="LAST_MODIFIED"></div>
                            </div>
                        </div>
                    </div>
                    <div class="explorer scroll">
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
                    <div t="FS_REDOWNLOAD_FILE"></div>
                </label>
                <label class="radio-container">
                    <input type="radio" value='reopen' name="action">
                    <div class='radio-button-container'>
                        <div class='radio-button'></div>
                    </div>
                    <div t="FS_REOPEN_FILE"></div>
                </label>
            </div>
        `
    },
    'download-list': () => {
        return `
            <div class='download-list-container' download-list>
                <div class='download-list-header' t="Transfers"></div>
                <div class='download-list scroll hide-scrollbar'>
                </div>
            </div>
        `
    },
    'download': (type, name) => {
        return `
            <div class='server'>
                <div class='left'>
                    <i class="fas fa-file server-icon"></i>
                    <div class='server-info'>
                        <div class='server-name'>
                            <i class="fas fa-arrow-${type == 'download' ? 'down' : 'up'}"></i> ${name}
                        </div>
                        <div class='download-progress-wrap'>
                            <div class='download-progress'></div>
                        </div>
                        <div class='download-speed'></div>
                    </div>
                </div>
                <div class='right'>
                    <i class="fas fa-times server-button click" delete-btn></i>
                </div>
            </div>
        `
    },
    'selection': () => {
        return `
            <div class='selection'></div>
        `
    }
}

module.exports = window.templates