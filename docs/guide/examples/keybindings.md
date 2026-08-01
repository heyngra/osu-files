# Keybindings

One example manages the key bindings stored in the Realm database.

It starts with [`init()`](/api/generated/functions/init).

## manage-keybinds

[Full source](https://github.com/heyngra/osu-files/blob/main/examples/manage-keybinds/index.js)

Registers the built-in osu! default bindings, prints the current keys for a binding, and remaps it.

```sh
cd examples/manage-keybinds
npm install
npm start
```

First the defaults are registered:

```ts
import init, { InputKey, RulesetName, OSU_DEFAULTS } from 'osu-files'

const osu = init(realmPath, { readOnly: false })
const r = osu.keybindings.registerDefaults(OSU_DEFAULTS, RulesetName.Osu)
console.log(`osu! defaults - inserted: ${r.inserted}, removed: ${r.removed}`)
```

[`OsuFilesAPI.keybindings`](/api/generated/type-aliases/OsuFilesAPI#keybindings) is the key binding module. [`OSU_DEFAULTS`](/api/generated/variables/OSU_DEFAULTS) is the built-in default set for the ruleset named by [`RulesetName`](/api/generated/variables/RulesetName). `registerDefaults` inserts any missing default bindings and removes ones that no longer belong, reporting both counts.

Existing keys are read back as an array of [`InputKey`](/api/generated/enumerations/InputKey):

```ts
const keys = osu.keybindings.getActionKeys(RulesetName.Osu, 'LeftButton')
console.log(`LeftButton: ${keys.join(', ')}`)
```

And the binding is remapped — mixing the string `'A'` with an [`InputKey`](/api/generated/enumerations/InputKey) member:

```ts
osu.keybindings.setActionKeys(RulesetName.Osu, 'LeftButton', ['A', InputKey.MouseLeft])
```

**API used:** [`init`](/api/generated/functions/init) · [`OsuFilesAPI#keybindings`](/api/generated/type-aliases/OsuFilesAPI#keybindings) · [`InputKey`](/api/generated/enumerations/InputKey) · [`RulesetName`](/api/generated/variables/RulesetName) · [`OSU_DEFAULTS`](/api/generated/variables/OSU_DEFAULTS)
