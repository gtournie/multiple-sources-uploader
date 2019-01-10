import { on, addClass, removeClass, show, hide, remove } from './tools/dom'
import { getQueryFunc, getQueryAllFunc, stopObserving } from './tools/tab'
import { each } from './tools/tools'
import isNode from './tools/is-node'
import detectCamera from './tools/detect-camera'
import Cropper from './cropper'
import Uploader from './uploader'
import Local from './local'
import Camera from './camera'
import Facebook from './sources/facebook'
import GooglePhotos from './sources/google-photos'
import Instagram from './sources/instagram'
import en from './locales/en'

import {
  renderWheel,
  FLIP_V_ICON,
  FLIP_H_ICON,
  CROP_ICON,
  FILE_ICON,
  CAMERA_ICON,
  FACEBOOK_ICON,
  GOOGLE_PHOTOS_ICON,
  INSTAGRAM_ICON,
  ROTATE_LEFT_ICON,
  ROTATE_RIGHT_ICON,
  ZOOM_PLUS_ICON,
  ZOOM_MINUS_ICON,
} from './icons'

// EN by default
let messages = en
MSUploader.setMessages = m => {
  messages = m
}

const TEMPLATE = () => {
  return `<div class="popup">
<div class="popup-content">
<button type="button" class="close"></button>
<div class="source-head">
  <div class="desc">${i18n('or_choose_from')}</div>
  <div class="tab" data-target=".crop-content" style="display: none" title="${i18n('tab_crop')}">
  ${CROP_ICON}</div>
  <div class="tab active" data-target=".local-content" title="${i18n('tab_local')}">${FILE_ICON}</div>
  <div style="display:none" class="tab" data-target=".camera-content" title="${i18n('tab_camera')}">${CAMERA_ICON}</div>
  <div class="tab source-tab" data-key="facebook" data-target=".facebook-content" title="${i18n(
    'tab_facebook',
  )}">${FACEBOOK_ICON}</div>
  <div class="tab source-tab" data-key="googlePhotos" data-target=".google-photos-content" title="${i18n(
    'tab_google_photos',
  )}">${GOOGLE_PHOTOS_ICON}</div>
  <div class="tab source-tab" data-key="instagram" data-target=".instagram-content" title="${i18n(
    'tab_instagram',
  )}">${INSTAGRAM_ICON}</div>
</div>
<div class="source-body">
  <div class="flash"></div>
  <div class="back-to-menu link">${i18n('menu')}</div>
  <div style="display: none" class="crop-content">
    <div class="preview">
      <div class="ctn"><img crossorigin="anonymous" /></div>
      <div><div class="btn lesser back">${i18n('back')}</div><div class="btn upload">${i18n('upload')}</div></div>
    </div>
    <div class="actions">
      <div class="rotate" data-add="-90">${ROTATE_LEFT_ICON}</div>
      <div class="rotate" data-add="90">${ROTATE_RIGHT_ICON}</div>
      <div class="flip" data-dir="h">${FLIP_H_ICON}</div>
      <div class="flip" data-dir="v">${FLIP_V_ICON}</div>
      <div class="zoom" data-zoom="+">${ZOOM_PLUS_ICON}</div>
      <div class="zoom" data-zoom="-">${ZOOM_MINUS_ICON}</div>
    </div>
    <div class="crop-container">
      <div class="media-container">
        <div class="img-container">
          <img crossorigin="anonymous" />
          <div class="cropper">
            <div data-pos="tl" class="handle handle-tl"></div>
            <div data-pos="tr" class="handle handle-tr"></div>
            <div data-pos="bl" class="handle handle-bl"></div>
            <div data-pos="br" class="handle handle-br"></div>
          </div>
        </div>
      </div>
      <div class="wheel" data-dir="h">${renderWheel(true)}</div>
      <div class="wheel" data-dir="v">${renderWheel()}</div>
    </div>
    <div class="reset link">${i18n('reset')}</div>
    <div class="done btn">${i18n('ok')}</div>
  </div>
  <div style="display: none" class="local-content">
    <div class="drop-area" data-help="${i18n('drop_a_file')}">
      <div class="lbl">${i18n('drag_n_drop')}</div>
      <div class="or">${i18n('or')}</div>
      <div class="file-btn btn">
        ${i18n('choose_a_file')}
        <input type="file" title="" />
      </div>
    </div>
  </div>
  <div style="display: none" class="camera-content">
    <div class="lbl">${i18n('camera_title')}</div>
    <div class="video-container">
      <div class="wrapper">
        <video class="video"></video>
        <div class="pic"></div>
        <div class="actions">
          <span class="flip" data-dir="h">${FLIP_H_ICON}</span>
          <span class="flip" data-dir="v">${FLIP_V_ICON}</span>
        </div>
      </div>
    </div>
    <div class="stream-off">
      <button class="take-another-one btn lesser">${i18n('camera_another_one')}</button>
      <button class="use-it btn">${i18n('camera_use_it')}</button>
    </div>
    <div class="stream-on">
      <button class="take-photo btn">${i18n('camera_take_photo')}</button>
    </div>
  </div>
  <div style="display: none" class="direct-content">
  </div>
  <div style="display: none" class="source-content">
    <div style="display: none" class="view albums">
      <div class="lbl">${i18n('albums_title')}</div>
      <div class="list"></div>
    </div>
    <div style="display: none" class="view photos">
      <div class="lbl album-name">${i18n('photos_title')}</div>
      <div class="action"><span class="back link">${i18n('back')}</span></div>
      <div class="list"></div>
    </div>
  </div>
  <div style="display: none" class="facebook-content source">
    <div class="view intro">
      <div class="lbl">${i18n('facebook_desc')}</div>
      <button class="connect btn">${i18n('facebook_btn')}</button>
    </div>
  </div>
  <div style="display: none" class="google-photos-content source">
    <div class="view intro">
      <div class="lbl">${i18n('google_photos_desc')}</div>
      <button class="connect btn">${i18n('google_photos_btn')}</button>
    </div>
  </div>
  <div style="display: none" class="instagram-content source">
    <div class="view intro">
      <div class="lbl">${i18n('instagram_desc')}</div>
      <button class="connect btn">${i18n('instagram_btn')}</button>
    </div>
  </div>
</div>
</div>
</div>`
}

const MANAGERS = {
  'crop-content': Cropper,
  'local-content': Local,
  'camera-content': Camera,
  'facebook-content': Facebook,
  'google-photos-content': GooglePhotos,
  'instagram-content': Instagram,
}

let container
let hasCamera = null

function displayCameraTab(camera) {
  if (!container || null === camera) return (hasCamera = camera)
  ;(camera ? show : remove)(container.querySelector('[data-target=".camera-content"]'))
}

detectCamera(displayCameraTab)

export default function MSUploader(options) {
  if (isNode) return

  options = options || {}

  const cropperOptions = options.cropper || {}
  const ratio = cropperOptions.ratio
  let minWidth = cropperOptions.minWidth
  let minHeight = cropperOptions.minHeight

  if (ratio && (minWidth || minHeight)) {
    if (!minWidth || (minHeight && ratio.v > ratio.h)) minWidth = (minHeight * ratio.v) / ratio.h
    if (!minHeight || (minWidth && ratio.v <= ratio.h)) minHeight = (minWidth * ratio.h) / ratio.v
    minWidth = Math.round(minWidth)
    minHeight = Math.round(minHeight)
  }

  const managers = {}
  const events = []
  let oldTab, previousTab, manager, args

  // Uploader
  const uploader = Uploader(options.uploader)
  const upload = file => {
    destroy()
    uploader.upload(file, options.uploader.data)
  }

  // Inject HTML
  container = document.createElement('div')
  addClass(container, 'msu-ctn')
  container.innerHTML = TEMPLATE()
  const $ = getQueryFunc(container)
  const $$ = getQueryAllFunc(container)

  // Close
  events.push(on(container, 'click', '.close', destroy))
  events.push(
    on(container, 'click', e => {
      if (e.target === container) destroy()
    }),
  )

  // Display tabs or not
  displayCameraTab(hasCamera)
  each($$('.source-tab'), source => {
    if (!options[source.getAttribute('data-key')]) remove(source)
  })

  // Set device orientation
  events.push(on(window, 'orientationchange', setOrientation))
  let resizeTimer
  events.push(
    on(window, 'resize', () => {
      clearTimeout(resizeTimer)
      resizeTimer = setTimeout(onResize, 100)
    }),
  )
  setOrientation()

  // Flash alert
  let flashTimer
  const flashCtn = hide(container.querySelector('.flash'))

  // Manager args
  const gOptions = {
    container,
    upload,
    onSelect,
    flash,
    i18n: i18n,
    options,
    minWidth: minWidth || 0,
    minHeight: minHeight || 0,
  }

  // Manage tabs
  const cropTab = $('[data-target=".crop-content"]')
  events.push(
    on(container, 'click', '.tab', e => {
      setTab(e.currTarget)
    }),
    on(container, 'click', '.back-to-menu', () => {
      setTab($('[data-target=".local-content"]'))
    }),
  )
  setTab(container.querySelector('.tab.active'), false)
  ;(options.parent || document.body).appendChild(container)

  function backToPreviousTab() {
    setTab(previousTab)
  }

  function setTab(tab, showCropTab) {
    ;(showCropTab ? show : hide)(cropTab)
    if (oldTab) {
      const oldTarget = oldTab.getAttribute('data-target')
      manager.onLeave()
      hide(container.querySelector(oldTarget))
      removeClass(oldTab, 'active')
    }
    const target = addClass(tab, 'active').getAttribute('data-target')
    container.setAttribute('data-tab', target)
    const tabContentElt = show($(target))
    const managerType = target.slice(1)
    manager = managers[managerType] = managers[managerType] || MANAGERS[managerType](tabContentElt, gOptions)
    manager.onEnter.apply(manager, args)
    previousTab = oldTab || tab
    oldTab = tab
  }

  function onSelect(dataURI, rot, flip) {
    args = [dataURI, rot, flip]
    setTab($('[data-target=".crop-content"]'), true)
  }

  function destroy() {
    manager.onLeave()
    stopObserving(events)
    remove(container)
  }

  function detectOrientation() {
    if (window.matchMedia) return matchMedia('(orientation: portrait)').matches ? 'portrait' : 'landscape'
    let screen = window.screen
    let orientation = null
    let portrait = false
    if (screen) {
      if (screen.orientation) {
        let type = screen.orientation.type
        if (type) return type.indexOf('portrait') >= 0 ? 'portrait' : 'landscape'
        orientation = screen.orientation.angle
      } else {
        portrait = screen.height > screen.width
      }
    }
    orientation = null !== orientation ? orientation : window.orientation
    return (null != orientation ? 0 === orientation : portrait) ? 'portrait' : 'landscape'
  }

  function onResize() {
    if (setContainerHeight()) {
      manager.onOrientationChange && manager.onOrientationChange()
    }
  }

  // Fix height on Safari/iOs
  function setContainerHeight() {
    if (window.matchMedia && matchMedia('(orientation: landscape), (max-width: 759px), (max-height: 500px)')) {
      let change = container.style.height
      container.style.height = ''
      if (window.innerHeight !== container.getBoundingClientRect().height) {
        container.style.height = `${window.innerHeight}px`
        window.scrollTo(0, 0)
        return true
      }
      return !!change
    }
    return false
  }

  function setOrientation() {
    setTimeout(() => {
      removeClass(container, 'portrait')
      removeClass(container, 'landscape')
      addClass(container, detectOrientation())
      setContainerHeight()
      manager.onOrientationChange && manager.onOrientationChange()
    }, 200)
  }

  function flash(message, options) {
    options = options || {}
    if (options.back) backToPreviousTab()
    clearTimeout(flashTimer)
    flashCtn.className = `flash ${options.type || 'danger'}`
    flashCtn.innerHTML = i18n(message, options.values)
    show(flashCtn)
    flashTimer = setTimeout(() => hide(flashCtn), 3000)
  }

  return {
    destroy: destroy,
  }
}

function i18n(prop, values) {
  let msg = messages[prop]
  if (values)
    each(Object.keys(values), k => {
      msg = msg.replace(new RegExp(`\{${k}\}`), values[k])
    })
  return msg
}

export { messages }
module.exports = MSUploader
