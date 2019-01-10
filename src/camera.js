import { getQueryFunc, getLoadingFunc, stopObserving } from './tools/tab'
import { on, show, hide, addClass, removeClass } from './tools/dom'
import { mediaDevices, takePic } from './tools/image'
import { transform } from './tools/position'
import { each } from './tools/tools'

export default function Camera(tabContainer, args) {
  const $ = getQueryFunc(tabContainer)
  const loading = getLoadingFunc(tabContainer)

  const pic = $('.pic')
  const video = $('.video')

  let events
  function observe() {
    events = [
      on(video, 'loadedmetadata', videoPlay),
      on($('.take-photo'), 'click', takePhoto),
      on($('.take-another-one'), 'click', takeAnotherOne),
      on($('.use-it'), 'click', useIt),
      on(tabContainer, 'click', '.flip', e => flipIt(e.currTarget.getAttribute('data-dir'))),
    ]
  }

  let flip, stream, streaming, blob
  function onEnter() {
    flip = { v: 1, h: 1 }
    streaming = false

    loading()
    mediaDevices
      .getMedia({ video: true })
      .catch(() => {
        loading(false)
        args.flash('camera_access_error', { back: true })
      })
      .then(s => {
        stream = s
        if ('srcObject' in video) {
          video.srcObject = stream
        } else {
          // Avoid using this in new browsers, as it is going away.
          video.src = URL.createObjectURL(stream)
        }
        video.play()
      })
  }

  function onLeave() {
    if (stream) {
      if (stream.getTracks)
        each(stream.getTracks(), track => {
          track.stop()
        })

      if (blob) URL.revokeObjectURL(blob)
      try {
        URL.revokeObjectURL(stream)
      } catch (e) {}
    }
    takeAnotherOne()
  }

  function videoPlay() {
    if (!streaming) {
      streaming = true
      loading(false)
      transformMedia()
    }
  }

  function takeAnotherOne() {
    pic.style.backgroundImage = ''
    removeClass(tabContainer, 'pic-mode')
  }

  function transformMedia() {
    transform(video, 0, flip, 1)
    transform(pic, 0, flip, 1)
  }

  function flipIt(prop) {
    flip[prop] *= -1
    transformMedia()
  }

  function useIt() {
    args.onSelect(blob, 0, flip)
  }

  function takePhoto() {
    takePic(video, b => {
      if (blob) URL.revokeObjectURL(blob)
      blob = b
      pic.style.backgroundImage = `url('${URL.createObjectURL(blob)}')`
    })
    addClass(tabContainer, 'pic-mode')
  }

  return {
    onEnter: () => {
      onEnter()
      observe()
    },
    onLeave: () => {
      stopObserving(events)
      onLeave()
    },
  }
}
