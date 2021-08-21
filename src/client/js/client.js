const clientTypes = {
    ftp: require('./ftp-client'),
    sftp: require('ssh2-sftp-client')
}

const createClient = (type) => {
    switch (type) {
        case 'sftp':
            {
                const client = new clientTypes.sftp()
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

                client.getOS = () => {
                    return null
                }

                return client
            }
    }
}

module.exports = createClient