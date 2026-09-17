import Realm from 'realm'
import type { BeatmapMetadata } from '../schema/types.js'
import { EntityQuery } from './base.js'

export class MetadataQuery extends EntityQuery<BeatmapMetadata> {
  constructor(realm: Realm) { super(realm, 'BeatmapMetadata') }

  /** @example db.metadata.get.byTitle('Make A Move') */
  byTitle(v: string)                      { return this._str('Title', '==', v) }
  /** @example db.metadata.get.byTitleContains('Move') */
  byTitleContains(v: string)              { return this._str('Title', 'CONTAINS[c]', v) }
  /** @example db.metadata.get.byTitleUnicode('メイク') */
  byTitleUnicode(v: string)                { return this._str('TitleUnicode', '==', v) }
  /** @example db.metadata.get.byTitleUnicodeContains('メイク') */
  byTitleUnicodeContains(v: string)        { return this._str('TitleUnicode', 'CONTAINS[c]', v) }
  /** @example db.metadata.get.byArtist('Icon For Hire') */
  byArtist(v: string)                     { return this._str('Artist', '==', v) }
  /** @example db.metadata.get.byArtistContains('Hire') */
  byArtistContains(v: string)             { return this._str('Artist', 'CONTAINS[c]', v) }
  /** @example db.metadata.get.byArtistUnicode('アイコン') */
  byArtistUnicode(v: string)               { return this._str('ArtistUnicode', '==', v) }
  /** @example db.metadata.get.byArtistUnicodeContains('アイコン') */
  byArtistUnicodeContains(v: string)       { return this._str('ArtistUnicode', 'CONTAINS[c]', v) }
  /** @example db.metadata.get.bySource('osu!') */
  bySource(v: string)                     { return this._str('Source', '==', v) }
  /** @example db.metadata.get.bySourceContains('osu') */
  bySourceContains(v: string)             { return this._str('Source', 'CONTAINS[c]', v) }
  /** @example db.metadata.get.byTagsContains('rock') */
  byTagsContains(v: string)               { return this._str('Tags', 'CONTAINS[c]', v) }
  /** @example db.metadata.get.byAudioFile('audio.mp3') */
  byAudioFile(v: string)                  { return this._str('AudioFile', '==', v) }
  /** @example db.metadata.get.byBackgroundFile('bg.jpg') */
  byBackgroundFile(v: string)             { return this._str('BackgroundFile', '==', v) }

  /** @example db.metadata.get.byPreviewTimeAbove(30000) */
  byPreviewTimeAbove(v: number)           { return this._num('PreviewTime', '>=', v) }
  /** @example db.metadata.get.byPreviewTimeBelow(60000) */
  byPreviewTimeBelow(v: number)           { return this._num('PreviewTime', '<=', v) }

  /** @example db.metadata.get.byAuthorUsernameContains('wajinshu') */
  byAuthorUsernameContains(v: string)     { return this._str('Author.Username', 'CONTAINS[c]', v) }
  /** @example db.metadata.get.byAuthorOnlineId(124493) */
  byAuthorOnlineId(v: number)             { return this._fkEq('Author.OnlineID', v) }
}
