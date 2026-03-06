# Feedback System Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Let users submit categorized feedback and give the admin an in-app page to review, filter, and manage all submissions.

**Architecture:** New `scribe_feedback` Postgres table, Express CRUD routes with auth/admin middleware, a user-facing feedback page in the sidebar, and a protected admin review page. `is_admin` boolean on `scribe_users` controls admin access.

**Tech Stack:** PostgreSQL, Express, React, Zustand, Tailwind CSS, lucide-react icons

---

### Task 1: Database migration — scribe_feedback table + is_admin column

**Files:**
- Modify: `backend/src/database/migrations.ts`

**Step 1: Add scribe_feedback to CREATE_TABLES_SQL**

In `backend/src/database/migrations.ts`, add this table after the `scribe_payment_history` CREATE TABLE (before the closing backtick of `CREATE_TABLES_SQL`):

```sql
CREATE TABLE IF NOT EXISTS scribe_feedback (
  id         TEXT PRIMARY KEY,
  user_id    TEXT NOT NULL REFERENCES scribe_users(id) ON DELETE CASCADE,
  category   TEXT NOT NULL,
  message    TEXT NOT NULL,
  status     TEXT NOT NULL DEFAULT 'new',
  admin_note TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

**Step 2: Add is_admin column migration**

Add to the `COLUMN_MIGRATIONS` array:

```typescript
  {
    table: 'scribe_users',
    column: 'is_admin',
    sql: `ALTER TABLE scribe_users ADD COLUMN is_admin BOOLEAN DEFAULT FALSE`,
  },
```

**Step 3: Verify backend type-checks**

Run: `npx tsc --noEmit -p backend/tsconfig.json`
Expected: No errors

**Step 4: Commit**

```bash
git add backend/src/database/migrations.ts
git commit -m "feat: add scribe_feedback table and is_admin column migration"
```

---

### Task 2: Backend model — ScribeFeedbackModel + update ScribeUser interface

**Files:**
- Create: `backend/src/models/scribeFeedback.ts`
- Modify: `backend/src/models/scribeUser.ts`

**Step 1: Add is_admin to ScribeUser interface**

In `backend/src/models/scribeUser.ts`, add `is_admin: boolean;` to the `ScribeUser` interface after `square_card_id`:

```typescript
export interface ScribeUser {
  id: string;
  email: string;
  password_hash: string;
  name: string | null;
  specialty: string | null;
  subscription_status: 'trialing' | 'active' | 'cancelled' | 'expired';
  trial_ends_at: string | null;
  period_ends_at: string | null;
  cancelled_at: string | null;
  square_customer_id: string | null;
  square_card_id: string | null;
  is_admin: boolean;
  created_at: string;
  updated_at: string;
}
```

**Step 2: Create the feedback model**

Create `backend/src/models/scribeFeedback.ts`:

```typescript
import { randomUUID } from 'crypto';
import { getPool } from '../database/db.js';

export interface ScribeFeedbackRecord {
  id: string;
  user_id: string;
  category: 'bug' | 'feature_request' | 'general' | 'praise';
  message: string;
  status: 'new' | 'read' | 'resolved';
  admin_note: string | null;
  created_at: string;
  // Joined fields (admin list only)
  user_email?: string;
  user_name?: string;
}

const VALID_CATEGORIES = ['bug', 'feature_request', 'general', 'praise'];
const VALID_STATUSES = ['new', 'read', 'resolved'];

export class ScribeFeedbackModel {
  async create(input: { userId: string; category: string; message: string }): Promise<ScribeFeedbackRecord> {
    if (!VALID_CATEGORIES.includes(input.category)) {
      throw new Error('Invalid category');
    }
    const pool = getPool();
    const id = randomUUID();
    await pool.query(
      `INSERT INTO scribe_feedback (id, user_id, category, message)
       VALUES ($1, $2, $3, $4)`,
      [id, input.userId, input.category, input.message],
    );
    const result = await pool.query('SELECT * FROM scribe_feedback WHERE id = $1', [id]);
    return result.rows[0] as ScribeFeedbackRecord;
  }

  async countRecentByUser(userId: string, windowMinutes: number): Promise<number> {
    const pool = getPool();
    const result = await pool.query(
      `SELECT COUNT(*) FROM scribe_feedback
       WHERE user_id = $1 AND created_at > NOW() - INTERVAL '1 minute' * $2`,
      [userId, windowMinutes],
    );
    return parseInt(result.rows[0].count, 10);
  }

  async listForUser(userId: string, limit = 50): Promise<ScribeFeedbackRecord[]> {
    const pool = getPool();
    const result = await pool.query(
      'SELECT * FROM scribe_feedback WHERE user_id = $1 ORDER BY created_at DESC LIMIT $2',
      [userId, limit],
    );
    return result.rows as ScribeFeedbackRecord[];
  }

  async listAll(filters: { category?: string; status?: string }, limit = 50): Promise<ScribeFeedbackRecord[]> {
    const pool = getPool();
    const conditions: string[] = [];
    const params: any[] = [];
    let paramIndex = 1;

    if (filters.category && VALID_CATEGORIES.includes(filters.category)) {
      conditions.push(`f.category = $${paramIndex++}`);
      params.push(filters.category);
    }
    if (filters.status && VALID_STATUSES.includes(filters.status)) {
      conditions.push(`f.status = $${paramIndex++}`);
      params.push(filters.status);
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    params.push(limit);

    const result = await pool.query(
      `SELECT f.*, u.email AS user_email, u.name AS user_name
       FROM scribe_feedback f
       JOIN scribe_users u ON u.id = f.user_id
       ${where}
       ORDER BY f.created_at DESC
       LIMIT $${paramIndex}`,
      params,
    );
    return result.rows as ScribeFeedbackRecord[];
  }

  async updateStatus(id: string, fields: { status?: string; adminNote?: string }): Promise<ScribeFeedbackRecord | null> {
    if (fields.status && !VALID_STATUSES.includes(fields.status)) {
      throw new Error('Invalid status');
    }
    const pool = getPool();
    const sets: string[] = [];
    const params: any[] = [];
    let paramIndex = 1;

    if (fields.status) {
      sets.push(`status = $${paramIndex++}`);
      params.push(fields.status);
    }
    if (fields.adminNote !== undefined) {
      sets.push(`admin_note = $${paramIndex++}`);
      params.push(fields.adminNote);
    }

    if (sets.length === 0) return null;

    params.push(id);
    await pool.query(
      `UPDATE scribe_feedback SET ${sets.join(', ')} WHERE id = $${paramIndex}`,
      params,
    );
    const result = await pool.query('SELECT * FROM scribe_feedback WHERE id = $1', [id]);
    return result.rows[0] as ScribeFeedbackRecord ?? null;
  }
}
```

**Step 3: Verify backend type-checks**

Run: `npx tsc --noEmit -p backend/tsconfig.json`
Expected: No errors

**Step 4: Commit**

```bash
git add backend/src/models/scribeFeedback.ts backend/src/models/scribeUser.ts
git commit -m "feat: add ScribeFeedbackModel and is_admin to ScribeUser interface"
```

---

### Task 3: Backend routes — scribeFeedback.ts + mount in server.ts

**Files:**
- Create: `backend/src/routes/scribeFeedback.ts`
- Modify: `backend/src/server.ts`

**Step 1: Create the feedback route file**

Create `backend/src/routes/scribeFeedback.ts`:

```typescript
import { Router, Request, Response, NextFunction } from 'express';
import { ScribeFeedbackModel } from '../models/scribeFeedback.js';
import { ScribeUserModel } from '../models/scribeUser.js';

const router = Router();
const feedbackModel = new ScribeFeedbackModel();
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

// ── User endpoints ────────────────────────────────────────────────────────

// POST / — Submit feedback (rate-limited: 5 per hour per user)
router.post('/', async (req: Request, res: Response) => {
  const { category, message } = req.body;
  if (!category || typeof category !== 'string') {
    return res.status(400).json({ error: 'Category is required' }) as any;
  }
  if (!message || typeof message !== 'string' || message.trim().length === 0) {
    return res.status(400).json({ error: 'Message is required' }) as any;
  }
  if (message.length > 5000) {
    return res.status(400).json({ error: 'Message must be under 5000 characters' }) as any;
  }

  const recentCount = await feedbackModel.countRecentByUser(req.scribeUserId!, 60);
  if (recentCount >= 5) {
    return res.status(429).json({ error: 'Too many submissions. Please try again later.' }) as any;
  }

  try {
    const record = await feedbackModel.create({
      userId: req.scribeUserId!,
      category,
      message: message.trim(),
    });
    return res.status(201).json(record);
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Submission failed';
    return res.status(400).json({ error: msg });
  }
});

// GET /mine — Current user's submissions
router.get('/mine', async (req: Request, res: Response) => {
  const items = await feedbackModel.listForUser(req.scribeUserId!);
  return res.json(items);
});

// ── Admin endpoints ───────────────────────────────────────────────────────

// GET /admin — List all feedback (with optional filters)
router.get('/admin', requireAdmin, async (req: Request, res: Response) => {
  const category = req.query.category as string | undefined;
  const status = req.query.status as string | undefined;
  const items = await feedbackModel.listAll({ category, status });
  return res.json(items);
});

// PATCH /admin/:id — Update status and/or admin_note
router.patch('/admin/:id', requireAdmin, async (req: Request, res: Response) => {
  const { status, admin_note } = req.body;
  const updated = await feedbackModel.updateStatus(req.params.id, {
    status,
    adminNote: admin_note,
  });
  if (!updated) {
    return res.status(404).json({ error: 'Feedback not found' }) as any;
  }
  return res.json(updated);
});

export default router;
```

**Step 2: Mount in server.ts**

In `backend/src/server.ts`, add the import after the `scribeCronRouter` import (line 25):

```typescript
import scribeFeedbackRouter from './routes/scribeFeedback.js';
```

Add the route mount after the billing route (after line 116):

```typescript
app.use('/api/scribe/feedback', scribeAuthMiddleware, scribeSubscriptionMiddleware, scribeFeedbackRouter);
```

**Step 3: Verify backend type-checks**

Run: `npx tsc --noEmit -p backend/tsconfig.json`
Expected: No errors

**Step 4: Commit**

```bash
git add backend/src/routes/scribeFeedback.ts backend/src/server.ts
git commit -m "feat: add feedback API routes with user and admin endpoints"
```

---

### Task 4: Include is_admin in auth responses

**Files:**
- Modify: `backend/src/routes/scribeAuth.ts`

**Step 1: Add is_admin to /me, /login, and /register responses**

In `backend/src/routes/scribeAuth.ts`:

Update the `/register` response (line 48) to include `is_admin`:
```typescript
  return res.status(201).json({ user: { id: user.id, email: user.email, name: user.name, specialty: user.specialty, is_admin: user.is_admin } });
```

Update the `/login` response (line 61) to include `is_admin`:
```typescript
  return res.json({ user: { id: user.id, email: user.email, name: user.name, specialty: user.specialty, is_admin: user.is_admin } });
```

Update the `/me` response (line 116) to include `is_admin`:
```typescript
  return res.json({ user: { id: user.id, email: user.email, name: user.name, specialty: user.specialty, is_admin: user.is_admin } });
```

Update the `/profile` PATCH response (line 123) to include `is_admin`:
```typescript
  return res.json({ user: { id: user.id, email: user.email, name: user.name, specialty: user.specialty, is_admin: user.is_admin } });
```

**Step 2: Verify backend type-checks**

Run: `npx tsc --noEmit -p backend/tsconfig.json`
Expected: No errors

**Step 3: Commit**

```bash
git add backend/src/routes/scribeAuth.ts
git commit -m "feat: include is_admin in auth response payloads"
```

---

### Task 5: Frontend auth store — add is_admin to ScribeUser

**Files:**
- Modify: `src/stores/scribeAuthStore.ts`

**Step 1: Add is_admin to ScribeUser interface**

In `src/stores/scribeAuthStore.ts`, add `is_admin` to the `ScribeUser` interface (after `specialty`):

```typescript
export interface ScribeUser {
  id: string;
  email: string;
  name: string | null;
  specialty: string | null;
  is_admin: boolean;
}
```

No other changes needed — the store already sets `user: data.user` from the API response, so `is_admin` will flow through automatically.

**Step 2: Run tests**

Run: `npx vitest run`
Expected: All tests pass (131+)

**Step 3: Commit**

```bash
git add src/stores/scribeAuthStore.ts
git commit -m "feat: add is_admin to frontend ScribeUser interface"
```

---

### Task 6: Frontend — ScribeFeedbackPage (user submission + history)

**Files:**
- Create: `src/components/scribe-standalone/ScribeFeedbackPage.tsx`

**Step 1: Create the feedback page**

Create `src/components/scribe-standalone/ScribeFeedbackPage.tsx`:

```tsx
import React, { useState, useEffect } from 'react';
import { MessageSquare, Send, Bug, Lightbulb, MessageCircle, Heart, CheckCircle2 } from 'lucide-react';
import { getBackendUrl } from '../../config/appConfig';

interface FeedbackItem {
  id: string;
  category: string;
  message: string;
  status: string;
  created_at: string;
}

const CATEGORIES = [
  { value: 'bug', label: 'Bug Report', icon: Bug, color: 'text-red-400 bg-red-950 border-red-400/30' },
  { value: 'feature_request', label: 'Feature Request', icon: Lightbulb, color: 'text-blue-400 bg-blue-950 border-blue-400/30' },
  { value: 'general', label: 'General Feedback', icon: MessageCircle, color: 'text-slate-400 bg-slate-800 border-slate-600/30' },
  { value: 'praise', label: 'Praise', icon: Heart, color: 'text-emerald-400 bg-emerald-950 border-emerald-400/30' },
];

const STATUS_BADGES: Record<string, string> = {
  new: 'text-amber-400 bg-amber-950 border-amber-400/30',
  read: 'text-blue-400 bg-blue-950 border-blue-400/30',
  resolved: 'text-emerald-400 bg-emerald-950 border-emerald-400/30',
};

export const ScribeFeedbackPage: React.FC = () => {
  const [category, setCategory] = useState('general');
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [items, setItems] = useState<FeedbackItem[]>([]);

  const fetchItems = async () => {
    try {
      const res = await fetch(`${getBackendUrl()}/api/scribe/feedback/mine`, { credentials: 'include' });
      if (res.ok) setItems(await res.json());
    } catch { /* ignore */ }
  };

  useEffect(() => { fetchItems(); }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim()) return;
    setSubmitting(true);
    setError(null);
    setSuccess(false);
    try {
      const res = await fetch(`${getBackendUrl()}/api/scribe/feedback`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ category, message: message.trim() }),
      });
      if (!res.ok) {
        const data = await res.json();
        setError(data.error || 'Failed to submit');
      } else {
        setSuccess(true);
        setMessage('');
        fetchItems();
        setTimeout(() => setSuccess(false), 3000);
      }
    } catch {
      setError('Unable to reach server.');
    } finally {
      setSubmitting(false);
    }
  };

  const getCategoryMeta = (cat: string) => CATEGORIES.find(c => c.value === cat) ?? CATEGORIES[2];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-xl font-semibold text-slate-50 flex items-center gap-2">
          <MessageSquare size={22} className="text-teal-400" />
          Feedback
        </h1>
        <p className="text-sm text-slate-400 mt-1">
          Help us improve DocAssistAI. Report bugs, request features, or tell us what you love.
        </p>
      </div>

      {/* ── Submit form ─────────────────────────────────────────────────── */}
      <form onSubmit={handleSubmit} className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4">
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-2">Category</label>
          <div className="flex flex-wrap gap-2">
            {CATEGORIES.map(cat => {
              const Icon = cat.icon;
              const selected = category === cat.value;
              return (
                <button
                  key={cat.value}
                  type="button"
                  onClick={() => setCategory(cat.value)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium border transition-all ${
                    selected
                      ? cat.color
                      : 'text-slate-500 bg-slate-800/50 border-slate-700 hover:border-slate-600'
                  }`}
                >
                  <Icon size={14} />
                  {cat.label}
                </button>
              );
            })}
          </div>
        </div>

        <div>
          <label htmlFor="feedback-message" className="block text-sm font-medium text-slate-300 mb-2">
            Your feedback
          </label>
          <textarea
            id="feedback-message"
            value={message}
            onChange={e => setMessage(e.target.value)}
            rows={4}
            maxLength={5000}
            placeholder="Tell us what's on your mind..."
            className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-slate-50 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-teal-400 resize-none text-sm"
          />
          <div className="text-xs text-slate-500 mt-1 text-right">{message.length}/5000</div>
        </div>

        {error && <p className="text-sm text-red-400">{error}</p>}
        {success && (
          <div className="flex items-center gap-2 text-sm text-emerald-400">
            <CheckCircle2 size={16} />
            Thank you! Your feedback has been submitted.
          </div>
        )}

        <button
          type="submit"
          disabled={submitting || !message.trim()}
          className="flex items-center gap-2 px-5 py-2.5 bg-teal-400 text-slate-900 font-semibold rounded-lg hover:bg-teal-300 disabled:opacity-50 transition-colors text-sm"
        >
          <Send size={16} />
          {submitting ? 'Submitting...' : 'Submit Feedback'}
        </button>
      </form>

      {/* ── Past submissions ────────────────────────────────────────────── */}
      {items.length > 0 && (
        <div>
          <h2 className="text-sm font-medium text-slate-400 uppercase tracking-wider mb-3">Your Submissions</h2>
          <div className="space-y-2">
            {items.map(item => {
              const meta = getCategoryMeta(item.category);
              const Icon = meta.icon;
              return (
                <div key={item.id} className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex items-start gap-3">
                  <div className={`flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium border ${meta.color}`}>
                    <Icon size={12} />
                    {meta.label}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-slate-300 line-clamp-2">{item.message}</p>
                    <div className="flex items-center gap-3 mt-1.5">
                      <span className="text-xs text-slate-500">
                        {new Date(item.created_at).toLocaleDateString()}
                      </span>
                      <span className={`px-1.5 py-0.5 rounded text-xs font-medium border ${STATUS_BADGES[item.status] ?? STATUS_BADGES.new}`}>
                        {item.status}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
```

**Step 2: Run tests**

Run: `npx vitest run`
Expected: All tests pass

**Step 3: Commit**

```bash
git add src/components/scribe-standalone/ScribeFeedbackPage.tsx
git commit -m "feat: add user feedback submission page"
```

---

### Task 7: Frontend — ScribeAdminFeedbackPage

**Files:**
- Create: `src/components/scribe-standalone/ScribeAdminFeedbackPage.tsx`

**Step 1: Create the admin feedback page**

Create `src/components/scribe-standalone/ScribeAdminFeedbackPage.tsx`:

```tsx
import React, { useState, useEffect } from 'react';
import { Shield, Bug, Lightbulb, MessageCircle, Heart, ChevronDown, ChevronUp, Save } from 'lucide-react';
import { getBackendUrl } from '../../config/appConfig';
import { useScribeAuthStore } from '../../stores/scribeAuthStore';
import { Navigate } from 'react-router-dom';

interface FeedbackItem {
  id: string;
  user_id: string;
  user_email: string;
  user_name: string | null;
  category: string;
  message: string;
  status: string;
  admin_note: string | null;
  created_at: string;
}

const CATEGORIES = [
  { value: 'bug', label: 'Bug', icon: Bug, color: 'text-red-400 bg-red-950 border-red-400/30' },
  { value: 'feature_request', label: 'Feature', icon: Lightbulb, color: 'text-blue-400 bg-blue-950 border-blue-400/30' },
  { value: 'general', label: 'General', icon: MessageCircle, color: 'text-slate-400 bg-slate-800 border-slate-600/30' },
  { value: 'praise', label: 'Praise', icon: Heart, color: 'text-emerald-400 bg-emerald-950 border-emerald-400/30' },
];

const STATUS_BADGES: Record<string, string> = {
  new: 'text-amber-400 bg-amber-950 border-amber-400/30',
  read: 'text-blue-400 bg-blue-950 border-blue-400/30',
  resolved: 'text-emerald-400 bg-emerald-950 border-emerald-400/30',
};

export const ScribeAdminFeedbackPage: React.FC = () => {
  const user = useScribeAuthStore(s => s.user);
  const [items, setItems] = useState<FeedbackItem[]>([]);
  const [filterCategory, setFilterCategory] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Redirect non-admins
  if (user && !user.is_admin) return <Navigate to="/scribe/dashboard" replace />;

  const fetchItems = async () => {
    const params = new URLSearchParams();
    if (filterCategory) params.set('category', filterCategory);
    if (filterStatus) params.set('status', filterStatus);
    try {
      const res = await fetch(`${getBackendUrl()}/api/scribe/feedback/admin?${params}`, { credentials: 'include' });
      if (res.ok) setItems(await res.json());
    } catch { /* ignore */ }
  };

  useEffect(() => { fetchItems(); }, [filterCategory, filterStatus]);

  const handleUpdate = async (id: string, status: string, adminNote: string) => {
    setSaving(true);
    try {
      const res = await fetch(`${getBackendUrl()}/api/scribe/feedback/admin/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ status, admin_note: adminNote }),
      });
      if (res.ok) {
        const updated = await res.json();
        setItems(prev => prev.map(i => i.id === id ? { ...i, ...updated } : i));
      }
    } catch { /* ignore */ }
    setSaving(false);
  };

  const getCategoryMeta = (cat: string) => CATEGORIES.find(c => c.value === cat) ?? CATEGORIES[2];

  const selectClass = 'bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-300 focus:outline-none focus:ring-2 focus:ring-teal-400';

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-slate-50 flex items-center gap-2">
          <Shield size={22} className="text-teal-400" />
          Admin — Feedback
        </h1>
        <p className="text-sm text-slate-400 mt-1">{items.length} submissions</p>
      </div>

      {/* ── Filters ────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap gap-3">
        <select value={filterCategory} onChange={e => setFilterCategory(e.target.value)} className={selectClass}>
          <option value="">All categories</option>
          {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
        </select>
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} className={selectClass}>
          <option value="">All statuses</option>
          <option value="new">New</option>
          <option value="read">Read</option>
          <option value="resolved">Resolved</option>
        </select>
      </div>

      {/* ── List ───────────────────────────────────────────────────────── */}
      <div className="space-y-2">
        {items.length === 0 && (
          <p className="text-sm text-slate-500 py-8 text-center">No feedback found.</p>
        )}
        {items.map(item => {
          const meta = getCategoryMeta(item.category);
          const Icon = meta.icon;
          const expanded = expandedId === item.id;
          return (
            <div key={item.id} className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
              <button
                onClick={() => setExpandedId(expanded ? null : item.id)}
                className="w-full flex items-center gap-3 p-4 text-left hover:bg-slate-800/50 transition-colors"
              >
                <div className={`flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium border shrink-0 ${meta.color}`}>
                  <Icon size={12} />
                  {meta.label}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-slate-300 truncate">{item.message}</p>
                  <div className="flex items-center gap-3 mt-1">
                    <span className="text-xs text-slate-500">{item.user_email}</span>
                    <span className="text-xs text-slate-600">{new Date(item.created_at).toLocaleDateString()}</span>
                  </div>
                </div>
                <span className={`px-1.5 py-0.5 rounded text-xs font-medium border shrink-0 ${STATUS_BADGES[item.status] ?? STATUS_BADGES.new}`}>
                  {item.status}
                </span>
                {expanded ? <ChevronUp size={16} className="text-slate-500" /> : <ChevronDown size={16} className="text-slate-500" />}
              </button>

              {expanded && (
                <ExpandedRow item={item} onSave={handleUpdate} saving={saving} />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

// ── Expanded row (inline component) ─────────────────────────────────────
const ExpandedRow: React.FC<{
  item: FeedbackItem;
  onSave: (id: string, status: string, adminNote: string) => Promise<void>;
  saving: boolean;
}> = ({ item, onSave, saving }) => {
  const [status, setStatus] = useState(item.status);
  const [adminNote, setAdminNote] = useState(item.admin_note ?? '');

  return (
    <div className="border-t border-slate-800 p-4 space-y-4 bg-slate-950/50">
      <div>
        <label className="block text-xs font-medium text-slate-500 uppercase tracking-wider mb-1">Full message</label>
        <p className="text-sm text-slate-300 whitespace-pre-wrap">{item.message}</p>
      </div>
      <div className="flex flex-wrap gap-4">
        <div>
          <label className="block text-xs font-medium text-slate-500 uppercase tracking-wider mb-1">Status</label>
          <select
            value={status}
            onChange={e => setStatus(e.target.value)}
            className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-sm text-slate-300 focus:outline-none focus:ring-2 focus:ring-teal-400"
          >
            <option value="new">New</option>
            <option value="read">Read</option>
            <option value="resolved">Resolved</option>
          </select>
        </div>
        <div className="flex-1 min-w-[200px]">
          <label className="block text-xs font-medium text-slate-500 uppercase tracking-wider mb-1">Admin note</label>
          <textarea
            value={adminNote}
            onChange={e => setAdminNote(e.target.value)}
            rows={2}
            className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-sm text-slate-300 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-teal-400 resize-none"
            placeholder="Internal notes..."
          />
        </div>
      </div>
      <button
        onClick={() => onSave(item.id, status, adminNote)}
        disabled={saving}
        className="flex items-center gap-1.5 px-4 py-2 bg-teal-400 text-slate-900 font-semibold rounded-lg hover:bg-teal-300 disabled:opacity-50 transition-colors text-sm"
      >
        <Save size={14} />
        {saving ? 'Saving...' : 'Save'}
      </button>
    </div>
  );
};
```

**Step 2: Run tests**

Run: `npx vitest run`
Expected: All tests pass

**Step 3: Commit**

```bash
git add src/components/scribe-standalone/ScribeAdminFeedbackPage.tsx
git commit -m "feat: add admin feedback review page"
```

---

### Task 8: Wire routes and sidebar navigation

**Files:**
- Modify: `src/App.tsx`
- Modify: `src/components/scribe-standalone/ScribeLayout.tsx`

**Step 1: Add routes in App.tsx**

In `src/App.tsx`, add imports at the top:

```typescript
import { ScribeFeedbackPage } from './components/scribe-standalone/ScribeFeedbackPage';
import { ScribeAdminFeedbackPage } from './components/scribe-standalone/ScribeAdminFeedbackPage';
```

Add these routes inside the `<Route path="/scribe/*" ...>` group, after the `account` route:

```tsx
          <Route path="feedback" element={<ScribeFeedbackPage />} />
          <Route path="admin/feedback" element={<ScribeAdminFeedbackPage />} />
```

**Step 2: Add sidebar nav items in ScribeLayout.tsx**

In `src/components/scribe-standalone/ScribeLayout.tsx`, add `MessageSquare` and `Shield` to the lucide imports:

```typescript
import {
  LayoutDashboard,
  Plus,
  FileText,
  User,
  LogOut,
  Sparkles,
  Settings,
  MessageSquare,
  Shield,
} from 'lucide-react';
```

Replace the static `NAV_ITEMS` array with a function that accepts the user, so admin-only items are conditional. Replace lines 14-20 with:

```typescript
const getNavItems = (isAdmin: boolean) => [
  { to: '/scribe/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/scribe/note/new',  icon: Plus,            label: 'New Note'  },
  { to: '/scribe/templates', icon: FileText,         label: 'Templates' },
  { to: '/scribe/settings',  icon: Settings,         label: 'Settings'  },
  { to: '/scribe/feedback',  icon: MessageSquare,    label: 'Feedback'  },
  { to: '/scribe/account',   icon: User,             label: 'Account'   },
  ...(isAdmin ? [{ to: '/scribe/admin/feedback', icon: Shield, label: 'Admin' }] : []),
];
```

In the component body, add this line after the `useLocation()` call:

```typescript
  const navItems = getNavItems(user?.is_admin ?? false);
```

Then replace all references to `NAV_ITEMS` with `navItems` (there are 2: one in the desktop nav and one in the mobile bottom bar).

**Step 3: Run tests**

Run: `npx vitest run`
Expected: All tests pass

**Step 4: Verify build**

Run: `npm run build`
Expected: Build succeeds

**Step 5: Commit**

```bash
git add src/App.tsx src/components/scribe-standalone/ScribeLayout.tsx
git commit -m "feat: wire feedback routes and add sidebar navigation items"
```

---

### Task 9: Update tests + final verification

**Files:**
- Modify: `src/stores/scribeAuthStore.test.ts` (if needed)

**Step 1: Update any tests that assert on ScribeUser shape**

In `src/stores/scribeAuthStore.test.ts`, if there are mock user objects, add `is_admin: false` to them. Check if existing tests break and fix accordingly.

**Step 2: Run full test suite**

Run: `npx vitest run`
Expected: All tests pass (131+)

**Step 3: Run backend type-check**

Run: `npx tsc --noEmit -p backend/tsconfig.json`
Expected: No errors

**Step 4: Run frontend build**

Run: `npm run build`
Expected: Build succeeds

**Step 5: Commit any test fixes**

```bash
git add -A
git commit -m "test: update test fixtures for is_admin field"
```

---

### Task 10: Push and deploy

**Step 1: Push to remote**

```bash
git push origin main
```

**Step 2: Deploy on DO droplet**

SSH into the droplet and run:

```bash
cd /opt/docassistai
git pull origin main
docker compose -f infra/docker-compose.prod.yml up -d --build backend
```

**Step 3: Set your user as admin**

After the container restarts, run this SQL to make your account an admin:

```bash
docker compose -f infra/docker-compose.prod.yml exec postgres psql -U docassistai -c "UPDATE scribe_users SET is_admin = true WHERE email = 'YOUR_EMAIL';"
```

**Step 4: Verify**

- Log in → sidebar shows "Feedback" link
- Submit feedback → appears in "Your Submissions"
- Navigate to `/scribe/admin/feedback` → shows all submissions with filters
- Update status/note on a submission → saves correctly
