[<img src="https://img.youtube.com/vi/WOClw4w9cms/maxresdefault.jpg">](https://youtu.be/WOClw4w9cms) <!--live thumbnail of the video-->

# osu!files

This is a TypeScript library for osu!lazer that allows an easy read/write of client.realm.
>[!CAUTION]
>While this library tries it best to be safe and rollbackable, I cannot guarantee that something might break using it. Please use it with caution, and please send any bugs or ideas you might get.
## Why?

I noticed that there are NO true libraries for managing osu!lazer files. Also, it sounded like a banger YouTube video idea.

## Installation

```bash
npm install osu-files
```

(or your preferred package manager)

## Usage

Initialize the library using the `init()` method.

```ts
import init from 'osu-files'
const initialized = init(osuLazerRealmPath, {
  filesFolderPath: osuLazerFilesPath
})
//...
```

## Docs

[Documentation URL](https://osu-files.heyn.live)

Most of the API References' examples can be ran in the web.

## License

This library is licensed using MIT license.
