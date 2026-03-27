import pg from 'pg';

const { Pool } = pg;

let _pool: pg.Pool | null = null;

/**
 * Initialize the database pool.
 * - test:       uses pg-mem (in-memory PostgreSQL — no external DB needed)
 * - production: connects to DATABASE_URL (PostgreSQL)
 *
 * Call once at startup (server.ts) or in test beforeAll.
 * Safe to call multiple times — subsequent calls are no-ops.
 */
export async function initPool(): Promise<void> {
  if (_pool) return;

  if (process.env.NODE_ENV === 'test') {
    const { randomUUID } = await import('crypto');
    const { newDb, DataType } = await import('pg-mem');
    const db = newDb();
    // Register gen_random_uuid() — pg-mem does not include it by default
    db.public.registerFunction({
      name: 'gen_random_uuid',
      args: [],
      returns: DataType.text,
      implementation: () => randomUUID(),
    });
    const { Pool: PgMemPool } = db.adapters.createPg();
    _pool = new PgMemPool() as unknown as pg.Pool;
  } else {
    // SSL: enabled by default when DATABASE_URL is set (remote DB).
    // Set DATABASE_SSL=false to disable (e.g., Docker Compose internal networking).
    const needsSSL = process.env.DATABASE_URL && process.env.DATABASE_SSL !== 'false';
    const ssl = needsSSL ? { rejectUnauthorized: false } : undefined;
    _pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl });
  }
}

/**
 * Synchronous pool getter.
 * Throws if initPool() has not been called.
 */
export function getPool(): pg.Pool {
  if (!_pool) {
    throw new Error('Database pool not initialized. Call initPool() first.');
  }
  return _pool;
}

/**
 * End the pool and reset state.
 * Used in test afterAll to free resources.
 */
export async function closePool(): Promise<void> {
  if (_pool) {
    try {
      await _pool.end();
    } catch {
      // ignore errors on close
    }
    _pool = null;
  }
}
