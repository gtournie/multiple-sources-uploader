export default function(callback) {
  const input = document.createElement('input')
  input.setAttribute('capture', true)
  if (input.capture) return callback('capture')

  const md = navigator.mediaDevices
  if (!md || !md.enumerateDevices) return callback(null)
  md.enumerateDevices()
    .then(devices => callback(devices.some(device => 'videoinput' === device.kind) ? 'camera' : null))
    .catch(() => callback(null))
}
