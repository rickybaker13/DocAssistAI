# DocAssist Scribe UI Redesign Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task.

**Goal:** Transform the plain light-mode Scribe UI into a dark-first, clinically polished tool with a slate/teal palette, Lucide icons, desktop sidebar, and mobile bottom navigation.

**Architecture:** Pure style-only overhaul — no business logic changes, no new component libraries. Every component keeps its existing structure; only Tailwind classes and emoji icons change. Dark is the default (no CSS `dark:` prefix toggling needed — classes are set to dark values directly). Lucide React replaces all emoji and text-symbol icons.

**Tech Stack:** React 18, Tailwind CSS 3, Lucide React (new), Vitest (existing tests must stay green)

**Design Reference:** `docs/plans/2026-02-25-ui-redesign-design.md`

---

## Color Cheat Sheet (reference throughout all tasks)

```
Page backgrounds:   bg-slate-950          (#020617)
Surfaces/sidebar:   bg-slate-900          (#0f172a)
Cards:              bg-slate-800          (#1e293b)
Elevated/hover:     bg-slate-700          (#334155)
Borders:            border-slate-700      (#334155)
Subtle borders:     border-slate-800      (#1e293b)

Teal (primary):     text-teal-400 / bg-teal-400   (#2dd4bf)
Teal hover:         hover:bg-teal-300 / text-teal-300
Teal bg tint:       bg-teal-400/20 / bg-teal-950
Teal border tint:   border-teal-400/30

Text primary:       text-slate-50         (#f8fafc)
Text secondary:     text-slate-400        (#94a3b8)
Text disabled:      text-slate-600        (#475569)
Text on teal btn:   text-slate-900

Status - Draft:     bg-amber-950 text-amber-400 border border-amber-400/30
Status - Final:     bg-emerald-950 text-emerald-400 border border-emerald-400/30
Error bg/text:      bg-red-950 text-red-400
Info bg/text:       bg-sky-950 text-sky-400
Ghost-write:        bg-violet-950 border-violet-400/30 text-violet-400
```

---

## Task 1: Foundation — Install Lucide, Update CSS & Tailwind

**Files:**
- Modify: `package.json` (frontend root)
- Modify: `src/index.css`
- Modify: `tailwind.config.js`

**Step 1: Install lucide-react**

```bash
cd /Users/bitbox/Documents/DocAssistAI && npm install lucide-react
```

Expected: `lucide-react` added to `dependencies` in `package.json`. No errors.

**Step 2: Verify install**

```bash
node -e "require('./node_modules/lucide-react/dist/cjs/lucide-react.js'); console.log('lucide-react OK')"
```

Expected: `lucide-react OK`

**Step 3: Update `src/index.css`**

Replace the entire file with:

```css
/* Google Fonts — must be first line */
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400&display=swap');

@tailwind base;
@tailwind components;
@tailwind utilities;

:root {
  font-family: 'Inter', system-ui, sans-serif;
  line-height: 1.5;
  font-weight: 400;
  font-synthesis: none;
  text-rendering: optimizeLegibility;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}

body {
  margin: 0;
  min-width: 320px;
  min-height: 100vh;
  background-color: #020617; /* slate-950 */
  color: #f8fafc;            /* slate-50 */
}

#root {
  width: 100%;
  min-height: 100vh;
}

/* Dark scrollbar */
::-webkit-scrollbar { width: 6px; height: 6px; }
::-webkit-scrollbar-track { background: #0f172a; }
::-webkit-scrollbar-thumb { background: #334155; border-radius: 3px; }
::-webkit-scrollbar-thumb:hover { background: #475569; }

/* JetBrains Mono for clinical IDs */
.font-mono { font-family: 'JetBrains Mono', monospace; }
```

**Step 4: Update `tailwind.config.js`**

Replace with:

```js
/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
    },
  },
  plugins: [],
}
```

**Step 5: Run tests to confirm baseline**

```bash
cd /Users/bitbox/Documents/DocAssistAI && npx vitest run src/components/scribe-standalone/ --reporter=verbose 2>&1 | tail -10
```

Expected: All tests pass (no failures from CSS/config changes).

**Step 6: Commit**

```bash
cd /Users/bitbox/Documents/DocAssistAI && git add package.json package-lock.json src/index.css tailwind.config.js && git commit -m "feat(ui): install lucide-react, dark base CSS, Inter + JetBrains Mono fonts"
```

---

## Task 2: ScribeLayout — Desktop Sidebar + Mobile Bottom Nav

**Files:**
- Modify: `src/components/scribe-standalone/ScribeLayout.tsx`

This is the most structural change — the app shell. Replace the top-bar-only layout with:
- **Mobile (< md):** sticky mini top bar + fixed bottom tab bar
- **Desktop (≥ md):** 240px fixed left sidebar + padded main content

**Step 1: Replace `ScribeLayout.tsx` entirely**

```tsx
import React from 'react';
import { Outlet, Link, useNavigate, useLocation } from 'react-router-dom';
import { useScribeAuthStore } from '../../stores/scribeAuthStore';
import {
  LayoutDashboard,
  Plus,
  FileText,
  User,
  LogOut,
  Stethoscope,
} from 'lucide-react';

const NAV_ITEMS = [
  { to: '/scribe/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/scribe/note/new',  icon: Plus,            label: 'New Note'  },
  { to: '/scribe/templates', icon: FileText,         label: 'Templates' },
];

export const ScribeLayout: React.FC = () => {
  const { user, logout } = useScribeAuthStore();
  const navigate = useNavigate();
  const location = useLocation();

  const handleLogout = async () => {
    await logout();
    navigate('/scribe/login');
  };

  const isActive = (path: string) => location.pathname === path || location.pathname.startsWith(path + '/');

  return (
    <div className="min-h-screen bg-slate-950 flex">

      {/* ── Desktop sidebar (≥ md) ──────────────────────────────────────── */}
      <aside className="hidden md:flex flex-col fixed inset-y-0 left-0 w-60 bg-slate-900 border-r border-slate-800 z-20">
        {/* Logo */}
        <div className="px-5 py-5 flex items-center gap-2.5 border-b border-slate-800">
          <div className="w-8 h-8 bg-teal-400 rounded-lg flex items-center justify-center flex-shrink-0">
            <Stethoscope size={18} className="text-slate-900" />
          </div>
          <span className="font-semibold text-slate-50 text-sm tracking-tight">DocAssist Scribe</span>
        </div>

        {/* Nav items */}
        <nav className="flex-1 px-3 py-4 space-y-1">
          {NAV_ITEMS.map(({ to, icon: Icon, label }) => (
            <Link
              key={to}
              to={to}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150 ${
                isActive(to)
                  ? 'bg-teal-950 text-teal-400'
                  : 'text-slate-400 hover:text-slate-100 hover:bg-slate-800'
              }`}
            >
              <Icon size={18} />
              {label}
            </Link>
          ))}
        </nav>

        {/* User + logout */}
        {user && (
          <div className="px-3 py-4 border-t border-slate-800 space-y-1">
            <div className="flex items-center gap-3 px-3 py-2">
              <div className="w-7 h-7 bg-slate-700 rounded-full flex items-center justify-center flex-shrink-0">
                <User size={14} className="text-slate-400" />
              </div>
              <span className="text-xs text-slate-400 truncate">{user.name || user.email}</span>
            </div>
            <button
              onClick={handleLogout}
              className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-slate-500 hover:text-red-400 hover:bg-slate-800 transition-all duration-150"
            >
              <LogOut size={16} />
              Sign out
            </button>
          </div>
        )}
      </aside>

      {/* ── Main content area ────────────────────────────────────────────── */}
      <div className="flex-1 md:ml-60 flex flex-col min-h-screen">

        {/* Mobile top bar (< md) */}
        <header className="md:hidden sticky top-0 z-10 bg-slate-900 border-b border-slate-800 px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 bg-teal-400 rounded-md flex items-center justify-center">
              <Stethoscope size={15} className="text-slate-900" />
            </div>
            <span className="font-semibold text-slate-50 text-sm">DocAssist Scribe</span>
          </div>
          {user && (
            <button onClick={handleLogout} className="text-xs text-slate-500 hover:text-red-400 transition-colors">
              Sign out
            </button>
          )}
        </header>

        {/* Page content */}
        <main className="flex-1 px-4 md:px-8 py-6 pb-24 md:pb-8 max-w-4xl w-full mx-auto">
          <Outlet />
        </main>

        {/* Mobile bottom tab bar (< md) */}
        <nav className="md:hidden fixed bottom-0 inset-x-0 z-20 bg-slate-900/95 backdrop-blur border-t border-slate-800 flex">
          {NAV_ITEMS.map(({ to, icon: Icon, label }) => (
            <Link
              key={to}
              to={to}
              className={`flex-1 flex flex-col items-center justify-center py-2.5 gap-1 text-xs font-medium transition-colors ${
                isActive(to) ? 'text-teal-400' : 'text-slate-500 hover:text-slate-300'
              }`}
            >
              <Icon size={20} />
              <span>{label}</span>
            </Link>
          ))}
          <button
            onClick={handleLogout}
            className="flex-1 flex flex-col items-center justify-center py-2.5 gap-1 text-xs font-medium text-slate-500 hover:text-red-400 transition-colors"
          >
            <User size={20} />
            <span>Account</span>
          </button>
        </nav>

      </div>
    </div>
  );
};
```

**Step 2: Run layout tests**

```bash
cd /Users/bitbox/Documents/DocAssistAI && npx vitest run src/components/scribe-standalone/ScribeLayout.test.tsx --reporter=verbose 2>&1
```

Expected: All ScribeLayout tests pass. (The tests check for "DocAssist Scribe" text, logout button, and nav links — all preserved above.)

**Step 3: Commit**

```bash
cd /Users/bitbox/Documents/DocAssistAI && git add src/components/scribe-standalone/ScribeLayout.tsx && git commit -m "feat(ui): desktop sidebar + mobile bottom nav in ScribeLayout"
```

---

## Task 3: Login + Register Pages

**Files:**
- Modify: `src/components/scribe-standalone/ScribeLoginPage.tsx`
- Modify: `src/components/scribe-standalone/ScribeRegisterPage.tsx`

**Step 1: Replace `ScribeLoginPage.tsx`**

```tsx
import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useScribeAuthStore } from '../../stores/scribeAuthStore';
import { Stethoscope } from 'lucide-react';

export const ScribeLoginPage: React.FC = () => {
  const { login, loading, error, user } = useScribeAuthStore();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);

  useEffect(() => { if (user) navigate("/scribe/dashboard"); }, [user, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const ok = await login(email, password, rememberMe);
    if (ok) navigate('/scribe/dashboard');
  };

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        {/* Logo mark */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 bg-teal-400 rounded-2xl mb-4">
            <Stethoscope size={28} className="text-slate-900" />
          </div>
          <h1 className="text-2xl font-semibold text-slate-50 tracking-tight">DocAssist Scribe</h1>
          <p className="text-sm text-slate-400 mt-1">Clinical documentation, simplified</p>
        </div>

        {/* Card */}
        <div className="bg-slate-800 rounded-2xl border border-slate-700 shadow-2xl p-8">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="email" className="block text-xs font-medium text-slate-400 uppercase tracking-wider mb-1.5">Email</label>
              <input
                id="email" type="email" required value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="you@hospital.org"
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2.5 text-sm text-slate-50 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-teal-400 focus:border-teal-400 transition-colors"
              />
            </div>
            <div>
              <label htmlFor="password" className="block text-xs font-medium text-slate-400 uppercase tracking-wider mb-1.5">Password</label>
              <input
                id="password" type="password" required value={password}
                onChange={e => setPassword(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2.5 text-sm text-slate-50 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-teal-400 focus:border-teal-400 transition-colors"
              />
            </div>
            <label className="flex items-center gap-2 text-sm text-slate-400 cursor-pointer">
              <input
                type="checkbox" checked={rememberMe}
                onChange={e => setRememberMe(e.target.checked)}
                className="accent-teal-400"
              />
              Remember me for 30 days
            </label>
            {error && (
              <p className="text-sm text-red-400 bg-red-950 border border-red-400/20 rounded-lg p-2.5">{error}</p>
            )}
            <button
              type="submit" disabled={loading}
              className="w-full bg-teal-400 text-slate-900 rounded-lg py-2.5 text-sm font-semibold hover:bg-teal-300 disabled:opacity-50 transition-colors mt-2"
            >
              {loading ? 'Signing in…' : 'Sign in'}
            </button>
          </form>
        </div>

        <p className="text-center text-sm text-slate-500 mt-5">
          No account?{' '}
          <Link to="/scribe/register" className="text-teal-400 hover:text-teal-300 transition-colors">
            Create account
          </Link>
        </p>
      </div>
    </div>
  );
};
```

**Step 2: Read the current RegisterPage to understand its structure, then replace it**

Read: `src/components/scribe-standalone/ScribeRegisterPage.tsx`

Replace with the same dark-theme structure as LoginPage above, keeping all existing form fields (name, email, password, confirmPassword), error handling, and navigation logic. Apply the same card/input/button classes.

Key classes to apply (same as login):
- Page: `min-h-screen bg-slate-950 flex items-center justify-center px-4`
- Card: `bg-slate-800 rounded-2xl border border-slate-700 shadow-2xl p-8`
- Inputs: `bg-slate-900 border border-slate-700 rounded-lg px-3 py-2.5 text-sm text-slate-50 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-teal-400 focus:border-teal-400 transition-colors`
- Button: `w-full bg-teal-400 text-slate-900 rounded-lg py-2.5 text-sm font-semibold hover:bg-teal-300 disabled:opacity-50 transition-colors`
- Error: `text-sm text-red-400 bg-red-950 border border-red-400/20 rounded-lg p-2.5`
- Link: `text-teal-400 hover:text-teal-300 transition-colors`

**Step 3: Run auth tests**

```bash
cd /Users/bitbox/Documents/DocAssistAI && npx vitest run src/components/scribe-standalone/ScribeLoginPage.test.tsx src/components/scribe-standalone/ScribeRegisterPage.test.tsx --reporter=verbose 2>&1
```

Expected: All login and register tests pass.

**Step 4: Commit**

```bash
cd /Users/bitbox/Documents/DocAssistAI && git add src/components/scribe-standalone/ScribeLoginPage.tsx src/components/scribe-standalone/ScribeRegisterPage.tsx && git commit -m "feat(ui): dark login + register pages with teal accent and Stethoscope logo"
```

---

## Task 4: Dashboard + NoteCard

**Files:**
- Modify: `src/components/scribe-standalone/ScribeDashboardPage.tsx`
- Modify: `src/components/scribe-standalone/NoteCard.tsx`

**Step 1: Replace `ScribeDashboardPage.tsx`**

```tsx
import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { NoteCard } from './NoteCard';
import { getBackendUrl } from '../../config/appConfig';
import type { Note } from './types';
import { Search, Plus } from 'lucide-react';

const STATUS_FILTERS = ['All', 'Draft', 'Finalized'] as const;
type StatusFilter = typeof STATUS_FILTERS[number];

export const ScribeDashboardPage: React.FC = () => {
  const [notes, setNotes] = useState<Note[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('All');

  useEffect(() => {
    fetch(`${getBackendUrl()}/api/scribe/notes`, { credentials: 'include' })
      .then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); })
      .then(d => { setNotes(d.notes || []); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  const handleDelete = async (id: string) => {
    try {
      const r = await fetch(`${getBackendUrl()}/api/scribe/notes/${id}`, { method: 'DELETE', credentials: 'include' });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      setNotes(prev => prev.filter(n => n.id !== id));
    } catch (e: unknown) {
      console.error('Failed to delete note:', e instanceof Error ? e.message : e);
    }
  };

  const filtered = notes.filter(n => {
    const matchesSearch = !search ||
      (n.patient_label?.toLowerCase().includes(search.toLowerCase())) ||
      n.note_type.replace(/_/g, ' ').includes(search.toLowerCase());
    const matchesStatus =
      statusFilter === 'All' ||
      (statusFilter === 'Draft' && n.status === 'draft') ||
      (statusFilter === 'Finalized' && n.status === 'finalized');
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="flex flex-col gap-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-slate-50 tracking-tight">My Notes</h1>
        <Link
          to="/scribe/note/new"
          className="hidden md:flex items-center gap-1.5 bg-teal-400 text-slate-900 rounded-lg px-4 py-2 text-sm font-semibold hover:bg-teal-300 transition-colors"
        >
          <Plus size={16} />
          New Note
        </Link>
      </div>

      {/* Search */}
      <div className="relative">
        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
        <input
          type="text" value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Search by patient label or note type…"
          aria-label="Search notes"
          className="w-full bg-slate-800 border border-slate-700 rounded-lg pl-9 pr-3 py-2.5 text-sm text-slate-50 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-teal-400 focus:border-teal-400 transition-colors"
        />
      </div>

      {/* Status filters */}
      <div className="flex gap-2">
        {STATUS_FILTERS.map(f => (
          <button
            key={f} onClick={() => setStatusFilter(f)}
            className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
              statusFilter === f
                ? 'bg-teal-400/20 text-teal-400 border-teal-400/30'
                : 'bg-slate-800 text-slate-400 border-slate-700 hover:border-slate-600 hover:text-slate-300'
            }`}
          >
            {f}
          </button>
        ))}
      </div>

      {/* List */}
      {loading ? (
        <div className="flex items-center justify-center h-32">
          <div className="animate-spin h-8 w-8 border-4 border-teal-400 border-t-transparent rounded-full" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16">
          {notes.length === 0 ? (
            <>
              <p className="text-slate-500 text-base mb-2">No notes yet</p>
              <p className="text-slate-600 text-sm mb-4">Record your first patient encounter to get started</p>
              <Link to="/scribe/note/new" className="text-teal-400 hover:text-teal-300 text-sm transition-colors">
                Create first note →
              </Link>
            </>
          ) : (
            <p className="text-slate-500 text-sm">No notes match your search</p>
          )}
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {filtered.map(note => (
            <NoteCard key={note.id} note={note} onDelete={handleDelete} />
          ))}
        </div>
      )}

      {/* Mobile FAB */}
      <Link
        to="/scribe/note/new"
        aria-label="New Note"
        className="md:hidden fixed bottom-20 right-4 z-30 w-14 h-14 bg-teal-400 text-slate-900 rounded-full shadow-[0_0_20px_rgba(45,212,191,0.25)] flex items-center justify-center hover:bg-teal-300 transition-all duration-150"
      >
        <Plus size={24} />
      </Link>
    </div>
  );
};
```

**Step 2: Read and replace `NoteCard.tsx`**

Read: `src/components/scribe-standalone/NoteCard.tsx`

Replace with a dark version that:
- Uses `bg-slate-800 border border-slate-700 rounded-xl p-4 hover:bg-slate-700 transition-all duration-150`
- Adds `border-l-4` left accent: `border-l-teal-400` for draft, `border-l-emerald-400` for finalized
- Status badges: draft = `bg-amber-950 text-amber-400 border border-amber-400/30 text-xs px-2 py-0.5 rounded-full`, finalized = `bg-emerald-950 text-emerald-400 border border-emerald-400/30 text-xs px-2 py-0.5 rounded-full`
- Note title: `text-slate-50 font-medium text-sm`
- Metadata (type, date): `text-slate-400 text-xs`
- Delete button: imports `Trash2` from `lucide-react`, uses `aria-label="Delete note"`, styled `text-slate-600 hover:text-red-400 hover:bg-slate-600 p-1.5 rounded-lg transition-all duration-150`
- Confirm "Delete" button text stays as "Delete" (exact string — tests check it)

**Step 3: Run dashboard tests**

```bash
cd /Users/bitbox/Documents/DocAssistAI && npx vitest run src/components/scribe-standalone/ScribeDashboardPage.test.tsx src/components/scribe-standalone/NoteCard.test.tsx --reporter=verbose 2>&1
```

Expected: All dashboard and NoteCard tests pass.

**Step 4: Commit**

```bash
cd /Users/bitbox/Documents/DocAssistAI && git add src/components/scribe-standalone/ScribeDashboardPage.tsx src/components/scribe-standalone/NoteCard.tsx && git commit -m "feat(ui): dark dashboard + NoteCard with teal/emerald accents and Trash2 icon"
```

---

## Task 5: Note Builder — NoteBuilderPage, SectionLibrary, NoteCanvas

**Files:**
- Modify: `src/components/scribe-standalone/NoteBuilderPage.tsx`
- Modify: `src/components/scribe-standalone/SectionLibrary.tsx`
- Modify: `src/components/scribe-standalone/NoteCanvas.tsx`

**Step 1: Read all three files** — read each file completely before editing.

**Step 2: Apply dark theme to `NoteBuilderPage.tsx`**

Key class replacements:
- Outer container: `bg-slate-950 min-h-screen` (handled by layout, but any inline bg overrides need updating)
- Page title: `text-slate-50 font-semibold`
- Note type selector pills (selected): `bg-teal-950 border-teal-400 text-teal-400`
- Note type selector pills (unselected): `bg-slate-800 border-slate-700 text-slate-400 hover:border-slate-600`
- Template selector pills: same pattern
- Verbosity toggle ("Brief" / "Standard" / "Detailed"): active segment = `bg-slate-700 text-slate-50 rounded-full`, inactive = `text-slate-500 hover:text-slate-300`
- Two-column grid wrapper: `gap-6`
- Any `bg-white` → `bg-slate-900`, `bg-gray-50` → `bg-slate-950`, `border-gray-200` → `border-slate-700`, `text-gray-900` → `text-slate-50`, `text-gray-500` → `text-slate-400`
- Primary buttons: `bg-teal-400 text-slate-900 hover:bg-teal-300`
- Secondary buttons: `bg-slate-700 text-slate-100 hover:bg-slate-600 border border-slate-600`

**Step 3: Apply dark theme to `SectionLibrary.tsx`**

Key class replacements:
- Panel background: `bg-slate-900 border-r border-slate-800` (on desktop split)
- Search input: same dark input style as dashboard
- Section items: `bg-slate-800 border border-slate-700 rounded-lg p-3 cursor-grab hover:bg-slate-700 hover:border-slate-600 transition-all duration-150`
- Import `GripVertical` from `lucide-react` and add it as the drag handle: `<GripVertical size={14} className="text-slate-600 flex-shrink-0" />`
- Section name: `text-slate-200 text-sm font-medium`
- Section description: `text-slate-500 text-xs`

**Step 4: Apply dark theme to `NoteCanvas.tsx`**

Key class replacements:
- Canvas area: `bg-slate-900 rounded-xl border border-slate-800 min-h-[200px] p-3`
- Empty state: `border-dashed border-2 border-slate-700 text-slate-600`
- Section cards in canvas: `bg-slate-800 border border-slate-700 rounded-lg p-3 flex items-center gap-2`
- Left accent on section: `border-l-4 border-teal-400`
- GripVertical drag handle: `text-slate-600 hover:text-slate-400`
- Section name in canvas: `text-slate-200 text-sm`
- Remove button (×): import `X` from `lucide-react`, style `text-slate-600 hover:text-red-400`

**Step 5: Run builder tests**

```bash
cd /Users/bitbox/Documents/DocAssistAI && npx vitest run src/components/scribe-standalone/NoteBuilderPage.test.tsx src/components/scribe-standalone/SectionLibrary.test.tsx src/components/scribe-standalone/NoteCanvas.test.tsx --reporter=verbose 2>&1
```

Expected: All tests pass.

**Step 6: Commit**

```bash
cd /Users/bitbox/Documents/DocAssistAI && git add src/components/scribe-standalone/NoteBuilderPage.tsx src/components/scribe-standalone/SectionLibrary.tsx src/components/scribe-standalone/NoteCanvas.tsx && git commit -m "feat(ui): dark theme for NoteBuilder, SectionLibrary, NoteCanvas with GripVertical drag handles"
```

---

## Task 6: Note Page + Section Editor

**Files:**
- Modify: `src/components/scribe-standalone/ScribeNotePage.tsx`
- Modify: `src/components/scribe-standalone/NoteSectionEditor.tsx`
- Modify: `src/components/scribe-standalone/CodingTermPopover.tsx`

**Step 1: Read all three files** before editing.

**Step 2: Apply dark theme to `ScribeNotePage.tsx`**

Key changes:
- Page wrapper: `bg-slate-950`
- Page header area: `flex items-center justify-between mb-6`
  - Patient label: `text-slate-50 font-semibold text-lg`
  - Note type badge: `bg-slate-800 border border-slate-700 text-slate-400 text-xs px-2.5 py-1 rounded-lg`
  - Status pill (draft): `bg-amber-950 text-amber-400 border border-amber-400/30 text-xs px-2.5 py-1 rounded-full`
  - Status pill (finalized): `bg-emerald-950 text-emerald-400 border border-emerald-400/30 text-xs px-2.5 py-1 rounded-full`
  - "Finalize" button: `bg-teal-400 text-slate-900 text-sm font-semibold px-4 py-2 rounded-lg hover:bg-teal-300 transition-colors`
- Section cards: `bg-slate-800 border border-slate-700 rounded-xl overflow-hidden mb-3`
- Section card left accent (confidence-driven — read existing confidence logic):
  - > 0.8: `border-l-4 border-teal-400`
  - 0.5–0.8: `border-l-4 border-amber-400`
  - < 0.5: `border-l-4 border-red-400`
  - No confidence: `border-l-4 border-slate-600`
- Section header row: `bg-slate-800 px-4 pt-3 pb-0 flex items-center justify-between`
  - Section title: `text-xs font-semibold uppercase tracking-wider text-slate-400`
  - Confidence badge (small pill top-right): same color logic as left border
- AI trigger button (currently ⚡ or "AI"): replace with `<Sparkles size={14} />` from `lucide-react`
  - Style: `flex items-center gap-1 text-xs text-teal-400 hover:bg-teal-400/10 px-2 py-1 rounded transition-colors`
- Recording/transcription overlay: `bg-slate-950/80 backdrop-blur` with teal spinner
- Record button: `bg-teal-400 text-slate-900 rounded-full` with `Mic` icon from `lucide-react`
- Back button: replace `←` with `<ArrowLeft size={16} />` from `lucide-react`
  - Style: `flex items-center gap-1.5 text-sm text-slate-400 hover:text-slate-200 transition-colors`

**Step 3: Apply dark theme to `NoteSectionEditor.tsx`**

**Critical:** The ICD-10 overlay and textarea must share the same `sharedStyle` object. Only change colors, not font/padding/lineHeight.

Key changes:
- Container: `bg-transparent` (section card provides the bg)
- Textarea: `bg-transparent border-none text-slate-100 placeholder-slate-500 focus:outline-none resize-none w-full`
  - The `sharedStyle` object stays exactly as-is (font, padding, lineHeight unchanged)
- Overlay div: `bg-transparent` (same as before), `color: transparent` (same as before)
- ICD-10 highlight marks: `border-bottom: 2px solid #fbbf24` (amber-400, same as before — visible on dark)
- The `sharedStyle` object MUST remain identical between overlay and textarea

**Step 4: Apply dark theme to `CodingTermPopover.tsx`**

The popover uses `position: fixed` (inline style). Change background/text colors:
- Container: `background: '#1e293b'` (slate-800), `border: '1px solid #334155'` (slate-700), `color: '#f8fafc'` (slate-50)
- Term title: `color: '#fbbf24'` (amber-400)
- Buttons: `background: '#334155'` (slate-700), `color: '#f8fafc'`, hover `#475569`
- Close/skip: `color: '#94a3b8'` (slate-400)

**Step 5: Run note page tests**

```bash
cd /Users/bitbox/Documents/DocAssistAI && npx vitest run src/components/scribe-standalone/ScribeNotePage.test.tsx src/components/scribe-standalone/NoteSectionEditor.test.tsx --reporter=verbose 2>&1
```

Expected: All tests pass. If ICD-10 overlay tests fail, verify `sharedStyle` is unchanged.

**Step 6: Commit**

```bash
cd /Users/bitbox/Documents/DocAssistAI && git add src/components/scribe-standalone/ScribeNotePage.tsx src/components/scribe-standalone/NoteSectionEditor.tsx src/components/scribe-standalone/CodingTermPopover.tsx && git commit -m "feat(ui): dark ScribeNotePage with confidence-colored section borders, Sparkles/Mic/ArrowLeft icons"
```

---

## Task 7: Focused AI Panel

**Files:**
- Modify: `src/components/scribe-standalone/FocusedAIPanel.tsx`

**Step 1: Read `FocusedAIPanel.tsx` completely** — it is the most test-sensitive file. Note every exact string used in tests.

**Critical test strings to preserve exactly:**
- `"✓ Added"` — text string in applied suggestion and citation buttons (do NOT replace with just a Lucide icon)
- `"Preparing note text…"` — loading text during resolve-suggestion
- All `aria-label` values on buttons
- Batch counter text format: `"Processing N of M…"`

**Step 2: Apply dark theme to `FocusedAIPanel.tsx`**

Key class replacements:
- Panel container: `bg-slate-900 border-l border-slate-700` (desktop: fixed right panel); `bg-slate-900 border-t border-slate-700 rounded-t-2xl` (mobile: bottom sheet)
- Panel header: `bg-slate-900 border-b border-slate-700 px-4 py-3 flex items-center justify-between`
  - Title: `text-sm font-semibold text-slate-50 flex items-center gap-2`
  - Add `<Sparkles size={15} className="text-teal-400" />` before "AI Analysis" title text
  - Close button: replace `×` with `<X size={16} />` from `lucide-react`, style `p-1.5 rounded-lg text-slate-500 hover:text-slate-200 hover:bg-slate-700 transition-all duration-150`
- Tab bar (Analysis / Suggestions / Citations): active = `border-b-2 border-teal-400 text-teal-400`, inactive = `text-slate-500 hover:text-slate-300`
- Suggestion cards: `bg-slate-800 border border-slate-700 rounded-xl p-3 mb-2`
  - "Add →" button: replace `→` with `<ArrowRight size={14} />`, style `flex items-center gap-1 text-xs text-teal-400 hover:bg-teal-400/10 px-2 py-1 rounded transition-colors`
  - Applied state: keep `"✓ Added"` text but add `opacity-60` to the card + emerald-400 border
- Citation cards: `bg-sky-950 border border-sky-400/30 rounded-xl p-3 mb-2`
  - Guideline text: `text-sky-400 text-xs font-semibold`
  - Recommendation text: `text-slate-200 text-sm`
- Ghost-write preview: `bg-violet-950 border border-violet-400/30 rounded-xl p-3`
  - Confirm button: `bg-teal-400 text-slate-900 font-semibold text-sm rounded-lg px-4 py-2 hover:bg-teal-300`
  - Cancel button: `text-slate-500 hover:text-slate-300 text-sm px-3 py-2`
- Progress bar (batch): `<div className="h-1.5 bg-slate-700 rounded-full"><div className="h-1.5 bg-teal-400 rounded-full transition-all" style={{ width: `${progress}%` }} /></div>`
- Confidence breakdown labels: `text-slate-400 text-xs`
- Any `bg-white` → `bg-slate-800`, `bg-gray-50` → `bg-slate-900`, `text-gray-900` → `text-slate-50`, `text-gray-500` → `text-slate-400`, `border-gray-200` → `border-slate-700`
- `bg-blue-50` / `bg-blue-100` → `bg-sky-950`, `text-blue-700` → `text-sky-400`
- `bg-green-50` / `bg-green-100` → `bg-emerald-950`, `text-green-700` → `text-emerald-400`
- `bg-purple-50` → `bg-violet-950`, `text-purple-700` → `text-violet-400`

**Step 3: Run FocusedAIPanel tests**

```bash
cd /Users/bitbox/Documents/DocAssistAI && npx vitest run src/components/scribe-standalone/FocusedAIPanel.test.tsx --reporter=verbose 2>&1
```

Expected: All tests pass.

**If `✓ Added` test fails:** The test uses `getByText('✓ Added')`. Ensure the applied state renders `<span>✓ Added</span>` as a text node (not replaced by a pure Lucide icon). The Check icon, if added, is decorative only and the `✓ Added` text must still be present.

**Step 4: Commit**

```bash
cd /Users/bitbox/Documents/DocAssistAI && git add src/components/scribe-standalone/FocusedAIPanel.tsx && git commit -m "feat(ui): dark FocusedAIPanel with Sparkles/X/ArrowRight icons and teal/sky/violet palette"
```

---

## Task 8: Chat Drawer

**Files:**
- Modify: `src/components/scribe-standalone/ScribeChatDrawer.tsx`

**Step 1: Read `ScribeChatDrawer.tsx` completely** before editing.

**Step 2: Apply dark theme to `ScribeChatDrawer.tsx`**

Key changes:
- FAB button: `fixed bottom-20 right-5 md:bottom-6 md:right-6 z-40 w-14 h-14 bg-teal-400 text-slate-900 rounded-full shadow-[0_0_20px_rgba(45,212,191,0.25)] flex items-center justify-center hover:bg-teal-300 hover:shadow-[0_0_28px_rgba(45,212,191,0.35)] transition-all duration-150`
  - Replace `💬` with `<MessageSquare size={22} />` from `lucide-react`
- Drawer container: `fixed inset-x-0 bottom-0 z-50 sm:inset-auto sm:right-6 sm:bottom-6 sm:w-96 bg-slate-900 rounded-t-2xl sm:rounded-2xl shadow-2xl border border-slate-700 flex flex-col`
- Header: `flex items-center justify-between px-4 py-3 border-b border-slate-700`
  - Title: `font-semibold text-slate-100 text-sm flex items-center gap-1.5`
  - Add `<MessageSquare size={15} className="text-teal-400" />` before title text
  - Close button: replace `✕` / `×` with `<X size={16} />`, style `p-1.5 rounded-lg text-slate-500 hover:text-slate-200 hover:bg-slate-700 transition-all duration-150`
- User message bubbles: `bg-teal-400/20 text-teal-300`
- Assistant message bubbles: `bg-slate-800 text-slate-100`
- "Thinking…" bubble: `bg-slate-800 text-slate-500 animate-pulse`
- "Add to note →" text link: replace `→` with `<ArrowRight size={11} />`, `text-teal-400 hover:text-teal-300`
- Ghost-write section: `border-t border-slate-700 p-3 bg-violet-950/50`
  - Label: `text-xs font-semibold text-violet-400`
  - Select: `bg-slate-800 border border-slate-700 text-slate-200 rounded-lg focus:ring-violet-400`
  - Ghost-write button: `bg-violet-500 text-white font-semibold rounded-lg py-1.5 hover:bg-violet-400`
  - Confirm button: `bg-teal-400 text-slate-900 font-semibold rounded-lg py-1.5 hover:bg-teal-300`
- Input: `bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-50 placeholder-slate-500 focus:ring-2 focus:ring-teal-400 focus:border-teal-400`
- Send button: `bg-teal-400 text-slate-900 rounded-lg px-3 py-2 hover:bg-teal-300 disabled:opacity-50 flex items-center`
  - Replace text/symbol with `<Send size={16} />` from `lucide-react`

**Step 3: Run chat drawer tests**

```bash
cd /Users/bitbox/Documents/DocAssistAI && npx vitest run src/components/scribe-standalone/ScribeChatDrawer.test.tsx --reporter=verbose 2>&1
```

Expected: All tests pass.

**Step 4: Commit**

```bash
cd /Users/bitbox/Documents/DocAssistAI && git add src/components/scribe-standalone/ScribeChatDrawer.tsx && git commit -m "feat(ui): dark ScribeChatDrawer with MessageSquare/X/Send icons and teal glow FAB"
```

---

## Task 9: Full Test Suite + Visual Verification

**Step 1: Run all Scribe component tests**

```bash
cd /Users/bitbox/Documents/DocAssistAI && npx vitest run src/components/scribe-standalone/ --reporter=verbose 2>&1
```

Expected: All tests pass. Zero failures.

**Step 2: Run full frontend suite**

```bash
cd /Users/bitbox/Documents/DocAssistAI && npx vitest run src/ --reporter=verbose 2>&1
```

Expected: All tests pass (same pass rate as before the redesign).

**Step 3: Start dev server and visually verify all screens**

```bash
cd /Users/bitbox/Documents/DocAssistAI && npm run dev
```

Navigate to `http://localhost:8080/scribe/login` and verify:
- [ ] Dark slate-950 background on all pages
- [ ] Teal (not blue) on all primary buttons and active states
- [ ] No emoji icons remain anywhere in the Scribe UI
- [ ] Desktop (> 768px): left sidebar visible with nav items
- [ ] Mobile (< 768px, use browser DevTools): bottom tab bar with 4 items
- [ ] Login page: Stethoscope logo mark, dark card
- [ ] Dashboard: search with Search icon, teal filter pills
- [ ] Chat FAB: teal circle with MessageSquare icon, subtle glow

**Step 4: Commit final verification**

```bash
cd /Users/bitbox/Documents/DocAssistAI && git add -A && git commit -m "feat(ui): complete dark-first UI redesign — slate/teal palette, Lucide icons, responsive layout"
```

**Step 5: Push**

```bash
cd /Users/bitbox/Documents/DocAssistAI && git push
```

---

## Troubleshooting

**`getByText('✓ Added')` fails** — Do not replace `✓ Added` text with a Lucide icon. The Check icon, if added, is decorative. The `✓ Added` text string must stay as a text node.

**ICD-10 underlines misalign** — The `sharedStyle` object in `NoteSectionEditor.tsx` must be completely unchanged. Only class names on wrapper divs change, not the inline `sharedStyle` object.

**Bottom nav shows on desktop / sidebar shows on mobile** — Verify `hidden md:flex` on the sidebar and `md:hidden` on the bottom nav. Both need these responsive modifiers.

**Teal color not rendering** — Tailwind slate and teal are built-in, no config extension needed. If a class like `bg-teal-950` doesn't render, your Tailwind version is older — use `bg-teal-900` as fallback.

**`text-slate-950` not in Tailwind v3** — Use `text-slate-900` instead for very dark text. `slate-950` exists in Tailwind v3.3+ (this project uses 3.3.6, so it's fine).

**Google Fonts don't load in dev** — Network restriction in sandbox. Fallback to `system-ui, sans-serif`. Tests will still pass. Visual difference is minimal.
