---
name: scribe-route
description: >-
  This skill should be used when the user asks to "scaffold a new route",
  "create a new backend feature", "add a new scribe route", "generate route boilerplate",
  "new API endpoint with model and tests", or wants to add a new resource/feature
  to the DocAssistAI backend that needs a route, model, test, and migration.
version: 0.1.0
---

# Scribe Route Scaffolder

Generate a complete backend feature: model, route, test file, migration entry, and server.ts wiring — all following DocAssistAI's exact patterns.

## Workflow

### Step 1: Gather Requirements

Ask the user for:
- **Feature name** (e.g., "patient notes export", "referral tracking") — derives the file names
- **Data fields** — what columns the table needs beyond `id`, `user_id`, `created_at`
- **Endpoints needed** — which CRUD operations (create, read, list, update, delete)
- **Auth level** — one of: `none`, `auth-only`, `auth+subscription` (default: `auth+subscription`)
- **Admin endpoints?** — whether admin-only routes are needed (list all, update status)

### Step 2: Derive Names

From the feature name, derive all naming conventions:

| Concept | Convention | Example (feature: "referral tracking") |
|---------|-----------|----------------------------------------|
| Table name | `scribe_{snake_plural}` | `scribe_referrals` |
| Interface | `Scribe{Pascal}` | `ScribeReferral` |
| Model class | `Scribe{Pascal}Model` | `ScribeReferralModel` |
| Model file | `backend/src/models/scribe{Pascal}.ts` | `scribeReferral.ts` |
| Route file | `backend/src/routes/scribe{Pascal}.ts` | `scribeReferral.ts` |
| Test file | `backend/src/routes/scribe{Pascal}.test.ts` | `scribeReferral.test.ts` |
| Route prefix | `/api/scribe/{kebab}` | `/api/scribe/referrals` |
| Router variable | `scribe{Pascal}Router` | `scribeReferralRouter` |

### Step 3: Generate Files

Generate the following files in order, using the exact templates from `references/patterns.md`:

1. **Model file** — `backend/src/models/scribe{Name}.ts`
   - Interface with all fields (snake_case for DB columns)
   - Class with `create`, `findById`, `findByUserId`, `listAll` methods
   - No constructor — stateless class
   - Each method calls `getPool()` fresh
   - Use `randomUUID()` for ID generation
   - All relative imports use `.js` extension

2. **Route file** — `backend/src/routes/scribe{Name}.ts`
   - Import Router, Request, Response from express
   - Import and apply `scribeAuthMiddleware` inline: `router.use(scribeAuthMiddleware)` — this makes tests self-contained
   - Instantiate model at module scope
   - Input validation on POST/PATCH (check required fields, types, lengths)
   - Error handling with try/catch around DB calls
   - Return `as any` on early-return `res.status().json()` calls
   - Access user ID via `req.scribeUserId!`
   - `export default router` at end

3. **Test file** — `backend/src/routes/scribe{Name}.test.ts`
   - MUST include `import { jest } from '@jest/globals'` (ESM requirement)
   - Express app setup with `express.json()`, `cookieParser()`
   - Mount router at correct path
   - `beforeAll`: set `NODE_ENV=test`, `JWT_SECRET`, `initPool()`, `runMigrations()`, create test user, sign JWT, build cookie string
   - `afterAll`: `closePool()`
   - Test cases: happy path, validation errors, auth errors (no cookie = 401)

4. **Migration entry** — edit `backend/src/database/migrations.ts`
   - Add `CREATE TABLE IF NOT EXISTS` statement to `CREATE_TABLES_SQL`
   - Include `id TEXT PRIMARY KEY`, `user_id TEXT NOT NULL REFERENCES scribe_users(id) ON DELETE CASCADE`
   - Add `created_at TIMESTAMPTZ DEFAULT NOW()`
   - Use `gen_random_uuid()` as default for id if appropriate

### Step 4: Wire into Server

Edit `backend/src/server.ts`:
- Add import at the end of the scribe route import block (around line 27)
- Add `app.use()` line in the route registration block (around line 118-121)
- Auth is handled inline by the route file itself (`router.use(scribeAuthMiddleware)`), so server.ts only needs subscription middleware when required:
  - `auth-only`: `app.use('/api/scribe/{path}', router)` — auth handled by route internally
  - `auth+subscription`: `app.use('/api/scribe/{path}', scribeSubscriptionMiddleware, router)` — only subscription guard at server level

### Step 5: Verify

After generating all files:
1. Run the backend tests to confirm the new test file passes:
   ```bash
   cd backend && node --experimental-vm-modules node_modules/.bin/jest --testPathPatterns="scribe" --no-coverage
   ```
2. Check for TypeScript errors:
   ```bash
   cd backend && npx tsc --noEmit
   ```

## Critical Rules

- **Inline auth middleware:** Routes MUST use `router.use(scribeAuthMiddleware)` inside the route file — this makes tests work without extra middleware setup
- **ESM `.js` extensions:** ALL relative imports MUST end with `.js` — this is non-negotiable
- **`import { jest }`:** MUST be the first import in every test file
- **No constructors on models:** Models are stateless, instantiated once at module scope in route files
- **`getPool()` per method:** Never cache the pool in a class property
- **`as any` on early returns:** TypeScript needs this for `return res.status(X).json(...)` in async handlers
- **`req.scribeUserId!`:** Use non-null assertion — middleware guarantees it's set
- **`CREATE TABLE IF NOT EXISTS`:** Required for idempotent migrations
- **Column migrations:** New columns on existing tables go in `COLUMN_MIGRATIONS` array, not in CREATE TABLE

## Additional Resources

### Reference Files
- **`references/patterns.md`** — Complete code templates for every file type with inline comments
