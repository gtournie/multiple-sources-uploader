import { handleRequestStates } from './tools/request'
import { each } from './tools/tools'

function FN() {}

export default function uploader(options) {
  options = options || {}

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
      ;(options.onStart || FN)(file.name)
    }
    xhrUpload.onprogress = e => {
      ;(e.lengthComputable ? options.onProgress || FN : FN)((e.loaded / e.total) * 100)
    }

    // onloadend doesn't work with responseXML
    handleRequestStates(
      xhr,
      () => {
        const extractURL = options.extractUrlFromResponse
        ;(options.onDone || FN)(extractURL ? extractURL(xhr) : xhr.responseText)
      },
      () => {
        ;(options.onError || FN)(file.name)
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
