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

module.exports = createClient