import { getQueryFunc, getLoadingFunc } from '../tools/tab'
import Source, { DEFAULT_LOAD_ITEMS } from '../source'
import { sendRequest } from '../tools/request'
import { webPSupport } from '../tools/image'

const IMG_PROP = webPSupport ? 'webp_images' : 'images'

export default function Facebook(tabContainer, args) {
  const options = args.options.facebook
  const minSize = args.options.cropper.resizeToWidth || 1024

  const $ = getQueryFunc(tabContainer)
  const loading = getLoadingFunc(tabContainer)

  const source = Source(tabContainer, args, loadSDK, loadMorePhotos, loadPhotos, loadMoreAlbums)

  function loadSDK(callback) {
    if ('undefined' !== typeof FB) return authenticate()

    loading()
    window.fbAsyncInit = () => {
      loading(false)
      FB.init({
        appId: options.appId,
        autoLogAppEvents: true,
        xfbml: true,
        version: 'v3.2',
      })
      authenticate()
    }
    ;((d, s) => {
      const js = d.createElement(s)
      const fjs = d.getElementsByTagName(s)[0]
      js.src = `https://connect.facebook.net/${options.locale}/sdk.js`
      fjs.parentNode.insertBefore(js, fjs)
    })(document, 'script')
  }

  function authenticate() {
    FB.getLoginStatus(response => {
      loading()
      response.status !== 'connected' ? login() : loadAlbums()
    })
  }

  function login() {
    FB.login(
      response => {
        response.authResponse ? loadAlbums() : source.failToConnect()
      },
      { scope: 'user_photos' },
    )
  }

  function processAlbumData(response) {
    const result = response.data.map(album => {
      processPhotoData(album.photos || { data: [], paging: {} }, album.id)
      return {
        id: album.id,
        count: album.count,
        picture: album.cover_photo ? album.cover_photo.picture : 'about:blank',
        title: album.name,
      }
    })
    source.albumData = {
      albums: (source.albumData.albums || []).concat(result),
      nextPageInfo: response.paging.next,
    }
  }

  function processPhotoData(response, albumId) {
    const result = response.data.map(photo => {
      const pic = selectPhoto(photo[IMG_PROP], minSize)
      return {
        thumbnail: photo.picture,
        photo: pic.source,
        width: +pic.width,
        height: +pic.height,
      }
    })
    source.photoDataByAlbumId[albumId] = {
      photos: ((source.photoDataByAlbumId[albumId] || {}).photos || []).concat(result),
      nextPageInfo: response.paging.next,
    }
  }

  function selectPhoto(array, minSize) {
    let max
    for (let i = 1, image, len = array.length; i < len; ++i) {
      image = array[i]
      if (image.width <= minSize || image.height <= minSize) return array[i - 1]
      if (!max || (image.width > max.width && image.height > max.height)) max = image
    }
    return max
  }

  function loadMore(url, success) {
    loading()
    sendRequest(
      url,
      json => {
        loading(false)
        success(json)
      },
      source.failToLoad,
    )
  }

  function loadMoreAlbums(nextPageInfo) {
    loadMore(nextPageInfo, json => {
      processAlbumData(json, source.selectedAlbumId)
      source.renderAlbums(source.albumData)
    })
  }

  function loadAlbums() {
    loading()
    const limit = options.itemsToLoad || DEFAULT_LOAD_ITEMS
    FB.api(
      `/me?fields=albums.limit(${limit}){name,count,cover_photo{picture},photos.limit(${limit}){picture,${IMG_PROP}}}`,
      response => {
        if (!response || response.error) {
          return source.failToLoad()
        }
        processAlbumData(response.albums || { data: [], paging: {} })
        source.setSelectView('albums')
        source.renderAlbums(source.albumData)
      },
    )
  }

  function loadMorePhotos(nextPageInfo) {
    loadMore(nextPageInfo, json => {
      processPhotoData(json, source.selectedAlbumId)
      source.renderPhotos(source.photoDataByAlbumId[source.selectedAlbumId])
    })
  }

  function loadPhotos(albumId) {
    $('.photos .list').innerHTML = ''
    source.setSelectView('photos')
    source.renderPhotos(source.photoDataByAlbumId[albumId])
  }

  return source
}
