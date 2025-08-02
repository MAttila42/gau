import type { BaseSQLiteDatabase } from 'drizzle-orm/sqlite-core'
import { sql } from 'drizzle-orm'

/**
 * A helper to run transactions across both sync (`better-sqlite3`)
 * and async (`libsql`) Drizzle drivers.
 *
 * It checks for the `mode` property on the Drizzle DB instance, which is
 * `'sync'` or `'async'`.
 *
 * @param db The Drizzle database instance.
 * @param callback The function to execute within the transaction.
 */
export async function transaction<T>(
  db: BaseSQLiteDatabase<'sync' | 'async', any, any>,
  callback: (
    tx: Omit<typeof db, 'transaction'>,
  ) => Promise<T>,
): Promise<T> {
  const isAsync = (db as any).session?.mode === 'async' || (db as any).mode === 'async'

  if (isAsync)
    return db.transaction(callback)

  db.run(sql`BEGIN`)
  try {
    const result = await callback(db)
    db.run(sql`COMMIT`)
    return result
  }
  catch (e) {
    db.run(sql`ROLLBACK`)
    throw e
  }
}
