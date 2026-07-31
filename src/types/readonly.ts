import type { Beatmap, BeatmapSet, RealmFile, Score, Skin } from '../schema/types.js'

type Primitive = string | number | boolean | bigint | symbol | null | undefined

export type DeepReadonly<T> =
  T extends Primitive | Function | Buffer | Date ? T :
  T extends readonly (infer U)[] ? readonly DeepReadonly<U>[] :
  T extends object ? { readonly [K in keyof T]: DeepReadonly<T[K]> } :
  T

export type DeepMutable<T> =
  T extends Primitive | Function | Buffer | Date ? T :
  T extends readonly (infer U)[] ? DeepMutable<U>[] :
  T extends object ? { -readonly [K in keyof T]: DeepMutable<T[K]> } :
  T

export type SkinSnapshot = DeepReadonly<Skin>
export type BeatmapSnapshot = DeepReadonly<Beatmap>
export type BeatmapSetSnapshot = DeepReadonly<BeatmapSet>
export type ScoreSnapshot = DeepReadonly<Score>
export type FileSnapshot = DeepReadonly<RealmFile>
