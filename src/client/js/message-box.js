const Mutex = require('../../utils/mutex')

window.messageBoxMutex = window.messageBoxMutex || new Mutex()
window.messageBox = async (data = {}, _callback) => {
    await messageBoxMutex.lock()

    callback = (result, inputs) => {
        box.clearError()

        if (typeof _callback == 'function') {
            if (!_callback(result, inputs)) {
                close()
            }
        } else {
            close()
        }
    }

    const box = htmlElement(templates['messagebox'](data.title || '', data.text || '', data.buttons || {}))
    for (const key in data.style) {
        box.children[0].style[key] = data.style[key]
    }

    const body = box.querySelector('.messagebox-body')

    const close = () => {
        document.removeEventListener('keydown', onKeyDown)
        box.style.opacity = 0
        setTimeout(() => {
            box.remove()
            messageBoxMutex.unlock()
        }, 100)
    }

    box.querySelector('[yes-btn]').addEventListener('click', () => {
        callback(true, inputs)
    })

    box.querySelector('[no-btn]').addEventListener('click', () => {
        callback(false, inputs)
    })

    const inputs = {}
    var firstInput = null
    if (data.inputs) {
        data.inputs.forEach(section => {
            const container = htmlElement(templates['messagebox-input']())
            const left = container.querySelector('.left')
            const right = container.querySelector('.right')

            section.forEach(input => {
                left.appendChild(htmlElement(`
                    <div>${input.name}</div>
                `))

                const element = htmlElement(`
                    <input class='form' type='${input.type || 'text'}' ${input.id} placeholder='${input.placeholder || ''}'>
                `)

                firstInput = firstInput || element

                right.appendChild(element)

                element.addEventListener('input', () => {
                    inputs[input.id] = element.value.trim()
                })
            })

            body.appendChild(container)
            body.appendChild(htmlElement(`<div class='messagebox-section-line'></div>`))
        })
    }

    const errorMessage = htmlElement(`<div error class='server-settings-error'></div>`)
    body.appendChild(errorMessage)

    box.error = (message) => {
        errorMessage.style.display = 'block'
        errorMessage.innerText = message
    }

    box.clearError = () => {
        errorMessage.style.display = 'none'
        errorMessage.innerText = ''
    }

    const onKeyDown = (e) => {
        switch (e.key) {
            case 'Enter':
                callback(true, inputs)
                break
            case 'Escape':
                callback(false, inputs)
                break
        }
    }

    box.style.opacity = 0
    document.addEventListener('keydown', onKeyDown)
    document.querySelector('.content').appendChild(box)

    setTimeout(() => {
        box.style.opacity = 1

        if (firstInput) {
            firstInput.focus()
        }
    }, 10)

    return box
}

module.exports = window.messageBox