[<img src="https://img.youtube.com/vi/WOClw4w9cms/maxresdefault.jpg">](https://youtu.be/WOClw4w9cms) <!--live thumbnail of the video-->
<h1>osu!files</h1>
This is a TypeScript library for osu!lazer that allows an easy read/write of client.realm.
<h2>Why?</h2>
I noticed that there are NO true libraries for managing osu!lazer files. Also, it sounded like a banger YouTube video idea.
<h2>Installation</h2>
```bash
npm install osu-files
```
(or your preferred package manager)
<h2>Usage</h2>
Initialize the library using the `init()` method.
```ts
import init from 'osu-files'
const initialized = init(osuLazerRealmPath, {
  filesFolderPath: osuLazerFilesPath
})
//...
```
<h2>Docs</h2>
[Documentation URL](https://osu-files.heyn.live)
Most of the API References' examples can be ran in the web.
<h2>License</h2>
This library is licensed using MIT license.
