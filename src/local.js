import { getQueryFunc, getLoadingFunc, stopObserving } from './tools/tab'
import isNode from './tools/is-node'
import { on, addClass, removeClass } from './tools/dom'
import { webPSupport } from './tools/image'

const DRAG_N_DROP_SUPPORT = isNode
  ? false
  : (div => 'draggable' in div || ('ondragstart' in div && 'ondrop' in div))(document.createElement('div'))

const ACCEPT_SEP_REG = /\s*,\s*/
const ESCAPE_REG = /([.+?^=!:${}()|[\]\/\\])/g // Removed star char
const ANY_REG = /\*/g

export default function Local(tabContainer, args) {
  const flash = args.flash
  const options = args.options.local || {}
  options.accept = options.accept || 'image/jpeg,image/gif,image/png,image/webp'

  const $ = getQueryFunc(tabContainer)
  const loading = getLoadingFunc(tabContainer)

  const dropArea = $('.drop-area')
  const input = $('input')

  const accept = options.accept
    .trim()
    .toLowerCase()
    .split(ACCEPT_SEP_REG)
    .reduce((acc, type) => {
      if (type && (webPSupport || ('image/webp' !== type && '.webp' !== type))) {
        acc.push(
          type.charAt(0) === '.' || type.indexOf('*') < 0
            ? type
            : new RegExp('^' + type.replace(ESCAPE_REG, '\\$1').replace(ANY_REG, '.*') + '$', 'i'),
        )
      }
      return acc
    }, [])

  if (accept) input.setAttribute('accept', options.accept)

  if (!DRAG_N_DROP_SUPPORT) addClass(dropArea, 'no-support')

  let events
  function observe() {
    events = [
      on(input, 'change', e => {
        handleFile(input.files[0])
        input.value = null
      }),
    ]
    if (DRAG_N_DROP_SUPPORT) {
      events = events.concat(
        ['drag', 'dragstart', 'dragend', 'dragenter', 'dragover', 'dragleave', 'drop'].map(eventName =>
          on(dropArea, eventName, preventDefaults),
        ),
        ['dragenter', 'dragover'].map(eventName => on(dropArea, eventName, highlight)),
        ['dragleave', 'dragend', 'drop'].map(eventName => on(dropArea, eventName, unhighlight)),
        on(dropArea, 'drop', e => handleFile(e.dataTransfer.files[0])),
      )
    }
  }

  function handleFile(file) {
    if (!file) return

    // Validation
    const ftype = (file.type || '').toLowerCase()
    const fext = fileExt(file.name || '')
    if (
      accept &&
      !accept.some(type =>
        typeof type === 'string' ? type === (type.charAt(0) === '.' ? fext : ftype) : type.test(ftype),
      )
    ) {
      return flash('invalid_file_type')
    }

    args.onSelect(file)
  }

  function highlight() {
    addClass(dropArea, 'highlight')
  }

  function unhighlight() {
    removeClass(dropArea, 'highlight')
  }

  return {
    onEnter: observe,
    onLeave: () => stopObserving(events),
  }
}

function preventDefaults(e) {
  e.preventDefault()
  e.stopPropagation()
}

function fileExt(filename) {
  return filename.slice(((filename.lastIndexOf('.') - 1) >>> 0) + 1).toLowerCase()
}
