# Scribe Route Patterns Reference

Complete code templates extracted from the DocAssistAI codebase. Use these exactly — do not deviate from the patterns.

---

## 1. Model File Template

**Path:** `backend/src/models/scribe{Name}.ts`

```typescript
import { randomUUID } from 'crypto';
import { getPool } from '../database/db.js';

// Interface uses snake_case to match DB columns
export interface Scribe{Name} {
  id: string;
  user_id: string;
  // ... feature-specific fields ...
  created_at: string;
}

export class Scribe{Name}Model {
  // NO constructor — models are stateless

  async create(input: {
    userId: string;
    // ... required fields (camelCase for input) ...
  }): Promise<Scribe{Name}> {
    const pool = getPool();
    const id = randomUUID();
    await pool.query(
      `INSERT INTO scribe_{table} (id, user_id, ...)
       VALUES ($1, $2, ...)`,
      [id, input.userId, ...],
    );
    const result = await pool.query('SELECT * FROM scribe_{table} WHERE id = $1', [id]);
    return result.rows[0];
  }

  async findById(id: string): Promise<Scribe{Name} | null> {
    const pool = getPool();
    const result = await pool.query(
      'SELECT * FROM scribe_{table} WHERE id = $1',
      [id],
    );
    return result.rows[0] ?? null;
  }

  async findByUserId(userId: string): Promise<Scribe{Name} | null> {
    const pool = getPool();
    const result = await pool.query(
      'SELECT * FROM scribe_{table} WHERE user_id = $1 ORDER BY created_at DESC LIMIT 1',
      [userId],
    );
    return result.rows[0] ?? null;
  }

  async listForUser(userId: string): Promise<Scribe{Name}[]> {
    const pool = getPool();
    const result = await pool.query(
      'SELECT * FROM scribe_{table} WHERE user_id = $1 ORDER BY created_at DESC',
      [userId],
    );
    return result.rows;
  }

  async listAll(): Promise<Scribe{Name}[]> {
    const pool = getPool();
    const result = await pool.query('SELECT * FROM scribe_{table} ORDER BY created_at DESC');
    return result.rows;
  }

  async delete(id: string, userId: string): Promise<boolean> {
    const pool = getPool();
    const result = await pool.query(
      'DELETE FROM scribe_{table} WHERE id = $1 AND user_id = $2',
      [id, userId],
    );
    return (result.rowCount ?? 0) > 0;
  }
}
```

### Model with Dynamic Update (when PATCH is needed)

```typescript
  async update(id: string, fields: { status?: string; note?: string }): Promise<Scribe{Name} | null> {
    const pool = getPool();
    const sets: string[] = [];
    const params: any[] = [];
    let paramIndex = 1;

    if (fields.status) {
      sets.push(`status = $${paramIndex++}`);
      params.push(fields.status);
    }
    if (fields.note !== undefined) {
      sets.push(`note = $${paramIndex++}`);
      params.push(fields.note);
    }

    if (sets.length === 0) return null;

    params.push(id);
    await pool.query(
      `UPDATE scribe_{table} SET ${sets.join(', ')} WHERE id = $${paramIndex}`,
      params,
    );
    const result = await pool.query('SELECT * FROM scribe_{table} WHERE id = $1', [id]);
    return result.rows[0] ?? null;
  }
```

### Model with Admin Join Query (when admin list needs user info)

```typescript
  async listAll(filters: { status?: string }): Promise<Scribe{Name}[]> {
    const pool = getPool();
    const conditions: string[] = [];
    const params: any[] = [];
    let paramIndex = 1;

    if (filters.status) {
      conditions.push(`t.status = $${paramIndex++}`);
      params.push(filters.status);
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const result = await pool.query(
      `SELECT t.*, u.email AS user_email, u.name AS user_name
       FROM scribe_{table} t
       JOIN scribe_users u ON u.id = t.user_id
       ${where}
       ORDER BY t.created_at DESC`,
      params,
    );
    return result.rows;
  }
```

---

## 2. Route File Template

**Path:** `backend/src/routes/scribe{Name}.ts`

### Simple Route (with inline auth for testability)

Routes MUST use `router.use(scribeAuthMiddleware)` inside the file. This makes tests self-contained — the test mounts the router directly without needing to add auth middleware separately. This is the pattern used by all tested routes (`scribeTemplates.ts`, `scribeNoteTemplates.ts`).

```typescript
import { Router, Request, Response } from 'express';
import { scribeAuthMiddleware } from '../middleware/scribeAuth.js';
import { Scribe{Name}Model } from '../models/scribe{Name}.js';

const router = Router();
router.use(scribeAuthMiddleware);
const {name}Model = new Scribe{Name}Model();

// POST / — Create a new {name}
router.post('/', async (req: Request, res: Response) => {
  const { field1, field2 } = req.body;

  // Input validation
  if (!field1 || typeof field1 !== 'string') {
    return res.status(400).json({ error: 'field1 is required' }) as any;
  }
  if (field2 && typeof field2 !== 'string') {
    return res.status(400).json({ error: 'field2 must be a string' }) as any;
  }
  if (field1.length > 5000) {
    return res.status(400).json({ error: 'field1 must be under 5000 characters' }) as any;
  }

  try {
    const record = await {name}Model.create({
      userId: req.scribeUserId!,
      field1: field1.trim(),
      field2: field2?.trim() || null,
    });
    return res.status(201).json(record);
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Submission failed';
    return res.status(400).json({ error: msg });
  }
});

// GET /mine — Current user's records
router.get('/mine', async (req: Request, res: Response) => {
  const items = await {name}Model.listForUser(req.scribeUserId!);
  return res.json(items);
});

// DELETE /:id — Delete own record
router.delete('/:id', async (req: Request, res: Response) => {
  const deleted = await {name}Model.delete(req.params.id, req.scribeUserId!);
  if (!deleted) {
    return res.status(404).json({ error: 'Not found' }) as any;
  }
  return res.json({ ok: true });
});

export default router;
```

### Route with Admin Endpoints

Add these after user endpoints:

```typescript
import { Router, Request, Response, NextFunction } from 'express';
import { scribeAuthMiddleware } from '../middleware/scribeAuth.js';
import { Scribe{Name}Model } from '../models/scribe{Name}.js';
import { ScribeUserModel } from '../models/scribeUser.js';

const router = Router();
router.use(scribeAuthMiddleware);
const {name}Model = new Scribe{Name}Model();
const userModel = new ScribeUserModel();

// ── Admin middleware ───────────────────────────────────────────────────────
async function requireAdmin(req: Request, res: Response, next: NextFunction): Promise<void> {
  const user = await userModel.findById(req.scribeUserId!);
  if (!user?.is_admin) {
    res.status(403).json({ error: 'Admin access required' });
    return;
  }
  next();
}

// ... user endpoints above ...

// ── Admin endpoints ───────────────────────────────────────────────────────

// GET /admin — List all records
router.get('/admin', requireAdmin, async (req: Request, res: Response) => {
  const status = req.query.status as string | undefined;
  const items = await {name}Model.listAll({ status });
  return res.json(items);
});

// PATCH /admin/:id — Update status
router.patch('/admin/:id', requireAdmin, async (req: Request, res: Response) => {
  const { status, admin_note } = req.body;
  const updated = await {name}Model.update(req.params.id, {
    status,
    note: admin_note,
  });
  if (!updated) {
    return res.status(404).json({ error: 'Not found' }) as any;
  }
  return res.json(updated);
});

export default router;
```

---

## 3. Test File Template

**Path:** `backend/src/routes/scribe{Name}.test.ts`

### Standard Route Test

```typescript
import { jest } from '@jest/globals';
import request from 'supertest';
import express from 'express';
import cookieParser from 'cookie-parser';
import jwt from 'jsonwebtoken';
import scribe{Name}Router from './scribe{Name}.js';
import { ScribeUserModel } from '../models/scribeUser.js';
import { initPool, closePool } from '../database/db.js';
import { runMigrations } from '../database/migrations.js';

const app = express();
app.use(express.json());
app.use(cookieParser());
app.use('/api/scribe/{kebab-path}', scribe{Name}Router);

const SECRET = 'test-secret';
let authCookie: string;

describe('Scribe {Name} Routes', () => {
  beforeAll(async () => {
    process.env.NODE_ENV = 'test';
    process.env.JWT_SECRET = SECRET;
    await initPool();
    await runMigrations();
    const userModel = new ScribeUserModel();
    const user = await userModel.create({
      email: '{kebab}-route@test.com',
      passwordHash: 'hash',
    });
    const token = jwt.sign({ userId: user.id }, SECRET, { expiresIn: '1h' });
    authCookie = `scribe_token=${token}`;
  });

  afterAll(async () => {
    await closePool();
  });

  it('POST / — creates a record', async () => {
    const res = await request(app)
      .post('/api/scribe/{kebab-path}')
      .set('Cookie', authCookie)
      .send({ field1: 'test value' });
    expect(res.status).toBe(201);
    expect(res.body.field1).toBeDefined();
  });

  it('POST / — returns 400 for missing required field', async () => {
    const res = await request(app)
      .post('/api/scribe/{kebab-path}')
      .set('Cookie', authCookie)
      .send({});
    expect(res.status).toBe(400);
  });

  it('GET /mine — returns user records', async () => {
    const res = await request(app)
      .get('/api/scribe/{kebab-path}/mine')
      .set('Cookie', authCookie);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  it('DELETE /:id — deletes own record', async () => {
    const createRes = await request(app)
      .post('/api/scribe/{kebab-path}')
      .set('Cookie', authCookie)
      .send({ field1: 'to delete' });
    const id = createRes.body.id;
    const res = await request(app)
      .delete(`/api/scribe/{kebab-path}/${id}`)
      .set('Cookie', authCookie);
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
  });

  it('GET /mine — returns 401 without auth', async () => {
    const res = await request(app)
      .get('/api/scribe/{kebab-path}/mine');
    expect(res.status).toBe(401);
  });
});
```

### AI Route Test (with PII scrubber mocks)

Only use this variant when the route calls `piiScrubber` or `aiService`:

```typescript
import { jest, describe, it, expect, beforeAll, beforeEach, afterEach, afterAll } from '@jest/globals';
import request from 'supertest';
import express from 'express';
import cookieParser from 'cookie-parser';
import jwt from 'jsonwebtoken';
import { ScribeUserModel } from '../models/scribeUser.js';
import { initPool, closePool } from '../database/db.js';
import { runMigrations } from '../database/migrations.js';
import { piiScrubber } from '../services/piiScrubber.js';
import { aiService } from '../services/ai/aiService.js';
import scribe{Name}Router from './scribe{Name}.js';

const app = express();
app.use(express.json());
app.use(cookieParser());
app.use('/api/ai/scribe/{path}', scribe{Name}Router);

const SECRET = 'test-secret';
let authCookie: string;
let mockAiChat: ReturnType<typeof jest.spyOn>;
let mockScrub: ReturnType<typeof jest.spyOn>;
let mockReInject: ReturnType<typeof jest.spyOn>;

describe('Scribe {Name} AI Routes', () => {
  beforeAll(async () => {
    process.env.NODE_ENV = 'test';
    process.env.JWT_SECRET = SECRET;
    await initPool();
    await runMigrations();
    const user = await new ScribeUserModel().create({
      email: '{kebab}-ai@test.com',
      passwordHash: 'hash',
    });
    const token = jwt.sign({ userId: user.id }, SECRET, { expiresIn: '1h' });
    authCookie = `scribe_token=${token}`;

    mockAiChat = jest.spyOn(aiService, 'chat');
    mockScrub = jest.spyOn(piiScrubber, 'scrub');
    mockReInject = jest.spyOn(piiScrubber, 'reInject');
  });

  beforeEach(() => {
    // Pass-through defaults — PII layer is transparent unless overridden
    mockScrub.mockImplementation(async (fields) => ({
      scrubbedFields: { ...fields },
      subMap: {},
    }));
    mockReInject.mockImplementation((text) => text);
  });

  afterEach(() => {
    mockAiChat.mockReset();
    mockScrub.mockReset();
    mockReInject.mockReset();
  });

  afterAll(async () => {
    jest.restoreAllMocks();
    await closePool();
  });

  // ... test cases ...
});
```

---

## 4. Migration Template

**File:** `backend/src/database/migrations.ts`

### Adding a New Table

Append to `CREATE_TABLES_SQL` (before the closing backtick):

```sql
CREATE TABLE IF NOT EXISTS scribe_{table} (
  id         TEXT PRIMARY KEY,
  user_id    TEXT NOT NULL REFERENCES scribe_users(id) ON DELETE CASCADE,
  {field}    TEXT NOT NULL,
  {optional} TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

**Rules:**
- `id TEXT PRIMARY KEY` — always TEXT, populated by `randomUUID()` in model
- `user_id TEXT NOT NULL REFERENCES scribe_users(id) ON DELETE CASCADE` — standard FK
- Use `TIMESTAMPTZ DEFAULT NOW()` for timestamps
- Use `TEXT NOT NULL DEFAULT 'value'` for strings with defaults
- Use `BOOLEAN DEFAULT FALSE` for flags
- Use `INTEGER NOT NULL` for numeric fields
- Use `NUMERIC(10,2)` for currency amounts

### Adding Columns to Existing Tables

Append to `COLUMN_MIGRATIONS` array:

```typescript
  // Description of what this column does
  {
    table: 'scribe_{table}',
    column: '{column_name}',
    sql: `ALTER TABLE scribe_{table} ADD COLUMN {column_name} TEXT`,
  },
```

---

## 5. Server.ts Wiring

**File:** `backend/src/server.ts`

### Step 1: Add Import

Add after the last scribe route import (around line 27):

```typescript
import scribe{Name}Router from './routes/scribe{Name}.js';
```

### Step 2: Add Route Registration

Add in the route registration block (lines 114-121). Since routes use inline `router.use(scribeAuthMiddleware)`, the server.ts line only needs subscription middleware if required:

**Auth only (route handles its own auth via inline middleware):**
```typescript
app.use('/api/scribe/{path}', scribe{Name}Router);
```

**Auth + subscription (add subscription check at server level):**
```typescript
app.use('/api/scribe/{path}', scribeSubscriptionMiddleware, scribe{Name}Router);
```

Note: `scribeAuthMiddleware` is NOT needed in `app.use()` because the route file already calls `router.use(scribeAuthMiddleware)` internally. Only `scribeSubscriptionMiddleware` is added at the server level when subscription gating is needed.

**Middleware import already exists in server.ts:**
- `scribeSubscriptionMiddleware` — line 29
