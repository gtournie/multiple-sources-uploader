import isNode from './is-node'

// Copyright (C) 2014-2017 by Vitaly Puzrin

// Permission is hereby granted, free of charge, to any person obtaining a copy
// of this software and associated documentation files (the "Software"), to deal
// in the Software without restriction, including without limitation the rights
// to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
// copies of the Software, and to permit persons to whom the Software is
// furnished to do so, subject to the following conditions:

// The above copyright notice and this permission notice shall be included in
// all copies or substantial portions of the Software.

// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
// IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
// FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
// AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
// LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
// OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
// THE SOFTWARE.

const resize = () => {
  // Convolve image in horizontal directions and transpose output. In theory,
  // transpose allow:
  //
  // - use the same convolver for both passes (this fails due different
  //   types of input array and temporary buffer)
  // - making vertical pass by horizontal lines inprove CPU cache use.
  //
  // But in real life this doesn't work :)
  //
  const convolveHorizontally = function(src, dest, srcW, srcH, destW, filters) {
    let r, g, b, a
    let filterPtr, filterShift, filterSize
    let srcPtr, srcY, destX, filterVal
    let srcOffset = 0
    let destOffset = 0

    // For each row
    for (srcY = 0; srcY < srcH; srcY++) {
      filterPtr = 0

      // Apply precomputed filters to each destination row point
      for (destX = 0; destX < destW; destX++) {
        // Get the filter that determines the current output pixel.
        filterShift = filters[filterPtr++]
        filterSize = filters[filterPtr++]

        srcPtr = srcOffset + filterShift * 4

        r = g = b = a = 0

        // Apply the filter to the row to get the destination pixel r, g, b, a
        while (filterSize--) {
          filterVal = filters[filterPtr++]

          // Use reverse order to workaround deopts in old v8 (node v.10)
          // Big thanks to @mraleph (Vyacheslav Egorov) for the tip.
          a = (a + filterVal * src[srcPtr + 3]) | 0
          b = (b + filterVal * src[srcPtr + 2]) | 0
          g = (g + filterVal * src[srcPtr + 1]) | 0
          r = (r + filterVal * src[srcPtr]) | 0
          srcPtr += 4
        }

        // Bring this value back in range. All of the filter scaling factors
        // are in fixed point with FIXED_FRAC_BITS bits of fractional part.
        //
        // (!) Add 1/2 of value before clamping to get proper rounding. In other
        // case brightness loss will be noticeable if you resize image with white
        // border and place it on white background.
        //
        dest[destOffset + 3] = clampTo8((a + 8192) >> 14 /*FIXED_FRAC_BITS*/)
        dest[destOffset + 2] = clampTo8((b + 8192) >> 14 /*FIXED_FRAC_BITS*/)
        dest[destOffset + 1] = clampTo8((g + 8192) >> 14 /*FIXED_FRAC_BITS*/)
        dest[destOffset] = clampTo8((r + 8192) >> 14 /*FIXED_FRAC_BITS*/)
        destOffset = destOffset + srcH * 4
      }

      destOffset = (srcY + 1) * 4
      srcOffset = destOffset * srcW
    }
  }

  // Technically, convolvers are the same. But input array and temporary
  // buffer can be of different type (especially, in old browsers). So,
  // keep code in separate functions to avoid deoptimizations & speed loss.
  const convolveVertically = new Function(`${clampTo8.toString()}; return ${convolveHorizontally.toString()}`)()

  function lanczosFilter(x) {
    if (x <= -3.0 || x >= 3.0) {
      return 0.0
    }
    if (x > -1.1920929e-7 && x < 1.1920929e-7) {
      return 1.0
    }
    const xpi = x * Math.PI
    return ((Math.sin(xpi) / xpi) * Math.sin(xpi / 3.0)) / (xpi / 3.0)
  }

  function clampTo8(i) {
    return i < 0 ? 0 : i > 255 ? 255 : i
  }

  function createFilters(srcSize, destSize, scale) {
    const scaleInverted = 1.0 / scale
    const scaleClamped = Math.min(1.0, scale) // For upscale

    // Filter window (averaging interval), scaled to src image
    var srcWindow = 3.0 / scaleClamped
    let destPixel,
      srcPixel,
      srcFirst,
      srcLast,
      filterElementSize,
      floatFilter,
      fxpFilter,
      total,
      pxl,
      idx,
      floatVal,
      filterTotal,
      filterVal
    let leftNotEmpty, rightNotEmpty, filterShift, filterSize
    const maxFilterElementSize = Math.floor((srcWindow + 1) * 2)
    const packedFilter = new Int16Array((maxFilterElementSize + 2) * destSize)
    let packedFilterPtr = 0
    const fastCopy = packedFilter.subarray && packedFilter.set

    // For each destination pixel calculate source range and built filter values
    for (destPixel = 0; destPixel < destSize; destPixel++) {
      // Scaling should be done relative to central pixel point
      srcPixel = (destPixel + 0.5) * scaleInverted
      srcFirst = Math.max(0, Math.floor(srcPixel - srcWindow))
      srcLast = Math.min(srcSize - 1, Math.ceil(srcPixel + srcWindow))
      filterElementSize = srcLast - srcFirst + 1
      floatFilter = new Float32Array(filterElementSize)
      fxpFilter = new Int16Array(filterElementSize)
      total = 0.0

      // Fill filter values for calculated range
      for (pxl = srcFirst, idx = 0; pxl <= srcLast; pxl++, idx++) {
        floatVal = lanczosFilter((pxl + 0.5 - srcPixel) * scaleClamped)
        floatFilter[idx] = floatVal
        total += floatVal
      }

      // Normalize filter, convert to fixed point and accumulate conversion error
      filterTotal = 0
      for (idx = 0; idx <= srcLast; idx++) {
        filterTotal += filterVal = floatFilter[idx] / total
        fxpFilter[idx] = Math.round(filterVal * 16383)
      }

      // Compensate normalization error, to minimize brightness drift
      fxpFilter[destSize >> 1] += Math.round((1.0 - filterTotal) * 16383)

      //
      // Now pack filter to useable form
      //
      // 1. Trim heading and tailing zero values, and compensate shitf/length
      // 2. Put all to single array in this format:
      //
      //    [ pos shift, data length, value1, value2, value3, ... ]
      //

      leftNotEmpty = 0
      while (leftNotEmpty < fxpFilter.length && 0 === fxpFilter[leftNotEmpty]) {
        leftNotEmpty++
      }

      if (leftNotEmpty < fxpFilter.length) {
        rightNotEmpty = fxpFilter.length - 1
        while (rightNotEmpty > 0 && 0 === fxpFilter[rightNotEmpty]) {
          rightNotEmpty--
        }
        filterShift = srcFirst + leftNotEmpty
        filterSize = rightNotEmpty - leftNotEmpty + 1

        packedFilter[packedFilterPtr++] = filterShift // shift
        packedFilter[packedFilterPtr++] = filterSize // size

        if (fastCopy) {
          packedFilter.set(fxpFilter.subarray(leftNotEmpty, rightNotEmpty + 1), packedFilterPtr)
          packedFilterPtr += filterSize
        } else {
          // fallback for old IE < 11, without subarray/set methods
          for (idx = leftNotEmpty; idx <= rightNotEmpty; ++idx) {
            packedFilter[packedFilterPtr++] = fxpFilter[idx]
          }
        }
      } else {
        // zero data, write header only
        packedFilter[packedFilterPtr++] = 0 // shift
        packedFilter[packedFilterPtr++] = 0 // size
      }
    }
    return packedFilter
  }

  return function(options) {
    const srcW = options.width | 0
    const srcH = options.height | 0
    const destW = options.toWidth | 0
    const destH = options.toHeight | 0
    const dest = new Uint8Array(destW * destH * 4)
    const tmp = new Uint8Array(destW * srcH * 4)
    // To use single function we need src & tmp of the same type.
    // But src can be CanvasPixelArray, and tmp - Uint8Array. So, keep
    // vertical and horizontal passes separately to avoid deoptimization.
    convolveHorizontally(new Uint8Array(options.src), tmp, srcW, srcH, destW, createFilters(srcW, destW, destW / srcW))
    convolveVertically(tmp, dest, srcH, destW, destH, createFilters(srcH, destH, destH / srcH))
    // That's faster than doing checks in convolver.
    // !!! Note, canvas data is not premultipled. We don't need other
    // alpha corrections.
    // if (!options.alpha) {
    //   var ptr = 3,
    //     len = (destW * destH * 4) | 0
    //   while (ptr < len) {
    //     dest[ptr] = 0xff
    //     ptr = (ptr + 4) | 0
    //   }
    // }
    return dest
  }
}

const resizeFunc = resize()

const picaWorker = isNode
  ? null
  : (() => {
      if (window.Worker && window.Blob) {
        const blob = new Blob(
          [
            `const resizeFunc = (${resize.toString()})(); self.onmessage = function(e) { self.postMessage(resizeFunc(e.data)) }`,
          ],
          { type: 'application/javascript' },
        )
        try {
          const worker = new Worker(URL.createObjectURL(blob))
          worker.terminate = () => {
            URL.revokeObjectURL(blob)
          }
          worker.kill = signal => {
            setTimeout(worker.terminate)
          }
          return worker
        } catch (e) {
          URL.revokeObjectURL(blob)
        }
      }
      // Fake worker to keep code consistent
      return {
        postMessage: function(options) {
          this.onmessage({ data: resizeFunc(options) })
        },
      }
    })()

export default function downsize(canvas, ctx, width, height, callback) {
  let srcImageData = ctx.getImageData(0, 0, canvas.width, canvas.height)

  picaWorker.onmessage = m => {
    srcImageData = null
    const result = m.data
    // fallback for `node-canvas` and old browsers
    // (IE11 has ImageData but does not support `new ImageData()`)
    const toImageData = ctx.createImageData(width, height)
    if (toImageData.data.set) {
      toImageData.data.set(result)
    } else {
      // IE9 don't have `.set()`
      for (let i = toImageData.data.length - 1; i >= 0; i--) {
        toImageData.data[i] = result[i]
      }
    }
    canvas.width = width
    canvas.height = height
    ctx.putImageData(toImageData, 0, 0)
    callback()
  }

  picaWorker.postMessage(
    {
      src: srcImageData.data.buffer,
      width: canvas.width,
      height: canvas.height,
      toWidth: width,
      toHeight: height,
    },
    [srcImageData.data.buffer],
  )
}
