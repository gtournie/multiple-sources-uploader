# multiple-sources-uploader

Lightweight (~20Kb minified & gziped) uploader that connects with social medias.

![alt preview](https://raw.githubusercontent.com/gtournie/multiple-sources-uploader/master/preview2.png)

## Why?

I couldn't find any package that would help getting photos from social media APIs. The closest thing that I found was cloudinary/uploadcare widgets, which are quite heavy (not acceptable on mobile) and restricted to use with their products.

Also, I didn't like the idea of uploading big photos and to resize them on the server side. That's why I included a cropper + resizer (based on [pica - high quality resizer](https://github.com/nodeca/pica)) to this uploader. This way you'll only upload what you need and save bandwith & storage space (plus time for your users). As a bonus, it can convert your photos to webp if your browser support it.

When I tested it, I resized a 5.7Mb photo to 1000x1000 and its final weight was only 56Ko (webp format). Pretty smooth to upload, right?

## Features

Upload any photos from:

- your computer
- your webcam
- Facebook
- Google Photos
- Instagram

Edit them:

- crop (+ aspect ratio)
- rotate
- mirror
- resize

Work on small and big screens :)

## Documentation

### Constructor

```
import MSUploader from 'multiple-sources-uploader'

new MSUploader(options)
```

### Options

#### Uploader

| param name   | description                                                                                          |
| ------------ | ---------------------------------------------------------------------------------------------------- |
| url          | **Required**. Your upload url.                                                                       |  |
| method       | The HTTP method to use for the request (e.g. "POST", "GET", "PUT"). Default: POST                    |
| getSignature | Function that should retrieve signature fields and pass it to its callback param (see example below) |
| onStart      | Function triggered when upload starts. File name is passed as first arg.                             |
| onProgress   | Function triggered when uploading. Percent of completion is passed as first arg.                     |
| onDone       | Function triggered when upload is succesful. The XMLHttpRequest object is passed as an arg.          |
| onError      | Function triggered if the upload fails. the file name is passed as an arg.                           |

> Note:
>
> - The popup will close right after the upload starts.
> - The user will get an alert if he tries to leave the page while an upload is still active.
> - We recommend to disable the submit button of your form 'onStart' and to reactivate it 'onDone'.

#### Cropper

| param name      | description                                                                                                                                                                                                                         |
| --------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| ratio           | Object with v & h keys representing the ratio. (eg: 16/9 => { v: 16, h: 9 }). Crop will be free if not set.                                                                                                                         |
| minWidth        | The minimum width your image should be. It means the cropper won't load an image that doesn't have its min dimension (it'll also take the aspect ratio into account) & will limit you when zooming or downsizing the cropping area. |
| resizeToWidth   | Resize the picture to this width (keeping the aspect ratio)                                                                                                                                                                         |
| upscale         | Will resize the photo to `resizeToWidth` even if it's originally smaller. Default: false                                                                                                                                            |
| webpIfSupported | Convert the photo to webp if the user's browser support it. Fallback to jpg otherwise. Default: false                                                                                                                               |

#### Facebook

| param name  | description                                                                                                              |
| ----------- | ------------------------------------------------------------------------------------------------------------------------ |
| appId       | **Required**. Your facebook [app Id](https://developers.facebook.com/docs/apps/).                                        |
| locale      | **Required**. Locale used with the API. [Supported locales](https://developers.facebook.com/docs/internationalization/). |
| itemsToLoad | Number of albums or photos to load on each request. Default: 24                                                          |

#### Google Photos

| param name    | description                                                                                          |
| ------------- | ---------------------------------------------------------------------------------------------------- |
| oAuthClientID | **Required**. Google APIs [oAuth client ID](https://developers.google.com/identity/protocols/OAuth2) |
| itemsToLoad   | Number of albums or photos to load on each request. Default: 24                                      |

#### Instagram

| param name  | description                                                                              |
| ----------- | ---------------------------------------------------------------------------------------- |
| clientID    | Instagram authentication [clientID](https://www.instagram.com/developer/authentication/) |
| itemsToLoad | Number of photos to load on each request. Default: 24                                    |

> Note: To deactivate a social media, set his options to null.

### Example (with amazon s3 upload)

```javascript
new MSUploader({
  uploader: {
    url: 'https://my-bucket.s3.amazonaws.com',
    getSignature: callback => {
      fetch('/s3_signature')
        .then(response => response.json())
        .then(callback)
    },
    onStart: fileName => {
      console.log(`Let's get the party started! File: ${fileName}`)
    },
    onProgress: progress => {
      console.log(`${progress}%`)
    },
    onError: fileName => {
      console.log(`Yikes. Something wrong happened. File: ${fileName}`)
    },
    onDone: xhr => {
      const fileName = xhr.responseXML.getElementsByTagName('Location')[0].innerHTML
      console.log('File uploaded!', decodeURIComponent(fileName))
    },
  },
  cropper: {
    ratio: { v: 1, h: 1 },
    minWidth: 100,
    resizeToWidth: 1000,
    webpIfSupported: true,
  },
  facebook: {
    appId: '...',
    locale: 'en_US',
  },
  googlePhotos: {
    oAuthClientID: '...',
  },
  instagram: {
    clientID: '...',
  },
})
```

### i18n

`MSUploader.setMessages({ ... })` provides a way to update all the texts (which are in english by default)

You can either use the translations in the `locales/` folder, or to write your own (feel free to make a PR in this case so everybody can use it=)

```javascript
import MSUploader from 'multiple-sources-uploader'
import fr from 'multiple-sources-uploader/locales/fr'

MSUploader.setMessages(fr)
```

### Css

You can find it in the `dist/` folder. Look at the sources to easily override them.

```javascript
import MSUploader from 'multiple-sources-uploader'
import 'multiple-sources-uploader/dist/ms-uploader.css'
```
