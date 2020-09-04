import MSUploader from 'multiple-sources-uploader'

import '../../src/index.scss'

MSUploader({
  uploader: {
    url: '',
    onStart: () => {},
    onProgress: progress => {},
    onDone: xhr => {},
    onError: () => {},
  },
  camera: null,
  cropper: null,
  // cropper: {
  //   ratio: { v: 1, h: 1 },
  //   minWidth: 480,
  //   resizeToWidth: 1000,
  //   webpIfSupported: true,
  // },
})
