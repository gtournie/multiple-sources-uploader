import isNode from './is-node'

let _addHTML = function(elt, html) {
  elt.innerHTML += html
  return elt
}

if (!isNode) {
  const proto = Element.prototype
  if (!proto.matches) {
    proto.matches =
      proto.matchesSelector ||
      proto.mozMatchesSelector ||
      proto.msMatchesSelector ||
      proto.oMatchesSelector ||
      proto.webkitMatchesSelector
  }
  if (proto.insertAdjacentHTML) {
    _addHTML = function(elt, html) {
      elt.insertAdjacentHTML('beforeend', html)
      return elt
    }
  }
}

export const addHTML = _addHTML

export function hide(elt) {
  if (elt) elt.style.display = 'none'
  return elt
}

export function show(elt) {
  if (elt) elt.style.display = ''
  return elt
}

export function addClass(elt, className) {
  if (` ${elt.className} `.indexOf(` ${className} `) < 0) elt.className += ` ${className}`
  return elt
}

export function removeClass(elt, className) {
  className = ` ${className} `
  let cName = ` ${elt.className} `
  while (cName.indexOf(className) >= 0) cName = cName.replace(className, ' ')
  elt.className = cName.trim()
  return elt
}

export function remove(elt) {
  elt && elt.parentNode && elt.parentNode.removeChild(elt)
}

export function on(elt, eventNames, selector, handler, options) {
  let func = selector
  if ('function' !== typeof selector) {
    const selectorPlus = selector
      .split(',')
      .map(s => s + ' *')
      .join(',')
    func = event => {
      if (event.target.matches(selector)) {
        event.currTarget = event.target
        handler(event)
      } else if (event.target.matches(selectorPlus)) {
        for (let elem = event.target; elem && elem !== elt; elem = elem.parentNode)
          if (elem.matches(selector)) event.currTarget = elem
        handler(event)
      }
    }
  } else {
    options = handler
  }
  eventNames = eventNames.split(',')
  eventNames.forEach(eventName => elt.addEventListener(eventName, func, options || false))
  return () =>
    eventNames.forEach(eventName => {
      elt.removeEventListener(eventName, func)
    })
}
