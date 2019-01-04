import { addClass, removeClass } from './dom'
import { each } from './tools'

export function getQueryFunc(container) {
  return (selector, parent) => (parent || container).querySelector(selector)
}

export function getQueryAllFunc(container) {
  return (selector, parent) => (parent || container).querySelectorAll(selector)
}

export function getLoadingFunc(container) {
  return state => {
    ;(state !== false ? addClass : removeClass)(container, 'loading')
  }
}

export function stopObserving(events) {
  each(events, func => {
    func()
  })
}
