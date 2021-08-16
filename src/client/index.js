require('@electron/remote/main').initialize()
const electron = require('electron')
const path     = require('path')

const app = electron.app
const BrowserWindow = electron.BrowserWindow

const createWindow = () => {
    const mainWindow = new BrowserWindow({
        width: 800,
        height: 600,
        frame: false,
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false,
            enableRemoteModule: true,
            preload: path.join(__dirname, 'preload.js')
        }
    })

    mainWindow.setResizable(true)
    mainWindow.loadFile('pages/index.html')
    mainWindow.BrowserWindow().getFocusedW
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