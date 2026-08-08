import Realm from 'realm'

/** Thrown when a Realm operation is attempted after the session is closed. */
export class RealmClosedError extends Error {
  constructor() {
    super('[osu-files] Realm session is closed')
    this.name = 'RealmClosedError'
  }
}

/** Thrown when a write is attempted through a read-only session. */
export class RealmReadOnlyError extends Error {
  constructor() {
    super('[osu-files] Realm session is read-only')
    this.name = 'RealmReadOnlyError'
  }
}

/** A guarded Realm handle used by the high-level API.
 * @example
 * import type { RealmSession } from 'osu-files'
 *
 * const session = {} as RealmSession
 * return session.isOpen
 */
export class RealmSession {
  private closed = false

  constructor(
    private readonly instance: Realm,
    private readonly readOnly: boolean,
    private readonly onWrite?: () => void,
  ) {}

  /** Whether the underlying Realm connection is still open. */
  get isOpen(): boolean {
    return !this.closed && !this.instance.isClosed
  }

  /**
   * Returns the raw Realm instance.
   *
   * Mutations bypass file and hash checks. Use a write transaction.
   * Prefer {@link SkinEditor}, {@link BeatmapSetEditor}, {@link ScoreEditor},
   * and {@link OwnedFileEditor}.
   * @example
   * import type { RealmSession } from 'osu-files'
   *
   * const session = {} as RealmSession
   * return session.raw
   */
  get raw(): Realm {
    this.assertOpen()
    return this.instance
  }

  /**
   * Runs a read callback over raw Realm objects.
   *
   * The callback receives mutable Realm-owned objects. Changes are not synchronized.
   * @example
   * import type { RealmSession } from 'osu-files'
   *
   * const session = {} as RealmSession
   * return session.read(realm => realm.objects('Score').length)
   */
  read<T>(action: (realm: Realm) => T): T {
    this.assertOpen()
    return action(this.instance)
  }

  /**
   * Runs a write callback over raw Realm objects.
   *
   * The callback receives mutable Realm-owned objects. Keep hashes and file
   * references valid. Prefer {@link SkinEditor}, {@link BeatmapSetEditor},
   * {@link ScoreEditor}, and {@link OwnedFileEditor}.
   * @example
   * import type { RealmSession } from 'osu-files'
   *
   * const session = {} as RealmSession
   * return session.write(realm => realm.objects('Score').length)
   */
  write<T>(action: (realm: Realm) => T): T {
    this.assertOpen()
    if (this.readOnly) throw new RealmReadOnlyError()
    const result = this.instance.write(() => action(this.instance))
    this.onWrite?.()
    return result
  }

  /** Closes the Realm connection. Calling this more than once is safe. */
  close(): void {
    if (this.closed) return
    this.closed = true
    this.instance.close()
  }

  assertOpen(): void {
    if (!this.isOpen) throw new RealmClosedError()
  }
}
