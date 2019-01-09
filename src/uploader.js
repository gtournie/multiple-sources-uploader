import { handleRequestStates } from './tools/request'
import { on } from './tools/dom'
import { each } from './tools/tools'

function FN() {}

export default function uploader(options) {
  options = options || {}
  let stopEvent
  let count = 0

  function upload(file, data) {
    const xhr = new XMLHttpRequest()
    const formData = new FormData()

    xhr.open(options.method || 'POST', options.url)

    const headers = options.headers || {}
    each(Object.keys(headers), name => {
      const value = headers[name]
      xhr.setRequestHeader(name, typeof value === 'function' ? value() : value)
    })

    const xhrUpload = xhr.upload
    xhrUpload.onloadstart = () => {
      if (0 === count++) {
        stopEvent = on(window, 'beforeunload', e => {
          e.preventDefault()
          return (e.returnValue = '')
        })
      }
      ;(options.onStart || FN)(file.name)
    }
    xhrUpload.onprogress = e => {
      ;(e.lengthComputable ? options.onProgress || FN : FN)((e.loaded / e.total) * 100)
    }

    // onloadend doesn't work with responseXML
    handleRequestStates(
      xhr,
      () => {
        ;(options.onDone || FN)(xhr)
        if (1 === count--) stopEvent()
      },
      () => {
        ;(options.onError || FN)(file.name)
        if (1 === count--) stopEvent()
      },
    )

    each(Object.keys(data || {}), prop => {
      formData.append(prop, data[prop])
    })
    formData.append(options.paramName || 'file', file, 'pic.jpg')
    xhr.send(formData)
  }

  return {
    upload: (file, data) => {
      options.getSignature ? options.getSignature(data => upload(file, data)) : upload(file, data)
    },
  }
}
