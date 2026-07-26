import Realm from 'realm'
import type { BeatmapMetadata } from '../schema/types.js'
import { EntityQuery } from './base.js'

export class MetadataQuery extends EntityQuery<BeatmapMetadata> {
  constructor(realm: Realm) { super(realm, 'BeatmapMetadata') }

  /** @example db.metadata.get.byTitleEquals('Make A Move') */
  byTitleEquals(v: string)                { return this._str('Title', '==', v) }
  /** @example db.metadata.get.byTitleContains('Move') */
  byTitleContains(v: string)              { return this._str('Title', 'CONTAINS[c]', v) }
  /** @example db.metadata.get.byTitleUnicodeEquals('メイク') */
  byTitleUnicodeEquals(v: string)          { return this._str('TitleUnicode', '==', v) }
  /** @example db.metadata.get.byTitleUnicodeContains('メイク') */
  byTitleUnicodeContains(v: string)        { return this._str('TitleUnicode', 'CONTAINS[c]', v) }
  /** @example db.metadata.get.byArtistEquals('Icon For Hire') */
  byArtistEquals(v: string)               { return this._str('Artist', '==', v) }
  /** @example db.metadata.get.byArtistContains('Hire') */
  byArtistContains(v: string)             { return this._str('Artist', 'CONTAINS[c]', v) }
  /** @example db.metadata.get.byArtistUnicodeEquals('アイコン') */
  byArtistUnicodeEquals(v: string)         { return this._str('ArtistUnicode', '==', v) }
  /** @example db.metadata.get.byArtistUnicodeContains('アイコン') */
  byArtistUnicodeContains(v: string)       { return this._str('ArtistUnicode', 'CONTAINS[c]', v) }
  /** @example db.metadata.get.bySourceEquals('osu!') */
  bySourceEquals(v: string)               { return this._str('Source', '==', v) }
  /** @example db.metadata.get.bySourceContains('osu') */
  bySourceContains(v: string)             { return this._str('Source', 'CONTAINS[c]', v) }
  /** @example db.metadata.get.byTagsContains('rock') */
  byTagsContains(v: string)               { return this._str('Tags', 'CONTAINS[c]', v) }
  /** @example db.metadata.get.byAudioFileEquals('audio.mp3') */
  byAudioFileEquals(v: string)            { return this._str('AudioFile', '==', v) }
  /** @example db.metadata.get.byBackgroundFileEquals('bg.jpg') */
  byBackgroundFileEquals(v: string)       { return this._str('BackgroundFile', '==', v) }

  /** @example db.metadata.get.byPreviewTimeAbove(30000) */
  byPreviewTimeAbove(v: number)           { return this._num('PreviewTime', '>=', v) }
  /** @example db.metadata.get.byPreviewTimeBelow(60000) */
  byPreviewTimeBelow(v: number)           { return this._num('PreviewTime', '<=', v) }

  /** @example db.metadata.get.byAuthorUsernameContains('wajinshu') */
  byAuthorUsernameContains(v: string)     { return this._str('Author.Username', 'CONTAINS[c]', v) }
  /** @example db.metadata.get.byAuthorOnlineIdExact(124493) */
  byAuthorOnlineIdExact(v: number)        { return this._fkEq('Author.OnlineID', v) }
}
