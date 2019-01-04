export function each(arr, func) {
  for (let i = 0, len = arr.length; i < len; i++) func(arr[i], i)
}
