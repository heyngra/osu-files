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
 * const beatmaps = db.realm.read(realm => [...realm.objects('Beatmap')])
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

  /** The raw Realm instance for advanced operations.
   * @example
   * db.realm.raw.write(() => db.realm.raw.create('Ruleset', data))
   */
  get raw(): Realm {
    this.assertOpen()
    return this.instance
  }

  /** Runs a guarded read operation.
   * @example
   * const count = db.realm.read(realm => realm.objects('Score').length)
   */
  read<T>(action: (realm: Realm) => T): T {
    this.assertOpen()
    return action(this.instance)
  }

  /** Runs a guarded write operation.
   * @example
   * db.realm.write(realm => realm.delete(score))
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
