import { db } from '../src/db/schema';

/**
 * Clear all Dexie tables without closing the database.
 * Avoids DatabaseClosedError from in-flight React effects.
 */
export async function clearDatabase() {
  await Promise.all(db.tables.map((table) => table.clear()));
}
