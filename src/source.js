import { getQueryFunc, getQueryAllFunc, getLoadingFunc, stopObserving } from './tools/tab'
import { on, show, hide, addHTML, addClass, removeClass, remove } from './tools/dom'
import { each } from './tools/tools'
import MSG from './messages'

import './source.scss'

export const DEFAULT_LOAD_ITEMS = 24
export const DEFAULT_TIMEOUT = 20 * 60 * 1000

export default function Source(tabContainer, args, onConnect, loadMorePhotos, loadPhotos, loadMoreAlbums) {
  const flash = args.flash
  const formatMessage = args.formatMessage

  const $ = getQueryFunc(tabContainer)
  const $$ = getQueryAllFunc(tabContainer)
  const loading = getLoadingFunc(tabContainer)
  const minWidth = args.minWidth
  const minHeight = args.minHeight

  // Inject HTML
  addHTML(tabContainer, $('.source-content', args.container).innerHTML)

  const albumName = $('.album-name')

  let selectedAlbumName, loadMoreElt, tabVisible, disconnectionScheduled

  const self = {
    onEnter,
    onLeave: () => {
      tabVisible = false
      stopObserving(events)
    },
    setSelectView,
    renderAlbums,
    renderPhotos,
    albumData: {},
    photoData: {},
    photoDataByAlbumId: {},
    failToConnect: () => {
      loading(false)
      flash(MSG.source_connection_error)
    },
    failToLoad: () => {
      loading(false)
      flash(MSG.source_loading_error)
    },
  }

  let events
  function onEnter() {
    tabVisible = true
    events = [
      on($('.connect'), 'click', onConnect),
      on(tabContainer, 'click', '.back', () => setSelectView('albums')),
      on(tabContainer, 'click', '.album-pic', e => {
        const target = e.currTarget
        selectedAlbumName = target.getAttribute('data-title')
        self.selectedAlbumId = target.getAttribute('data-album-id')

        const photoData = self.photoDataByAlbumId[self.selectedAlbumId]
        if (photoData) {
          $('.photos .list').innerHTML = ''
          setSelectView('photos')
          renderPhotos(photoData)
        } else {
          loadPhotos(self.selectedAlbumId)
        }
      }),
      on(tabContainer, 'click', '[data-next-page-info]', e => {
        const target = e.currTarget
        const info = target.getAttribute('data-next-page-info')
        target.removeAttribute('data-next-page-info')
        'albums' === target.getAttribute('data-more') ? loadMoreAlbums(info) : loadMorePhotos(info)
        loadMoreElt = target
        // We don't want to mess with the scroll position if "load more" is the last item in the list
        target.style.visibility = 'hidden'
      }),
      on(tabContainer, 'click', '.photo', e => {
        const target = e.currTarget
        const invalid = target.getAttribute('data-invalid')
        invalid ? flash(MSG[invalid]) : args.onSelect(target.getAttribute('data-photo'))
      }),
    ]
  }

  function scheduleDisconnect() {
    if (disconnectionScheduled) return
    disconnectionScheduled = true
    setTimeout(() => {
      self.albumData = {}
      self.photoData = {}
      self.photoDataByAlbumId = {}
      setSelectView('intro')
      if (tabVisible) {
        flash(MSG.source_timeout, { type: 'warning' })
      }
      disconnectionScheduled = false
    }, DEFAULT_TIMEOUT)
  }

  function setSelectView(view) {
    each($$('.view'), hide)
    show($(`.view.${view}`))
  }

  function renderAlbums(albumData) {
    scheduleDisconnect()
    loading(false)
    const albums = $('.albums .list')
    const length = $$('.album-pic', albums).length

    addHTML(
      albums,
      albumData.albums
        .slice(length)
        .map(a => {
          return `<div class="album-pic" data-title="${a.title}" data-album-id="${a.id}" data-count="${
            a.count
          }" style="background-image: url('${a.picture}')"></div>`
        })
        .join('') +
        (albumData.nextPageInfo
          ? `<div data-more="albums" data-next-page-info="${albumData.nextPageInfo}" class="more">${formatMessage(
              MSG.source_more,
            )}</div>`
          : ''),
    )
    remove(loadMoreElt)

    const noData = !length && !$('.album-pic', albums)
    ;(noData ? addClass : removeClass)(albums, 'no-data')
    if (noData) {
      albums.innerHTML = `<div>${formatMessage(MSG.source_no_data)}</div>`
    }
  }

  function renderPhotos(photoData) {
    scheduleDisconnect()
    loading(false)
    if (self.selectedAlbumId) {
      albumName.innerHTML = selectedAlbumName
    } else {
      hide($('.action'))
    }

    const photos = $('.photos .list')
    const length = $$('.photo', photos).length

    addHTML(
      photos,
      photoData.photos
        .slice(length)
        .map(img => {
          const valid = img.width && img.height ? img.width >= minWidth && img.height >= minHeight : true
          return `<div class="photo" ${valid ? '' : `data-invalid="source_too_small" `}title="${img.title ||
            ''}" data-photo="${img.photo}" style="background-image: url('${img.thumbnail}')"></div>`
        })
        .join('') +
        (photoData.nextPageInfo && !$('.photos .list [data-next-page-info]')
          ? `<div data-more="photos" data-next-page-info="${photoData.nextPageInfo}" class="more">${formatMessage(
              MSG.source_more,
            )}</div>`
          : ''),
    )
    remove(loadMoreElt)

    const noData = !self.selectedAlbumId && !length && !$('.photo', photos)
    ;(noData ? addClass : removeClass)(photos, 'no-data')
    if (noData) {
      photos.innerHTML = `<div>${formatMessage(MSG.source_no_data)}</div>`
    }
  }

  return self
}
