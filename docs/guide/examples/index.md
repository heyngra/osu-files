# Examples

The repository ships runnable examples under `examples/`. Every example prompts for the paths it needs (usually your osu!lazer `client.realm` and `files` folder), then reads, modifies, imports, or exports real data.

## Running an example

```sh
cd examples/<name>
npm install
npm start
```

## Examples

- [Beatmaps](/guide/examples/beatmaps) — create and explore storyboards, import `.osz` beatmap sets, export the newest set.
- [Collections](/guide/examples/collections) — import, export, and edit the beatmap collections stored in the Realm.
- [Replays](/guide/examples/replays) — import `.osr` replay files and export scores back to `.osr`.
- [Skins](/guide/examples/skins) — import `.osk` skin archives and export skins as archives.
- [Keybindings](/guide/examples/keybindings) — register osu! default key bindings and remap individual keys.
