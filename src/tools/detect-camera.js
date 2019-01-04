export default function(callback) {
  let md = navigator.mediaDevices
  if (!md || !md.enumerateDevices) return callback(false)
  md.enumerateDevices()
    .then(devices => callback(devices.some(device => 'videoinput' === device.kind)))
    .catch(() => callback(false))
}
