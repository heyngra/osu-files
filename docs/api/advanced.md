# Advanced APIs

## Available APIs

- [FileStore](/api/generated/classes/FileStore) - Read file content and manage file-store transactions.
- [RealmSession](/api/generated/classes/RealmSession) - Manage the database lifecycle and access Realm directly.
- [RollbackEntry](/api/generated/classes/RollbackEntry) - Inspect one rollback record.
- [RollbackLogger](/api/generated/classes/RollbackLogger) - Read and manage the rollback log.
- [Crud](/api/generated/type-aliases/Crud) - Use the lower-level write contract for a module.
- [RollbackOptions](/api/generated/type-aliases/RollbackOptions) - Choose how rollback is recorded.

## Live Realm objects

Results return read-only snapshots. Use [Editing results](/api/#editing-results) for normal changes. Use `RealmSession` only when an integration needs live Realm objects or a raw transaction:

```ts
db.realm.write(realm => realm.delete(score))
```
