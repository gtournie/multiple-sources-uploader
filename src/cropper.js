import { getQueryFunc, getQueryAllFunc, getLoadingFunc, stopObserving } from './tools/tab'
import { on, show, hide, addClass, removeClass } from './tools/dom'
import { transformPic, newSize, resetOrientation, dataURItoBlob } from './tools/image'
import { position, transform, applyRatio } from './tools/position'
import { each } from './tools/tools'

const ADJUST_RATIO = {
  left: (pos, otherSide, posLeft, posTop, posRight, posBottom, ratio) => {
    // height: posBottom.bottom - posTop.top
    pos[otherSide] = Math.round(posRight.right - (ratio.v * (posBottom.bottom - posTop.top)) / ratio.h)
  },
  right: (pos, otherSide, posLeft, posTop, posRight, posBottom, ratio) => {
    // height: posBottom.bottom - posTop.top
    pos[otherSide] = Math.round(posLeft.left + (ratio.v * (posBottom.bottom - posTop.top)) / ratio.h)
  },
  top: (pos, otherSide, posLeft, posTop, posRight, posBottom, ratio) => {
    // width: posRight.right - posLeft.left
    pos[otherSide] = Math.round(posBottom.bottom - (ratio.h * (posRight.right - posLeft.left)) / ratio.v)
  },
  bottom: (pos, otherSide, posLeft, posTop, posRight, posBottom, ratio) => {
    // width: posRight.right - posLeft.left
    pos[otherSide] = Math.round(posTop.top + (ratio.h * (posRight.right - posLeft.left)) / ratio.v)
  },
}

// https://stackoverflow.com/questions/2752725/finding-whether-a-point-lies-inside-a-rectangle-or-not#37865332
function pointInRectangle(ax, ay, bx, by, cx, cy, px, py) {
  const abx = bx - ax
  const aby = by - ay
  const bcx = cx - bx
  const bcy = cy - by
  const dotABAP = abx * (px - ax) + aby * (py - ay)
  const dotBCBP = bcx * (px - bx) + bcy * (py - by)
  return 0 <= dotABAP && dotABAP <= abx * abx + aby * aby && 0 <= dotBCBP && dotBCBP <= bcx * bcx + bcy * bcy
}

export default function Cropper(tabContainer, args) {
  const minWidth = args.minWidth
  const minHeight = args.minHeight
  const previewOnly = !args.options.cropper
  const options = args.options.cropper || {}
  const flash = args.flash

  const $ = getQueryFunc(tabContainer)
  const $$ = getQueryAllFunc(tabContainer)
  const loading = getLoadingFunc(tabContainer)
  const ratio = options.ratio

  const viewportmeta = document.querySelector('meta[name="viewport"]')
  const mediaContainer = $('.media-container')
  const cropper = $('.cropper')
  const img = hide($('img', mediaContainer))
  const wheels = $$('.wheel')
  const preview = $('.preview img')

  preview.onload = () => {
    loading(false)
    URL.revokeObjectURL(uploadBlob)
  }
  preview.onerror = () => {
    loading(false)
    removeClass(tabContainer, 'preview-mode')
    flash('load_error')
  }

  img.onload = imageReady
  img.onerror = e => {
    loading(false)
    flash('load_error', { back: true })
  }

  const imgStyle = img.style
  const cropStyle = cropper.style

  let blob,
    uploadBlob,
    rot,
    baseRot,
    scale,
    flip,
    imgWidth,
    imgHeight,
    handleInfo,
    imgInfo,
    mouseInfo,
    wheelInfo,
    zoomInfo,
    scaleStep,
    metaSave,
    params,
    timeoutRepeat
  let evCache = []
  let prevDiff = -1

  let events
  function observe() {
    // TODO: touch support. Zoom...
    events = [
      on(tabContainer, 'touchstart,mousedown', '.handle,.cropper,img', pointerDown),
      on(tabContainer, 'touchstart,mousedown', '.wheel', wheelDown),
      // on(tabContainer, 'touchstart', '.img-container', zoomDown),
      on(document, 'touchend,touchcancel,mouseup', pointerUp),
      on(document, 'touchmove,mousemove', pointerMove),
      on(tabContainer, 'click', '.reset', reset),
      on(tabContainer, 'click', '.done', crop),
      on(tabContainer, 'click', '.rotate', e => {
        rotateIt(0, +e.currTarget.getAttribute('data-add'))
      }),
      on(tabContainer, 'click', '.flip', e => {
        flipIt(e.currTarget.getAttribute('data-dir'))
      }),
      on(tabContainer, 'click', '.zoom', e => {
        zoomIt(e.currTarget.getAttribute('data-zoom'))
      }),
      on(
        document,
        'touchmove',
        e => {
          e.preventDefault()
        },
        { passive: false },
      ),
      on(tabContainer, 'click', '.back', () => {
        if (previewOnly) {
          args.back()
        } else {
          removeClass(tabContainer, 'preview-mode')
        }
      }),
      on(tabContainer, 'click', '.upload', () => {
        args.upload(uploadBlob)
      }),
      on(document, 'contextmenu', e => {
        // Deactivate right click
        e.preventDefault()
      }),
    ]
  }

  function imagePos() {
    return {
      left: parseFloat(imgStyle.left),
      top: parseFloat(imgStyle.top),
    }
  }

  function cropperMetrics() {
    const left = parseFloat(cropStyle.left)
    const top = parseFloat(cropStyle.top)
    const width = parseFloat(cropStyle.width)
    const height = parseFloat(cropStyle.height)
    return {
      left: left,
      top: top,
      right: left + width,
      bottom: top + height,
      width: width,
      height: height,
    }
  }

  function onEnter(dataURI, r, f) {
    params = [r, f]
    loading()
    if (previewOnly) addClass(tabContainer, 'preview-mode')

    if (viewportmeta) {
      metaSave = viewportmeta.content
      if (metaSave.indexOf('maximum-scale') < 0) viewportmeta.content += ',maximum-scale=1.0'
    }
    init()

    const destination = previewOnly ? preview : img
    if ('string' !== typeof dataURI) {
      if (dataURI instanceof File) {
        return resetOrientation(dataURI, b => {
          blob = b
          destination.src = URL.createObjectURL(blob)
        })
      }
      blob = dataURI
      dataURI = URL.createObjectURL(blob)
      if (previewOnly) uploadBlob = blob
    } else if (previewOnly) {
      uploadBlob = dataURItoBlob(dataURI)
    }
    destination.src = dataURI
  }

  function init() {
    baseRot = params[0] || 0
    rot = 0
    scale = 1
    flip = params[1] || { h: 1, v: 1 }
    imgStyle.cssText = 'top:0;left:0'
    cropStyle.cssText = ''
    timeoutRepeat = 0
    each(wheels, wheel => {
      transform(wheel, rot, flip, scale)
    })
  }

  function reset() {
    init()
    imageReady()
  }

  function onLeave() {
    hide(img)
    removeClass(tabContainer, 'preview-mode')
    if (metaSave) viewportmeta.content = metaSave
  }

  function imageReady() {
    if (blob) {
      URL.revokeObjectURL(blob)
      blob = null
    }
    // 2 next lines: fix issue with naturalWidth & naturalHeight inverted
    show(img)
    img.offsetHeight

    const nw = img.naturalWidth
    const nh = img.naturalHeight

    // on iOs naturalWiidth & naturalHeight are equal to 0 sometimes
    if ((!nw || !nh) && ++timeoutRepeat < 6) return setTimeout(imageReady, 50)

    if (nw < minWidth || nh < minHeight) {
      return flash('too_small', { back: true, values: { min: `${minWidth}x${minHeight}` } })
    }

    const invert = 90 === baseRot || 270 == baseRot

    const dimImg = applyRatio(
      (invert ? mediaContainer.clientHeight : mediaContainer.clientWidth) - 20,
      (invert ? mediaContainer.clientWidth : mediaContainer.clientHeight) - 20,
      { v: nw, h: nh },
    )
    if (dimImg.width > nw) {
      dimImg.width = nw
      dimImg.height = nh
    }
    transform(img, baseRot + rot, flip, scale)
    imgStyle.width = dimImg.width + 'px'
    imgStyle.height = dimImg.height + 'px'
    imgWidth = dimImg.width
    imgHeight = dimImg.height
    scaleStep = Math.max((imgHeight + 80) / imgHeight, (imgWidth + 80) / imgWidth) - 1

    if (ratio) {
      const dimCrop = applyRatio(invert ? dimImg.height : dimImg.width, invert ? dimImg.width : dimImg.height, ratio)
      position(cropStyle, {
        top: (dimImg.height - dimCrop.height) / 2,
        left: (dimImg.width - dimCrop.width) / 2,
        width: dimCrop.width,
        height: dimCrop.height,
      })
    } else {
      position(cropStyle, { top: 0, left: 0, width: dimImg.width, height: dimImg.height })
    }
    loading(false)

    // DEBUG
    // setInterval(() => {
    //   const imgPos = imagePos()
    //   const metrics = cropperMetrics()
    //   const inside = cropperInsideImg(
    //     scale,
    //     imgPos.left,
    //     imgPos.top,
    //     metrics.left,
    //     metrics.top,
    //     metrics.width,
    //     metrics.height,
    //   )
    //   cropper.classList[inside ? 'remove' : 'add']('outside')
    // }, 100)
  }

  function flipIt(prop) {
    flip[prop] *= -1
    transform(img, baseRot + rot, flip, scale)
  }

  function roundScale(n) {
    return 1 + Math.round((n - 1) / scaleStep) * scaleStep
  }

  function zoomIt(prop) {
    const plus = prop === '+'
    scale = Math.max(0, roundScale(scale + (plus ? scaleStep : -scaleStep)))
    if (plus) {
      checkBigScale()
    } else {
      checkSmallScale()
    }
    transform(img, baseRot + rot, flip, scale)
  }

  function rotateIt(add, addBase) {
    const oldRot = rot
    rot = (rot + add + 360) % 360
    if (rot > 180) rot -= 360
    rot = Math.max(-45, Math.min(rot, 45))
    baseRot = (baseRot + (addBase || 0) + 360) % 360
    checkSmallScale()
    const oldScale = scale
    checkBigScale()
    if (oldScale !== scale) {
      scale = oldScale
      return (rot = oldRot)
    } // TODO: message (image size must be > ? move / resize cropper to rotate the image?...)
    transform(img, baseRot + rot, flip, scale)
    each(wheels, wheel => {
      transform(wheel, rot, { h: 1, v: 1 }, 1)
    })
  }

  function cropperInsideImg(imgScale, imgX, imgY, cropperLeft, cropperTop, cropperWidth, cropperHeight) {
    const widthRatio = img.naturalWidth / (imgWidth * imgScale)
    const heightRatio = img.naturalHeight / (imgHeight * imgScale)

    cropperLeft = Math.round((cropperLeft - imgX + (imgWidth * (imgScale - 1)) / 2) * widthRatio)
    cropperTop = Math.round((cropperTop - imgY + (imgHeight * (imgScale - 1)) / 2) * heightRatio)
    const cropperRight = Math.floor(cropperLeft + cropperWidth * widthRatio)
    const cropperBottom = Math.floor(cropperTop + cropperHeight * heightRatio)

    const rad = ((baseRot + rot) * Math.PI) / 180
    const sin = Math.sin(-rad)
    const cos = Math.cos(-rad)
    const cw2 = img.naturalWidth / 2
    const ch2 = img.naturalHeight / 2
    const ypSin = cw2 * sin
    const ypCos = ch2 * cos
    const xpCos = cw2 * cos
    const xpSin = ch2 * sin
    const xp0 = Math.round(cw2 + -xpCos - xpSin)
    const xp1 = Math.round(cw2 + -xpCos + xpSin)
    const xp2 = Math.round(cw2 + xpCos + xpSin)
    const yp0 = Math.round(ch2 + ypSin - ypCos) // tl
    const yp1 = Math.round(ch2 + ypSin + ypCos) // bl
    const yp2 = Math.round(ch2 + -ypSin + ypCos) // br

    return (
      pointInRectangle(xp0, yp0, xp1, yp1, xp2, yp2, cropperLeft, cropperTop) &&
      pointInRectangle(xp0, yp0, xp1, yp1, xp2, yp2, cropperLeft, cropperBottom) &&
      pointInRectangle(xp0, yp0, xp1, yp1, xp2, yp2, cropperRight, cropperBottom) &&
      pointInRectangle(xp0, yp0, xp1, yp1, xp2, yp2, cropperRight, cropperTop)
    )
  }

  function checkBigScale() {
    if (minWidth) {
      // minSize = (imgWidth * minWidth) / img.naturalWidth
      scale = Math.min(scale, cropperMetrics().width / ((imgWidth * minWidth) / img.naturalWidth)) // TODO: message ? Size must be min AxB ?
    }
    if (minHeight) {
      // minSize = (imgHeight * minHeight) / img.naturalHeight
      scale = Math.min(scale, cropperMetrics().height / ((imgHeight * minHeight) / img.naturalHeight))
    }
  }

  function checkSmallScale() {
    const imgPos = imagePos()
    const metrics = cropperMetrics()
    const inside = scale =>
      cropperInsideImg(scale, imgPos.left, imgPos.top, metrics.left, metrics.top, metrics.width, metrics.height)

    if (!inside(scale)) {
      const maxSize =
        Math.sqrt(Math.pow(img.naturalWidth * (1 + scale), 2) + Math.pow(img.naturalHeight * (1 + scale), 2)) + 1
      const originalSize = Math.max(imgWidth, imgHeight)
      let size = Math.round(originalSize * scale)
      let count = Math.floor(Math.log10(Math.abs(maxSize - size)))
      let unit
      while (count > 0) {
        unit = Math.pow(10, --count)
        while (!inside(size / originalSize)) size += unit
        if (1 !== unit) size -= unit
      }
      scale = size / originalSize
    }
  }

  function crop() {
    loading()
    const widthRatio = img.naturalWidth / (imgWidth * scale)
    const heightRatio = img.naturalHeight / (imgHeight * scale)
    const cropMetrics = cropperMetrics()
    const imgPos = imagePos()
    const width = cropMetrics.width * widthRatio
    const height = cropMetrics.height * heightRatio
    let resizeToWidth = options.resizeToWidth

    if (!options.upscale && width <= resizeToWidth) {
      resizeToWidth = null
    }

    transformPic(
      img,
      {
        left: (cropMetrics.left - imgPos.left + (imgWidth * (scale - 1)) / 2) * widthRatio,
        top: (cropMetrics.top - imgPos.top + (imgHeight * (scale - 1)) / 2) * heightRatio,
        width: width,
        height: height,
        rotate: baseRot + rot,
        flip: flip,
        scale: scale,
        resizeToWidth: resizeToWidth,
        resizeToHeight: ratio
          ? (resizeToWidth * ratio.h) / ratio.v
          : (resizeToWidth * cropMetrics.height) / cropMetrics.width,
        webp: options.webpIfSupported,
      },
      blob => {
        uploadBlob = blob
        preview.src = URL.createObjectURL(blob)
        addClass(tabContainer, 'preview-mode')
      },
    )
  }

  // function zoomDown(e) {
  //   // setTimeout(() => {
  //   //   alert(e.touches.length)
  //   // }, 1000)
  // }

  // function zoomMove(e) {}

  // function zoomUp(e) {}

  function getEvent(e) {
    return e.touches ? e.touches[0] : e
  }

  function wheelDown(e) {
    e.preventDefault()

    const event = getEvent(e)
    wheelInfo = { scale: scale, dir: e.currTarget.getAttribute('data-dir') }
    mouseInfo = { x: event.clientX, y: event.clientY }
  }

  function wheelMove(diffX, diffY) {
    scale = wheelInfo.scale
    let diff = 'h' === wheelInfo.dir ? -diffY : diffX
    if ((rot > 0 && rot <= 4 && diff < 0) || (rot < 0 && rot >= -4 && diff > 0)) {
      diff = -rot
    } else {
      diff = Math.round(Math.round(diff) * 2) / 4
    }
    rotateIt(diff)
  }

  function wheelUp() {
    wheelInfo = null
  }

  function pointerDown(e) {
    e.preventDefault()
    if (handleInfo || imgInfo) return

    const event = getEvent(e)
    if (e.currTarget.matches('.handle')) {
      addClass(tabContainer, 'cropping')
      const dataPos = e.currTarget.getAttribute('data-pos')

      handleInfo = {
        pos: cropperMetrics(),
        originalPos: cropperMetrics(),
        min: {
          width: minWidth ? Math.ceil((imgWidth * scale * minWidth) / img.naturalWidth) : 0,
          height: minHeight ? Math.ceil((imgHeight * scale * minHeight) / img.naturalHeight) : 0,
        },
        handle: {
          left: dataPos.indexOf('l') >= 0,
          right: dataPos.indexOf('r') >= 0,
          top: dataPos.indexOf('t') >= 0,
          bottom: dataPos.indexOf('b') >= 0,
        },
      }
    } else {
      imgInfo = {
        pos: imagePos(),
        originalPos: imagePos(),
      }
    }
    mouseInfo = { x: event.clientX, y: event.clientY }
  }

  function handleUp() {
    removeClass(tabContainer, 'cropping')
    const pos = cropperMetrics()
    const imgPos = imagePos()
    const oPos = handleInfo.originalPos
    const handle = handleInfo.handle
    const inside = (top, right, bottom, left) =>
      cropperInsideImg(scale, imgPos.left, imgPos.top, left, top, right - left, bottom - top)

    if (!inside(pos.top, pos.right, pos.bottom, pos.left)) {
      const sides = [handle.left ? 'left' : 'right', handle.top ? 'top' : 'bottom']
      let otherSide

      // Only left or right side needs to be adjusted
      if (inside(pos.top, (handle.right ? oPos : pos).right, pos.bottom, (handle.left ? oPos : pos).left)) {
        otherSide = sides.pop()
        if (!ratio) oPos[otherSide] = pos[otherSide]
      }
      // Only top or bottom side needs to be adjusted
      if (inside((handle.top ? oPos : pos).top, pos.right, (handle.bottom ? oPos : pos).bottom, pos.left)) {
        otherSide = sides.shift()
        if (!ratio) oPos[otherSide] = pos[otherSide]
      }
      // If ratio needs to be applied, just ensure we calculate the width/height from the biggest diff
      if (ratio && sides.length > 1) {
        if (oPos[sides[0]] - pos[sides[0]] < oPos[sides[1]] - pos[sides[1]]) {
          sides.reverse()
        }
        otherSide = sides.pop()
      }
      const adjustRatio = ADJUST_RATIO[otherSide]

      let diff, count, original, lastPos, unit, width, height, within, posLeft, posTop, posRight, posBottom
      for (let i = 0, len = sides.length, side; i < len; ++i) {
        side = sides[i]
        diff = oPos[side] - pos[side]
        count = Math.floor(Math.log10(Math.abs(diff)))
        original = pos[side]
        posLeft = 'left' === side || 'left' === otherSide ? pos : oPos
        posTop = 'top' === side || 'top' === otherSide ? pos : oPos
        posRight = 'right' === side || 'right' === otherSide ? pos : oPos
        posBottom = 'bottom' === side || 'bottom' === otherSide ? pos : oPos
        pos[side] = oPos[side]
        if (ratio) pos[otherSide] = oPos[otherSide]
        while (count > 0) {
          unit = Math.pow(10, --count) * (diff < 0 ? -1 : 1)
          while (
            inside(posTop.top, posRight.right, posBottom.bottom, posLeft.left) &&
            (diff > 0 ? pos[side] >= original : pos[side] <= original)
          ) {
            pos[side] -= unit
            if (ratio) {
              lastPos = pos[otherSide]
              adjustRatio(pos, otherSide, posLeft, posTop, posRight, posBottom, ratio)
            }
          }
          pos[side] += unit
          if (ratio) pos[otherSide] = lastPos
        }
        oPos[side] = pos[side]
      }
    }

    pos.width = pos.right - pos.left
    pos.height = pos.bottom - pos.top
    position(cropStyle, pos)
    handleInfo = null
  }

  function imgUp() {
    const pos = imagePos()
    const oPos = imgInfo.originalPos
    const cPos = cropperMetrics()
    const inside = (imgX, imgY) => cropperInsideImg(scale, imgX, imgY, cPos.left, cPos.top, cPos.width, cPos.height)

    if (!inside(pos.left, pos.top)) {
      const sides = ['left', 'top']
      let side

      // Only left or top side needs to be adjusted
      if (inside(pos.left, oPos.top)) {
        side = sides.shift()
        oPos[side] = pos[side]
      } else if (inside(oPos.left, pos.top)) {
        side = sides.pop()
        oPos[side] = pos[side]
      }

      let diff, count, original, oPosX, oPosY, unit
      for (let i = 0, len = sides.length, side; i < len; ++i) {
        side = sides[i]
        diff = oPos[side] - pos[side]
        count = Math.floor(Math.log10(Math.abs(diff)))
        original = pos[side]
        oPosX = 'left' === side ? pos : oPos
        oPosY = 'top' === side ? pos : oPos

        pos[side] = oPos[side]
        while (count > 0) {
          unit = Math.pow(10, --count) * (diff < 0 ? -1 : 1)
          while (inside(oPosX.left, oPosY.top) && (diff > 0 ? pos[side] >= original : pos[side] <= original)) {
            pos[side] -= unit
          }
          pos[side] += unit
        }
        oPos[side] = pos[side]
      }
    }
    imgStyle.top = pos.top + 'px'
    imgStyle.left = pos.left + 'px'
    imgInfo = null
  }

  function pointerUp(e) {
    if (handleInfo) handleUp()
    else if (imgInfo) imgUp()
    else if (wheelInfo) wheelUp()
  }

  function pointerMove(e) {
    if (handleInfo || imgInfo || wheelInfo) {
      const event = getEvent(e)
      const clientX = event.clientX
      const clientY = event.clientY
      ;(handleInfo ? handleMove : imgInfo ? imgMove : wheelMove)(
        Math.round(mouseInfo.x - clientX),
        Math.round(mouseInfo.y - clientY),
      )
      mouseInfo = { x: clientX, y: clientY }
    }
  }

  function handleMove(diffX, diffY) {
    const pos = handleInfo.pos
    const handle = handleInfo.handle
    const min = handleInfo.min

    if (handle.top) pos.top -= diffY
    if (handle.left) pos.left -= diffX
    if (handle.bottom) pos.bottom -= diffY
    if (handle.right) pos.right -= diffX

    const dim = ratio ? applyRatio(pos.right - pos.left, pos.bottom - pos.top, ratio) : null
    const left = handle.left ? Math.min(pos.right - min.width, ratio ? pos.right - dim.width : pos.left) : pos.left
    const top = handle.top ? Math.min(pos.bottom - min.height, ratio ? pos.bottom - dim.height : pos.top) : pos.top
    const right = handle.right ? Math.max(pos.left + min.width, ratio ? pos.left + dim.width : pos.right) : pos.right
    const bottom = handle.bottom
      ? Math.max(pos.top + min.height, ratio ? pos.top + dim.height : pos.bottom)
      : pos.bottom

    position(cropStyle, {
      left: left,
      top: top,
      width: right - left,
      height: bottom - top,
    })
  }

  function imgMove(diffX, diffY) {
    const pos = imgInfo.pos
    imgStyle.top = (pos.top -= diffY) + 'px'
    imgStyle.left = (pos.left -= diffX) + 'px'
  }

  return {
    onEnter: (dataURI, rot, flip) => {
      onEnter(dataURI, rot, flip)
      observe()
    },
    onLeave: () => {
      stopObserving(events)
      onLeave()
    },
    onOrientationChange: reset,
  }
}
