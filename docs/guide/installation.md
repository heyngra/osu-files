# Installation

```sh
npm install osu-files
```

`osu-files` is a Node package downloadable from the NPM. To initialize, it requires a path to the `client.realm`, and optionally path to `files` folder.

```ts
import init from 'osu-files'

const db = init('./client.realm', {
  filesFolderPath: './files',
})

try {
  console.log(db.beatmaps.get.all().length)
} finally {
  db.close()
}
```
