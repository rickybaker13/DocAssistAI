# Feedback System Design

## Goal

Allow users to submit categorized feedback (bugs, feature requests, general, praise) and give the admin an in-app view to review, filter, and manage all submissions.

## Approach

Full-stack in-app: new Postgres table, Express CRUD API, user submission page in the sidebar, and a protected admin review page. No external dependencies.

## Database

New table: `scribe_feedback`

| Column | Type | Notes |
|---|---|---|
| id | TEXT PK | UUID |
| user_id | TEXT FK → scribe_users | Submitter |
| category | TEXT NOT NULL | `bug`, `feature_request`, `general`, `praise` |
| message | TEXT NOT NULL | Free-text body |
| status | TEXT DEFAULT 'new' | `new`, `read`, `resolved` |
| admin_note | TEXT | Internal note, admin-only |
| created_at | TIMESTAMPTZ DEFAULT NOW() | Submission time |

New column on `scribe_users`: `is_admin BOOLEAN DEFAULT FALSE`. Set manually in DB for admin accounts.

## Backend API

Route file: `backend/src/routes/scribeFeedback.ts`
Mounted at: `/api/scribe/feedback`

### User endpoints (auth + subscription middleware)

- **POST /** — Submit feedback `{ category, message }`. Rate-limited: reject if user has ≥ 5 submissions in the last hour.
- **GET /mine** — List current user's submissions, newest first.

### Admin endpoints (auth + admin middleware)

- **GET /admin** — List all feedback. Optional query params: `category`, `status`. Newest first, limit 50.
- **PATCH /admin/:id** — Update `status` and/or `admin_note`.

### Admin middleware

Check `req.user.is_admin === true`, return 403 otherwise. Simple function, no separate file needed.

## Frontend

### User Feedback Page

- **Route:** `/scribe/feedback`
- **Sidebar:** New "Feedback" item (MessageSquare icon) between Settings and Account
- **Layout:**
  1. Submit form: category dropdown + textarea + submit button
  2. Past submissions list: category badge, message preview, status badge, date

### Admin Feedback Page

- **Route:** `/scribe/admin/feedback`
- **Sidebar:** "Admin" item visible only when `user.is_admin` is true
- **Layout:**
  - Filter bar: category dropdown + status dropdown
  - Table/list of all submissions: date, user email, category badge, message (truncated), status badge
  - Click row to expand: full message, admin note textarea, status dropdown, save button

### Design tokens (match existing app)

- Cards: `bg-slate-900 border border-slate-800 rounded-2xl`
- Primary CTA: `bg-teal-400 text-slate-900 hover:bg-teal-300`
- Inputs: `bg-slate-900 border-slate-700 focus:ring-teal-400`
- Category badges: color-coded (red for bug, blue for feature_request, slate for general, emerald for praise)
- Status badges: `new` = amber, `read` = blue, `resolved` = emerald

## Auth store changes

Add `is_admin: boolean` to `ScribeUser` interface. Returned from `/api/scribe/auth/me`. Controls admin sidebar visibility and admin route access.

## Files touched

| File | Action |
|---|---|
| `backend/src/database/migrations.ts` | Add scribe_feedback table + is_admin column migration |
| `backend/src/models/scribeFeedback.ts` | New model: create, listForUser, listAll, updateStatus |
| `backend/src/routes/scribeFeedback.ts` | New route file with user + admin endpoints |
| `backend/src/server.ts` | Mount feedback routes |
| `backend/src/models/scribeUser.ts` | Add is_admin to interface + SELECT queries |
| `backend/src/routes/scribeAuth.ts` | Include is_admin in /me and login responses |
| `src/stores/scribeAuthStore.ts` | Add is_admin to ScribeUser interface |
| `src/components/scribe-standalone/ScribeLayout.tsx` | Add Feedback + Admin nav items |
| `src/components/scribe-standalone/ScribeFeedbackPage.tsx` | New: user submission + history page |
| `src/components/scribe-standalone/ScribeAdminFeedbackPage.tsx` | New: admin review page |
| `src/App.tsx` | Add /scribe/feedback and /scribe/admin/feedback routes |
