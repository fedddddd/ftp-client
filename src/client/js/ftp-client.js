const _Client  = require('ftp')
const stream   = require('stream')
const fs       = require('fs')

const convertToPromise = (self, method, defaultArgs = []) => {
    return (...args) => {
        return new Promise((resolve, reject) => {
            for (var i = 0; i < defaultArgs.length; i++) {
                args[i] = args[i] || defaultArgs[i]
            }

            const callback = (err, result) => {
                console.log({err, result})

                if (err) {
                    reject(err)
                    return
                }
    
                resolve(result)
            }

            self[method].apply(self, [...args, callback])
        })
    }
}

class Client {
    constructor() {
        this.client = new _Client()
        this.rmdir = convertToPromise(this.client, 'rmdir', [null, true])
        this.currentDir = convertToPromise(this.client, 'pwd')

        return new Proxy(this, {
            get: (target, name) => {
                if (!this[name] && typeof target.client[name] == 'function') {
                    return convertToPromise(this.client, name)
                } else if (!this[name] && typeof this.client[name] != 'function') {
                    return this.client[name]
                } else if (this[name]) {
                    return this[name]
                }
            },
            set: (target, name, value) => {
                this[name] = value
            }
        })
    }

    connect = (config) => {
        config.user = config.user || config.username

        return new Promise((resolve, reject) => {
            const onReady = () => {
                resolve()
                this.client.removeListener('error', onError)
            }

            const onError = (err) => {
                reject(err)
                this.client.removeListener('ready', onReady)
            }

            this.client.once('ready', onReady)
            this.client.once('error', onError)

            this.client.connect(config)
        })
    }

    get = (path, dest) => {
        return new Promise((resolve, reject) => {
            this.client.get(path, (err, strm) => {
                if (err) {
                    resolve(err)
                    return
                }

                if (dest instanceof stream.Stream) {
                    strm.pipe(dest)
                } else if (typeof dest == 'string') {
                    const writeStream = fs.createWriteStream(dest)
                    strm.pipe(writeStream)
                }

                strm.on('close', () => {
                    resolve()
                })
            })

        })
    }
}

module.exports = Client