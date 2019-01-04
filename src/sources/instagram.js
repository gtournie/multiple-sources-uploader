import { getLoadingFunc } from '../tools/tab'
import Source, { DEFAULT_LOAD_ITEMS } from '../source'
import { popup } from '../tools/popup'
import { sendRequest } from '../tools/request'

export default function InstagramPictureManager(tabContainer, args) {
  const options = args.options.instagram

  const loading = getLoadingFunc(tabContainer)

  const source = Source(tabContainer, args, authenticate, loadMorePhotos)

  let accessToken, userID

  // We'll open instagram sign-in page in a new popup
  // Once authenticated, instagram will redirect us to redirectURI and will add an access_token in the URL
  // We'll detect the popup location change and extract the access_token
  // Note:
  //  - We can only detect the popup location change if we keep the same origin.
  //  - The content at this URL (redirectURI) doesn't matter, we'll close the popup as soon as we get the accessToken
  //  - Ensure that you correctly setup your instagram app (Security -> Valid redirect URI + Enable Implicit OAuth)
  function authenticate() {
    const pop = popup(
      `https://api.instagram.com/oauth/authorize/?client_id=${options.clientID}&redirect_uri=${encodeURIComponent(
        options.redirectURI || `${window.location.protocol}//${window.location.host}`,
      )}&response_type=token`,
      'Instagram',
      600,
      497,
    )
    let interval = accessToken ? 20 : 250
    const waitAccessToken = () => {
      setTimeout(() => {
        try {
          if (!pop.location || !pop.location.href) return // window has been closed
          if (pop.location.href.search(/[\?&]error=/) >= 0) {
            pop.close()
            return source.failtToConnect()
          }
          if (!pop.location.hash || pop.location.hash.indexOf('#access_token') < 0) return waitAccessToken()
          accessToken = pop.location.hash.replace('#access_token=', '')
          userID = accessToken.slice(0, accessToken.indexOf('.'))
          pop.close()
          loadPhotos()
        } catch (e) {
          waitAccessToken()
        }
      }, interval)
    }
    setTimeout(() => (interval = 500), 3 * 60 * 1000)
    setTimeout(() => (interval = 1000), 10 * 60 * 1000)
    waitAccessToken()
  }

  function processPhotoData(response, albumId) {
    const result = response.data.map(post => {
      const pic = post.images.standard_resolution
      return {
        title: post.caption.text,
        thumbnail: post.images.thumbnail.url,
        photo: pic.url,
        width: +pic.width,
        height: +pic.height,
      }
    })
    source.photoData = {
      photos: (source.photoData.photos || []).concat(result),
      nextPageInfo: response.pagination.next_url,
    }
  }

  function loadMorePhotos(nextPageInfo) {
    loadPhotos(nextPageInfo)
  }

  function loadPhotos(nextPageInfo) {
    loading()
    sendRequest(
      nextPageInfo ||
        `https://api.instagram.com/v1/users/${userID}/media/recent?access_token=${accessToken}&count=${options.itemsToLoad ||
          DEFAULT_LOAD_ITEMS}`,
      response => {
        processPhotoData(response)
        source.setSelectView('photos')
        source.renderPhotos(source.photoData)
      },
      source.failToLoad,
    )
  }

  return source
}
