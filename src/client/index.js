require('@electron/remote/main').initialize()
const electron = require('electron')
const path     = require('path')

const app = electron.app
const BrowserWindow = electron.BrowserWindow

const createWindow = () => {
    const mainWindow = new BrowserWindow({
        frame: false,
        minWidth: 1250,
        minHeight: 750,
        backgroundColor: '#1E1E1E',
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false,
            enableRemoteModule: true,
            preload: path.join(__dirname, 'preload.js')
        }
    })

    mainWindow.setResizable(true)
    mainWindow.maximize()
    mainWindow.loadFile(path.join(__dirname, 'pages/index.html'))
}

app.whenReady().then(() => {
    createWindow()

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) {
            createWindow()
        }
    })
})

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit()
    }
})