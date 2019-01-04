// centered
export function popup(url, title, w, h) {
  const win = window
  const de = document.documentElement
  const dualScreenLeft = win.screenLeft != undefined ? win.screenLeft : win.screenX
  const dualScreenTop = win.screenTop != undefined ? win.screenTop : win.screenY
  const width = win.innerWidth ? win.innerWidth : de.clientWidth ? de.clientWidth : win.screen.width
  const height = win.innerHeight ? win.innerHeight : de.clientHeight ? de.clientHeight : win.screen.height
  const left = width / 2 - w / 2 + dualScreenLeft
  const top = Math.min(50, height / 2 - h / 2 + dualScreenTop)
  const newWindow = win.open(
    url,
    title,
    `toolbar=no,directories=no,status=no,menubar=no,resizable=no,copyhistory=no,scrollbars=yes,width=${w},height=${h},top=${top},left=${left}`,
  )
  if (newWindow.focus) newWindow.focus()
  return newWindow
}
