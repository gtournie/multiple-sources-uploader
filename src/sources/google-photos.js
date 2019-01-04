import { getQueryFunc, getLoadingFunc } from '../tools/tab'
import Source, { DEFAULT_LOAD_ITEMS } from '../source'

export default function GooglePhotos(tabContainer, args) {
  const options = args.options.googlePhotos

  const $ = getQueryFunc(tabContainer)
  const loading = getLoadingFunc(tabContainer)

  const source = Source(tabContainer, args, loadSDK, loadMorePhotos, loadPhotos, loadMoreAlbums)

  function loadSDK() {
    if ('undefined' !== typeof gapi) return authenticate()

    loading()
    window.gpAsyncInit = () => {
      authenticate()
    }
    ;((d, s) => {
      const js = d.createElement(s)
      const fjs = d.getElementsByTagName(s)[0]
      js.src = 'https://apis.google.com/js/client:plus.js?onload=gpAsyncInit'
      fjs.parentNode.insertBefore(js, fjs)
    })(document, 'script')
  }

  function authenticate() {
    gapi.auth.authorize(
      {
        immediate: false,
        client_id: options.oAuthClientID,
        scope: ['https://www.googleapis.com/auth/photoslibrary.readonly', 'profile'],
      },
      response => {
        if (response && !response.error) {
          loadAlbums()
        } else {
          source.failToConnect()
        }
      },
    )
  }

  function processAlbumData(response) {
    const result = (response.albums || []).map(album => {
      return {
        id: album.id,
        count: album.mediaItemsCount,
        picture: `${album.coverPhotoBaseUrl}=w150-h150-c`,
        title: album.title,
      }
    })
    source.albumData = {
      albums: (source.albumData.albums || []).concat(result),
      nextPageInfo: response.nextPageToken,
    }
  }

  function processPhotoData(response, albumId) {
    const result = (response.mediaItems || []).reduce((acc, photo) => {
      if (photo.mimeType.indexOf('video') < 0) {
        // TODO: +video?
        acc.push({
          title: photo.filename,
          thumbnail: `${photo.baseUrl}=w150-h150-c`,
          photo: photo.baseUrl,
          width: +photo.mediaMetadata.width,
          height: +photo.mediaMetadata.height,
        })
      }
      return acc
    }, [])
    source.photoDataByAlbumId[albumId] = {
      photos: ((source.photoDataByAlbumId[albumId] || {}).photos || []).concat(result),
      nextPageInfo: response.nextPageToken,
    }
  }

  function loadMoreAlbums(nextPageInfo) {
    loadAlbums(nextPageInfo)
  }

  function loadAlbums(nextPageInfo) {
    loading()
    gapi.client
      .request({
        path: 'https://photoslibrary.googleapis.com/v1/albums',
        method: 'GET',
        params: {
          pageSize: options.itemsToLoad || DEFAULT_LOAD_ITEMS,
          pageToken: nextPageInfo,
        },
      })
      .then(response => {
        processAlbumData(response.result)
        source.setSelectView('albums')
        source.renderAlbums(source.albumData)
      }, source.failToLoad)
  }

  function loadMorePhotos(nextPageInfo) {
    loadPhotos(source.selectedAlbumId, nextPageInfo)
  }

  function loadPhotos(albumId, nextPageInfo) {
    loading()
    gapi.client
      .request({
        path: 'https://photoslibrary.googleapis.com/v1/mediaItems:search',
        method: 'POST',
        params: {
          pageSize: options.itemsToLoad || DEFAULT_LOAD_ITEMS,
          pageToken: nextPageInfo,
          albumId: albumId,
        },
      })
      .then(response => {
        processPhotoData(response.result, albumId)
        $('.photos .list').innerHTML = ''
        source.setSelectView('photos')
        source.renderPhotos(source.photoDataByAlbumId[albumId])
      }, source.failToLoad)
  }

  return source
}
