import isNode from './is-node'

const TRANSFORM_PROP = isNode
  ? false
  : (style => {
      if (null != style.transform) return 'transform'
      const prefixes = ['Webkit', 'Moz', 'O', 'ms']
      for (let i = 0, prop; (prop = prefixes[i]); ++i) if (null != style[(prop += 'Transform')]) return prop
    })(document.createElement('div').style)

export function transform(element, rot, flip, scale) {
  element.style[TRANSFORM_PROP] = `rotate(${rot}deg) scale(${flip.h * scale}, ${flip.v * scale})`
}

export function applyRatio(width, height, ratio) {
  const widthFit = width / height <= ratio.v / ratio.h
  return {
    width: Math.round(widthFit ? width : (height * ratio.v) / ratio.h),
    height: Math.round(widthFit ? (width * ratio.h) / ratio.v : height),
  }
}

export function position(style, coords) {
  style.top = `${Math.round(coords.top)}px`
  style.left = `${Math.round(coords.left)}px`
  style.width = `${Math.round(coords.width)}px`
  style.height = `${Math.round(coords.height)}px`
}
