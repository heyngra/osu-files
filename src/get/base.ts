import Realm from 'realm'

export abstract class EntityQuery<T> {
  private _preds: string[] = []
  private _args: unknown[] = []
  private _sortField: string | null = null
  private _sortAscending = true
  private _cached: T[] | null = null

  /** Cache the result after first terminal access. @default true */
  enableCache = true

  constructor(
    protected _realm: Realm,
    protected _name: string,
  ) {}

  [Symbol.iterator](): Iterator<T> {
    return this._eval()[Symbol.iterator]()
  }

  /**
   * Wraps the query in a Proxy so unknown properties (slice, map, [0], etc.)
   * delegate to the evaluated result array.
   * @example db.scores.get.sortedBy('Date').slice(0, 10)
   */
  proxify(): this & T[] {
    return new Proxy(this, {
      get(_, p: string | symbol) {
        if (typeof p !== 'string' || p in this || p === 'then')
          return (this as any)[p]
        const arr = (this as any)._eval()
        const val = (arr as any)[p]
        return typeof val === 'function'
          ? (...args: unknown[]) => (val as Function).apply(arr, args)
          : val
      },
    }) as this & T[]
  }

  /** @example db.scores.get.sortedBy('Date') */
  sortedBy(field: string, ascending = true): this {
    const base = field.split('.')[0]
    const schema = this._realm.schema.find(s => s.name === this._name)
    if (schema && !(base in schema.properties))
      throw new Error(`[osu-files] Unknown sort field '${field}' on '${this._name}'`)
    const n = this._clone()
    n._sortField = field
    n._sortAscending = ascending
    return n
  }

  /** @example this._num('BPM', '>=', 180) */
  protected _num(field: string, op: string, v: number): this {
    return this._clone()._add(`${field} ${op} $${this._args.length}`, v)
  }

  /** @example this._numBetween('BPM', 160, 200) */
  protected _numBetween(field: string, lo: number, hi: number): this {
    const $i = this._args.length
    return this._clone()._add(`${field} >= $${$i} AND ${field} <= $${$i + 1}`, lo, hi)
  }

  /** @example this._str('DifficultyName', 'CONTAINS[c]', 'Insane') */
  protected _str(field: string, op: string, v: string): this {
    return this._clone()._add(`${field} ${op} $${this._args.length}`, v)
  }

  /** @example this._bool('Hidden', true) */
  protected _bool(field: string, v: boolean): this {
    return this._clone()._add(`${field} == $${this._args.length}`, v)
  }

  /** @example this._date('LastPlayed', '>', someDate) */
  protected _date(field: string, op: string, v: Date): this {
    return this._clone()._add(`${field} ${op} $${this._args.length}`, v)
  }

  /** @example this._fkEq('Metadata.ID', uuid) */
  protected _fkEq(field: string, v: unknown): this {
    return this._clone()._add(`${field} == $${this._args.length}`, v)
  }

  /** @example this._fkAny('Files.Filename', 'bg.png') */
  protected _fkAny(field: string, v: unknown): this {
    return this._clone()._add(`ANY ${field} == $${this._args.length}`, v)
  }

  /** Converts a string or BSON.UUID to BSON.UUID. */
  protected _uuid(v: string | Realm.BSON.UUID): Realm.BSON.UUID {
    return typeof v === 'string' ? new Realm.BSON.UUID(v) : v
  }

  /** @example this._byUuidPk(uuid) */
  protected _byUuidPk(v: string | Realm.BSON.UUID): this {
    return this._fkEq('ID', this._uuid(v))
  }

  private _eval(): T[] {
    if (this.enableCache && this._cached !== null) return this._cached
    let results = this._realm.objects<T>(this._name)
    if (this._preds.length > 0) results = results.filtered(this._preds.join(' AND '), ...this._args)
    if (this._sortField) results = results.sorted(this._sortField, this._sortAscending)
    const arr = [...results]
    if (this.enableCache && this._preds.length > 0) this._cached = arr
    return arr
  }

  private _clone(): this & T[] {
    return Object.assign(new (this.constructor as any)(this._realm), this, {
      _preds: [...this._preds],
      _args: [...this._args],
      _cached: null,
    }).proxify()
  }

  private _add(pred: string, ...vals: unknown[]): this {
    this._preds.push(pred)
    this._args.push(...vals)
    return this
  }
}
