const fs   = require('fs')
const path = require('path')

const io = {
    createDirectory: (dir) => {
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, {recursive: true})
        }  
    },
    createFile: (file, data = '') => {
        const dir = path.dirname(file)
        io.createDirectory(dir)
        if (!fs.existsSync(file)) {
            fs.writeFileSync(file, typeof data == 'object' ? JSON.stringify(data, null, 4) : data)
        }
    },
    writeFile: (file, data) => {
        const dir = path.dirname(file)
        io.createDirectory(dir)
        fs.writeFileSync(file, typeof data == 'object' ? JSON.stringify(data, null, 4) : data)
    },
    ConfigFile: class ConfigFile {
        constructor(filepath, base = {}) {
            io.createFile(filepath, base)
            this.filepath = filepath
            this.read()
        }
        
        read() {
            this.current = JSON.parse(fs.readFileSync(this.filepath))
            return this.current
        }

        save() {
            io.writeFile(this.filepath, this.current)
        }
    }
}

module.exports = io