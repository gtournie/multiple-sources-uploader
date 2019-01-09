import isNode from './is-node'
import downsize from './pica'

let canvas, ctx, _webPSupport, _webcamSupport, _mediaDevices

if (!isNode) {
  if (!HTMLCanvasElement.prototype.toBlob) {
    HTMLCanvasElement.prototype.toBlob = function(callback, type, quality) {
      const dataURL = this.toDataURL(type, quality).split(',')[1]
      setTimeout(function() {
        const binStr = atob(dataURL)
        const len = binStr.length
        const arr = new Uint8Array(len)
        for (let i = 0; i < len; ++i) arr[i] = binStr.charCodeAt(i)
        callback(new Blob([arr], { type: type || 'image/png' }))
      })
    }
  }
  window.URL = window.URL || window.webkitURL || window.mozURL || window.msURL

  canvas = document.createElement('canvas')
  ctx = canvas.getContext('2d')
  canvas.width = canvas.height = 1

  _webPSupport = 5 === canvas.toDataURL('image/webp').indexOf('image/webp')
  _webcamSupport = navigator.mediaDevices && navigator.mediaDevices.getUserMedia
  _mediaDevices = (() => {
    const md = navigator.mediaDevices || navigator
    md.getMedia = md.getUserMedia || md.webkitGetUserMedia || md.mozGetUserMedia || md.msGetUserMedia
    return md
  })()
}

export const webPSupport = _webPSupport

export const webcamSupport = _webcamSupport

export const mediaDevices = _mediaDevices

// Get orientation of a given pic
// https://stackoverflow.com/questions/7584794/accessing-jpeg-exif-rotation-data-in-javascript-on-the-client-side/32490603#32490603
const iOs = !isNode && /iPad|iPhone|iPod/.test(navigator.platform)
export function getOrientation(file, callback) {
  if (iOs) return callback(0) // iOs always display images with correct orientation, no need to do it manually

  const reader = new FileReader()
  reader.onerror = function(event) {
    reader.abort()
    callback(-1)
  }
  reader.onload = function(e) {
    const view = new DataView(e.target.result)
    if (view.getUint16(0, false) != 0xffd8) return callback(-2)
    const length = view.byteLength
    let offset = 2
    let marker, little, tags, i
    while (offset < length) {
      if (view.getUint16(offset + 2, false) <= 8) return callback(-1)
      marker = view.getUint16(offset, false)
      offset += 2
      if (marker == 0xffe1) {
        if (view.getUint32((offset += 2), false) != 0x45786966) return callback(-1)
        little = view.getUint16((offset += 6), false) == 0x4949
        offset += view.getUint32(offset + 4, little)
        tags = view.getUint16(offset, little)
        offset += 2
        for (i = 0; i < tags; ++i)
          if (view.getUint16(offset + i * 12, little) == 0x0112)
            return callback(view.getUint16(offset + i * 12 + 8, little))
      } else if ((marker & 0xff00) != 0xff00) {
        break
      } else {
        offset += view.getUint16(offset, false)
      }
    }
    return callback(-1)
  }
  reader.readAsArrayBuffer(file.slice(0, 64 * 4 * 1024))
}

export function convertGif(file, callback, error) {
  const img = new Image()
  img.onerror = error
  img.onload = () => {
    URL.revokeObjectURL(file)
    canvas.width = img.width
    canvas.height = img.height
    ctx.drawImage(img, 0, 0)
    callback(canvas.toDataURL())
  }
  img.src = URL.createObjectURL(file)
}

// Take a snapshot of the video stream
export function takePic(video, callback) {
  canvas.width = video.videoWidth
  canvas.height = video.videoHeight
  ctx.drawImage(video, 0, 0)
  canvas.toBlob(callback, 'image/png')
}

export function transformPic(image, options, callback) {
  canvas.width = options.width
  canvas.height = options.height

  const nw2 = image.naturalWidth / 2
  const nh2 = image.naturalHeight / 2
  const rad = (options.rotate * Math.PI) / 180
  const x1 = -nw2 + options.left
  const y1 = -nh2 + options.top
  const x2 = -nw2 + (options.left + options.width)
  const y2 = -nh2 + (options.top + options.height)
  const coord1 = newCoord(x1, y1, rad)
  const coord2 = newCoord(x2, y2, rad)
  let left = Math.min(coord1.x, coord2.x) + nw2
  let top = Math.min(coord1.y, coord2.y) + nh2
  const right = Math.max(coord1.x, coord2.x) + nw2
  const bottom = Math.max(coord1.y, coord2.y) + nh2
  let width = right - left
  let height = bottom - top
  const add = newSize(width, height, rad)
  const addWidth = Math.abs(add.width - width)
  const addHeight = Math.abs(add.height - height)

  left -= addWidth
  top -= addHeight
  width += addWidth * 2
  height += addHeight * 2

  if (options.flip.h < 0) left = image.naturalWidth - left - width
  if (options.flip.v < 0) top = image.naturalHeight - top - height

  ctx.save()
  ctx.translate(canvas.width / 2, canvas.height / 2)
  ctx.rotate((Math.PI / 180) * options.rotate)
  ctx.scale(options.flip.h, options.flip.v)
  ctx.drawImage(image, left, top, width, height, -width / 2, -height / 2, width, height)
  ctx.restore()
  const downsizeCallback = () => {
    if (options.webp && _webPSupport) {
      canvas.toBlob(callback, 'image/webp')
    } else {
      canvas.toBlob(callback, 'image/jpeg', 0.92)
    }
  }
  if (options.resizeToWidth) {
    downsize(canvas, ctx, options.resizeToWidth, options.resizeToHeight, downsizeCallback)
  } else {
    downsizeCallback()
  }
}

function newCoord(x, y, rad) {
  const sin = Math.sin(rad)
  const cos = Math.cos(rad)
  return { x: x * cos + y * sin, y: -x * sin + y * cos }
}

function newSize(width, height, rad) {
  const cos = Math.abs(Math.cos(rad))
  const sin = Math.abs(Math.sin(rad))
  return {
    width: height * sin + width * cos,
    height: height * cos + width * sin,
  }
}
