export function sendRequest(url, success, error) {
  const xhr = new XMLHttpRequest()
  handleRequestStates(xhr, () => success && success(JSON.parse(xhr.responseText)), () => error && error(xhr))
  xhr.open('get', url)
  xhr.send()
}

export function handleRequestStates(xhr, success, error) {
  xhr.onreadystatechange = () => {
    if (4 === xhr.readyState) {
      if ((xhr.status >= 200 && xhr.status < 300) || xhr.status === 304) {
        success(xhr)
      } else {
        error(xhr)
      }
    }
  }
}
