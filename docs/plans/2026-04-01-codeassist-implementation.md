# CodeAssist Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a billing coder module ("CodeAssist") where coders paste clinical notes from EHRs, get AI-extracted ICD-10/CPT/E&M codes with supporting excerpts, and export weekly batches as CMS-1500-aligned spreadsheets — all routed through the existing Presidio PII de-identification pipeline.

**Architecture:** New `coding_manager` and `billing_coder` roles on `scribe_users`. Four new DB tables (`coding_teams`, `coding_team_members`, `coding_sessions`, `coding_usage`). New backend route file `coderAi.ts` for code extraction (follows existing `scribeAi.ts` pattern with PII scrub → Claude → re-inject). New route files for team CRUD, session CRUD, and xlsx export. New frontend pages under `/coder` with Zustand store. Role-based routing in `App.tsx`.

**Tech Stack:** Express + pg (backend), React + Zustand + React Router (frontend), Anthropic Claude API, Presidio PII scrubber, `exceljs` for spreadsheet generation. Tests: Jest + supertest (backend), Vitest + React Testing Library (frontend).

**Design doc:** `docs/plans/2026-04-01-codeassist-billing-coder-design.md`

---

## Phase 1: Database & Models

### Task 1: Add `user_role` and `coding_team_id` columns to `scribe_users`

**Files:**
- Modify: `backend/src/database/migrations.ts` (add to `COLUMN_MIGRATIONS` array)
- Modify: `backend/src/models/scribeUser.ts` (add fields to interface)
- Test: `backend/src/database/migrations.test.ts` (if exists) or verify via manual test

**Step 1: Add column migrations**

In `backend/src/database/migrations.ts`, add to the `COLUMN_MIGRATIONS` array:

```typescript
{
  table: 'scribe_users',
  column: 'user_role',
  sql: `ALTER TABLE scribe_users ADD COLUMN user_role VARCHAR(50) DEFAULT 'clinician'`,
},
{
  table: 'scribe_users',
  column: 'coding_team_id',
  sql: `ALTER TABLE scribe_users ADD COLUMN coding_team_id UUID`,
},
```

**Step 2: Update ScribeUser interface**

In `backend/src/models/scribeUser.ts`, add to the `ScribeUser` interface:

```typescript
user_role: 'clinician' | 'coding_manager' | 'billing_coder';
coding_team_id: string | null;
```

**Step 3: Update the auth store's ScribeUser interface**

In `src/stores/scribeAuthStore.ts`, add to the `ScribeUser` interface:

```typescript
user_role: 'clinician' | 'coding_manager' | 'billing_coder';
coding_team_id: string | null;
```

**Step 4: Run backend tests to verify nothing breaks**

Run: `cd backend && node --experimental-vm-modules node_modules/.bin/jest --no-coverage`
Expected: All existing tests pass (migrations are idempotent).

**Step 5: Commit**

```bash
git add backend/src/database/migrations.ts backend/src/models/scribeUser.ts src/stores/scribeAuthStore.ts
git commit -m "feat(codeassist): add user_role and coding_team_id columns to scribe_users"
```

---

### Task 2: Create `coding_teams` and `coding_team_members` tables

**Files:**
- Modify: `backend/src/database/migrations.ts` (add CREATE TABLE statements)
- Create: `backend/src/models/codingTeam.ts`
- Create: `backend/src/models/codingTeamMember.ts`
- Test: `backend/src/models/codingTeam.test.ts`

**Step 1: Write the failing test**

Create `backend/src/models/codingTeam.test.ts`:

```typescript
import { jest, describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { initPool, closePool } from '../database/db.js';
import { runMigrations } from '../database/migrations.js';
import { ScribeUserModel } from './scribeUser.js';
import { CodingTeamModel } from './codingTeam.js';
import { CodingTeamMemberModel } from './codingTeamMember.js';

const userModel = new ScribeUserModel();
const teamModel = new CodingTeamModel();
const memberModel = new CodingTeamMemberModel();

describe('CodingTeam + CodingTeamMember models', () => {
  let managerId: string;

  beforeAll(async () => {
    process.env.NODE_ENV = 'test';
    await initPool();
    await runMigrations();
    const user = await userModel.create({ email: 'manager@test.com', passwordHash: 'hash' });
    managerId = user.id;
  });

  afterAll(async () => { await closePool(); });

  it('creates a team and returns it', async () => {
    const team = await teamModel.create({ name: 'Test Coding Team', managerUserId: managerId });
    expect(team.id).toBeDefined();
    expect(team.name).toBe('Test Coding Team');
    expect(team.manager_user_id).toBe(managerId);
    expect(team.included_seats).toBe(2);
    expect(team.included_notes).toBe(500);
  });

  it('finds team by id', async () => {
    const team = await teamModel.create({ name: 'Find Me', managerUserId: managerId });
    const found = await teamModel.findById(team.id);
    expect(found).not.toBeNull();
    expect(found!.name).toBe('Find Me');
  });

  it('adds a member to a team', async () => {
    const team = await teamModel.create({ name: 'Member Team', managerUserId: managerId });
    const coder = await userModel.create({ email: 'coder1@test.com', passwordHash: 'hash' });
    const member = await memberModel.create({
      teamId: team.id,
      userId: coder.id,
      role: 'coder',
      invitedBy: managerId,
    });
    expect(member.status).toBe('pending');
    expect(member.role).toBe('coder');
  });

  it('lists members of a team', async () => {
    const team = await teamModel.create({ name: 'List Team', managerUserId: managerId });
    const c1 = await userModel.create({ email: 'list-c1@test.com', passwordHash: 'hash' });
    const c2 = await userModel.create({ email: 'list-c2@test.com', passwordHash: 'hash' });
    await memberModel.create({ teamId: team.id, userId: c1.id, role: 'coder', invitedBy: managerId });
    await memberModel.create({ teamId: team.id, userId: c2.id, role: 'coder', invitedBy: managerId });
    const members = await memberModel.listByTeam(team.id);
    expect(members.length).toBe(2);
  });

  it('activates a pending member', async () => {
    const team = await teamModel.create({ name: 'Activate Team', managerUserId: managerId });
    const coder = await userModel.create({ email: 'activate@test.com', passwordHash: 'hash' });
    const member = await memberModel.create({ teamId: team.id, userId: coder.id, role: 'coder', invitedBy: managerId });
    const activated = await memberModel.activate(member.id);
    expect(activated!.status).toBe('active');
    expect(activated!.accepted_at).not.toBeNull();
  });
});
```

**Step 2: Run test to verify it fails**

Run: `cd backend && node --experimental-vm-modules node_modules/.bin/jest --testPathPatterns="codingTeam" --no-coverage`
Expected: FAIL — modules not found.

**Step 3: Add CREATE TABLE SQL to migrations**

In `backend/src/database/migrations.ts`, add to `CREATE_TABLES_SQL`:

```sql
CREATE TABLE IF NOT EXISTS coding_teams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  manager_user_id UUID NOT NULL REFERENCES scribe_users(id),
  plan_tier VARCHAR(50) DEFAULT 'base',
  included_seats INT DEFAULT 2,
  included_notes INT DEFAULT 500,
  overage_rate_cents INT DEFAULT 10,
  billing_cycle_start DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS coding_team_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID NOT NULL REFERENCES coding_teams(id),
  user_id UUID NOT NULL REFERENCES scribe_users(id),
  role VARCHAR(50) NOT NULL,
  invited_by UUID REFERENCES scribe_users(id),
  invited_at TIMESTAMPTZ DEFAULT NOW(),
  accepted_at TIMESTAMPTZ,
  status VARCHAR(50) DEFAULT 'pending'
);
```

**Step 4: Write CodingTeamModel**

Create `backend/src/models/codingTeam.ts`:

```typescript
import { getPool } from '../database/db.js';
import { randomUUID } from 'crypto';

export interface CodingTeam {
  id: string;
  name: string;
  manager_user_id: string;
  plan_tier: string;
  included_seats: number;
  included_notes: number;
  overage_rate_cents: number;
  billing_cycle_start: string;
  created_at: string;
  updated_at: string;
}

export class CodingTeamModel {
  async create(input: { name: string; managerUserId: string }): Promise<CodingTeam> {
    const pool = getPool();
    const id = randomUUID();
    await pool.query(
      `INSERT INTO coding_teams (id, name, manager_user_id)
       VALUES ($1, $2, $3)`,
      [id, input.name, input.managerUserId],
    );
    return (await this.findById(id))!;
  }

  async findById(id: string): Promise<CodingTeam | null> {
    const pool = getPool();
    const result = await pool.query('SELECT * FROM coding_teams WHERE id = $1', [id]);
    return result.rows[0] ?? null;
  }

  async findByManager(managerUserId: string): Promise<CodingTeam | null> {
    const pool = getPool();
    const result = await pool.query('SELECT * FROM coding_teams WHERE manager_user_id = $1', [managerUserId]);
    return result.rows[0] ?? null;
  }

  async update(id: string, fields: Partial<Pick<CodingTeam, 'name' | 'plan_tier'>>): Promise<CodingTeam | null> {
    const pool = getPool();
    await pool.query(
      `UPDATE coding_teams SET name = COALESCE($1, name), plan_tier = COALESCE($2, plan_tier), updated_at = NOW() WHERE id = $3`,
      [fields.name ?? null, fields.plan_tier ?? null, id],
    );
    return this.findById(id);
  }
}
```

**Step 5: Write CodingTeamMemberModel**

Create `backend/src/models/codingTeamMember.ts`:

```typescript
import { getPool } from '../database/db.js';
import { randomUUID } from 'crypto';

export interface CodingTeamMember {
  id: string;
  team_id: string;
  user_id: string;
  role: 'manager' | 'coder';
  invited_by: string | null;
  invited_at: string;
  accepted_at: string | null;
  status: 'pending' | 'active' | 'deactivated';
}

export class CodingTeamMemberModel {
  async create(input: { teamId: string; userId: string; role: 'manager' | 'coder'; invitedBy: string }): Promise<CodingTeamMember> {
    const pool = getPool();
    const id = randomUUID();
    await pool.query(
      `INSERT INTO coding_team_members (id, team_id, user_id, role, invited_by)
       VALUES ($1, $2, $3, $4, $5)`,
      [id, input.teamId, input.userId, input.role, input.invitedBy],
    );
    return (await this.findById(id))!;
  }

  async findById(id: string): Promise<CodingTeamMember | null> {
    const pool = getPool();
    const result = await pool.query('SELECT * FROM coding_team_members WHERE id = $1', [id]);
    return result.rows[0] ?? null;
  }

  async listByTeam(teamId: string): Promise<CodingTeamMember[]> {
    const pool = getPool();
    const result = await pool.query('SELECT * FROM coding_team_members WHERE team_id = $1 ORDER BY invited_at', [teamId]);
    return result.rows;
  }

  async activate(id: string): Promise<CodingTeamMember | null> {
    const pool = getPool();
    await pool.query(
      `UPDATE coding_team_members SET status = 'active', accepted_at = NOW() WHERE id = $1`,
      [id],
    );
    return this.findById(id);
  }

  async deactivate(id: string): Promise<CodingTeamMember | null> {
    const pool = getPool();
    await pool.query(`UPDATE coding_team_members SET status = 'deactivated' WHERE id = $1`, [id]);
    return this.findById(id);
  }

  async countActiveByTeam(teamId: string): Promise<number> {
    const pool = getPool();
    const result = await pool.query(
      `SELECT COUNT(*) as count FROM coding_team_members WHERE team_id = $1 AND status = 'active'`,
      [teamId],
    );
    return parseInt(result.rows[0].count, 10);
  }
}
```

**Step 6: Run tests to verify they pass**

Run: `cd backend && node --experimental-vm-modules node_modules/.bin/jest --testPathPatterns="codingTeam" --no-coverage`
Expected: All 5 tests PASS.

**Step 7: Commit**

```bash
git add backend/src/database/migrations.ts backend/src/models/codingTeam.ts backend/src/models/codingTeamMember.ts backend/src/models/codingTeam.test.ts
git commit -m "feat(codeassist): add coding_teams and coding_team_members tables + models"
```

---

### Task 3: Create `coding_sessions` and `coding_usage` tables

**Files:**
- Modify: `backend/src/database/migrations.ts`
- Create: `backend/src/models/codingSession.ts`
- Create: `backend/src/models/codingUsage.ts`
- Test: `backend/src/models/codingSession.test.ts`

**Step 1: Write the failing test**

Create `backend/src/models/codingSession.test.ts`:

```typescript
import { jest, describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { initPool, closePool } from '../database/db.js';
import { runMigrations } from '../database/migrations.js';
import { ScribeUserModel } from './scribeUser.js';
import { CodingTeamModel } from './codingTeam.js';
import { CodingSessionModel } from './codingSession.js';
import { CodingUsageModel } from './codingUsage.js';

const userModel = new ScribeUserModel();
const teamModel = new CodingTeamModel();
const sessionModel = new CodingSessionModel();
const usageModel = new CodingUsageModel();

describe('CodingSession + CodingUsage models', () => {
  let coderId: string;
  let teamId: string;

  beforeAll(async () => {
    process.env.NODE_ENV = 'test';
    await initPool();
    await runMigrations();
    const manager = await userModel.create({ email: 'sess-mgr@test.com', passwordHash: 'hash' });
    const team = await teamModel.create({ name: 'Session Team', managerUserId: manager.id });
    teamId = team.id;
    const coder = await userModel.create({ email: 'sess-coder@test.com', passwordHash: 'hash' });
    coderId = coder.id;
  });

  afterAll(async () => { await closePool(); });

  it('creates a coding session without note text', async () => {
    const session = await sessionModel.create({
      coderUserId: coderId,
      teamId,
      patientName: 'Doe, John',
      dateOfService: '2026-03-28',
      providerName: 'Dr. Smith',
      noteType: 'inpatient',
      icd10Codes: [{ code: 'E11.9', description: 'T2DM', confidence: 0.92, supporting_text: 'diabetes' }],
      cptCodes: [{ code: '99223', description: 'Initial hospital care', confidence: 0.88, reasoning: 'High MDM' }],
      emLevel: { suggested: '99223', mdm_complexity: 'High', reasoning: 'test' },
      missingDocumentation: ['Laterality not specified'],
    });
    expect(session.id).toBeDefined();
    expect(session.patient_name).toBe('Doe, John');
    expect(session.icd10_codes).toHaveLength(1);
    expect(session.batch_week).toBeDefined(); // auto-computed Monday
  });

  it('lists sessions by coder with pagination', async () => {
    const sessions = await sessionModel.listByCoder(coderId, { limit: 10, offset: 0 });
    expect(sessions.length).toBeGreaterThanOrEqual(1);
  });

  it('lists sessions by team and date range', async () => {
    const sessions = await sessionModel.listByTeam(teamId, {
      start: '2026-03-01',
      end: '2026-04-30',
    });
    expect(sessions.length).toBeGreaterThanOrEqual(1);
  });

  it('updates coder_status', async () => {
    const session = await sessionModel.create({
      coderUserId: coderId,
      teamId,
      patientName: 'Doe, Jane',
      dateOfService: '2026-03-29',
      providerName: 'Dr. Jones',
      noteType: 'ed_visit',
      icd10Codes: [],
      cptCodes: [],
      emLevel: null,
      missingDocumentation: [],
    });
    const updated = await sessionModel.updateStatus(session.id, 'reviewed');
    expect(updated!.coder_status).toBe('reviewed');
  });

  it('increments usage and tracks overage', async () => {
    const usage = await usageModel.increment(teamId, 500); // included limit
    expect(usage.notes_coded).toBe(1);
    expect(usage.overage_notes).toBe(0);

    // Simulate hitting overage
    for (let i = 0; i < 500; i++) {
      await usageModel.increment(teamId, 500);
    }
    const final = await usageModel.getForMonth(teamId);
    expect(final!.overage_notes).toBeGreaterThan(0);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `cd backend && node --experimental-vm-modules node_modules/.bin/jest --testPathPatterns="codingSession" --no-coverage`
Expected: FAIL — modules not found.

**Step 3: Add CREATE TABLE SQL**

In `backend/src/database/migrations.ts`, add to `CREATE_TABLES_SQL`:

```sql
CREATE TABLE IF NOT EXISTS coding_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  coder_user_id UUID NOT NULL REFERENCES scribe_users(id),
  team_id UUID NOT NULL REFERENCES coding_teams(id),
  patient_name VARCHAR(255) NOT NULL,
  mrn VARCHAR(100),
  date_of_service DATE NOT NULL,
  provider_name VARCHAR(255) NOT NULL,
  facility VARCHAR(255),
  note_type VARCHAR(100) NOT NULL,
  icd10_codes JSONB NOT NULL DEFAULT '[]',
  cpt_codes JSONB NOT NULL DEFAULT '[]',
  em_level JSONB,
  missing_documentation JSONB DEFAULT '[]',
  coder_status VARCHAR(50) DEFAULT 'coded',
  batch_week DATE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS coding_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID NOT NULL REFERENCES coding_teams(id),
  month DATE NOT NULL,
  notes_coded INT DEFAULT 0,
  overage_notes INT DEFAULT 0,
  overage_charge_cents INT DEFAULT 0,
  UNIQUE (team_id, month)
);
```

**Step 4: Write CodingSessionModel**

Create `backend/src/models/codingSession.ts`:

```typescript
import { getPool } from '../database/db.js';
import { randomUUID } from 'crypto';

export interface CodingSession {
  id: string;
  coder_user_id: string;
  team_id: string;
  patient_name: string;
  mrn: string | null;
  date_of_service: string;
  provider_name: string;
  facility: string | null;
  note_type: string;
  icd10_codes: any[];
  cpt_codes: any[];
  em_level: any | null;
  missing_documentation: string[];
  coder_status: 'coded' | 'reviewed' | 'flagged';
  batch_week: string;
  created_at: string;
}

function computeBatchWeek(dateOfService: string): string {
  const d = new Date(dateOfService);
  const day = d.getUTCDay();
  const diff = d.getUTCDate() - day + (day === 0 ? -6 : 1); // Monday
  const monday = new Date(d);
  monday.setUTCDate(diff);
  return monday.toISOString().split('T')[0];
}

export class CodingSessionModel {
  async create(input: {
    coderUserId: string;
    teamId: string;
    patientName: string;
    mrn?: string;
    dateOfService: string;
    providerName: string;
    facility?: string;
    noteType: string;
    icd10Codes: any[];
    cptCodes: any[];
    emLevel: any | null;
    missingDocumentation: string[];
  }): Promise<CodingSession> {
    const pool = getPool();
    const id = randomUUID();
    const batchWeek = computeBatchWeek(input.dateOfService);
    await pool.query(
      `INSERT INTO coding_sessions
        (id, coder_user_id, team_id, patient_name, mrn, date_of_service, provider_name, facility, note_type, icd10_codes, cpt_codes, em_level, missing_documentation, batch_week)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)`,
      [
        id, input.coderUserId, input.teamId, input.patientName, input.mrn ?? null,
        input.dateOfService, input.providerName, input.facility ?? null, input.noteType,
        JSON.stringify(input.icd10Codes), JSON.stringify(input.cptCodes),
        input.emLevel ? JSON.stringify(input.emLevel) : null,
        JSON.stringify(input.missingDocumentation), batchWeek,
      ],
    );
    return (await this.findById(id))!;
  }

  async findById(id: string): Promise<CodingSession | null> {
    const pool = getPool();
    const result = await pool.query('SELECT * FROM coding_sessions WHERE id = $1', [id]);
    return result.rows[0] ?? null;
  }

  async listByCoder(coderUserId: string, opts: { limit: number; offset: number }): Promise<CodingSession[]> {
    const pool = getPool();
    const result = await pool.query(
      'SELECT * FROM coding_sessions WHERE coder_user_id = $1 ORDER BY created_at DESC LIMIT $2 OFFSET $3',
      [coderUserId, opts.limit, opts.offset],
    );
    return result.rows;
  }

  async listByTeam(teamId: string, opts: { start: string; end: string }): Promise<CodingSession[]> {
    const pool = getPool();
    const result = await pool.query(
      'SELECT * FROM coding_sessions WHERE team_id = $1 AND date_of_service BETWEEN $2 AND $3 ORDER BY date_of_service, patient_name',
      [teamId, opts.start, opts.end],
    );
    return result.rows;
  }

  async updateStatus(id: string, status: 'coded' | 'reviewed' | 'flagged'): Promise<CodingSession | null> {
    const pool = getPool();
    await pool.query('UPDATE coding_sessions SET coder_status = $1 WHERE id = $2', [status, id]);
    return this.findById(id);
  }

  async deleteById(id: string): Promise<boolean> {
    const pool = getPool();
    const result = await pool.query('DELETE FROM coding_sessions WHERE id = $1', [id]);
    return (result.rowCount ?? 0) > 0;
  }
}
```

**Step 5: Write CodingUsageModel**

Create `backend/src/models/codingUsage.ts`:

```typescript
import { getPool } from '../database/db.js';

export interface CodingUsage {
  id: string;
  team_id: string;
  month: string;
  notes_coded: number;
  overage_notes: number;
  overage_charge_cents: number;
}

export class CodingUsageModel {
  async increment(teamId: string, includedNotes: number): Promise<CodingUsage> {
    const pool = getPool();
    const month = new Date().toISOString().slice(0, 7) + '-01'; // first of month

    // Upsert usage row and increment
    await pool.query(
      `INSERT INTO coding_usage (id, team_id, month, notes_coded)
       VALUES (gen_random_uuid(), $1, $2, 1)
       ON CONFLICT (team_id, month) DO UPDATE
       SET notes_coded = coding_usage.notes_coded + 1`,
      [teamId, month],
    );

    // Now check if over limit and update overage
    const result = await pool.query(
      'SELECT * FROM coding_usage WHERE team_id = $1 AND month = $2',
      [teamId, month],
    );
    const row = result.rows[0];
    if (row.notes_coded > includedNotes && row.overage_notes < row.notes_coded - includedNotes) {
      const overageNotes = row.notes_coded - includedNotes;
      await pool.query(
        `UPDATE coding_usage SET overage_notes = $1, overage_charge_cents = $2 WHERE id = $3`,
        [overageNotes, overageNotes * 10, row.id], // 10 cents per overage note
      );
    }

    return (await this.getForMonth(teamId))!;
  }

  async getForMonth(teamId: string, month?: string): Promise<CodingUsage | null> {
    const pool = getPool();
    const m = month ?? new Date().toISOString().slice(0, 7) + '-01';
    const result = await pool.query(
      'SELECT * FROM coding_usage WHERE team_id = $1 AND month = $2',
      [teamId, m],
    );
    return result.rows[0] ?? null;
  }

  async getHistory(teamId: string, limit: number = 12): Promise<CodingUsage[]> {
    const pool = getPool();
    const result = await pool.query(
      'SELECT * FROM coding_usage WHERE team_id = $1 ORDER BY month DESC LIMIT $2',
      [teamId, limit],
    );
    return result.rows;
  }
}
```

**Step 6: Run tests**

Run: `cd backend && node --experimental-vm-modules node_modules/.bin/jest --testPathPatterns="codingSession" --no-coverage`
Expected: All tests PASS.

**Step 7: Commit**

```bash
git add backend/src/database/migrations.ts backend/src/models/codingSession.ts backend/src/models/codingUsage.ts backend/src/models/codingSession.test.ts
git commit -m "feat(codeassist): add coding_sessions and coding_usage tables + models"
```

---

## Phase 2: Backend Routes

### Task 4: Code extraction AI route (`coderAi.ts`)

**Files:**
- Create: `backend/src/routes/coderAi.ts`
- Modify: `backend/src/server.ts` (mount route)
- Test: `backend/src/routes/coderAi.test.ts`

**Step 1: Write the failing test**

Create `backend/src/routes/coderAi.test.ts`:

```typescript
import { jest, describe, it, expect, beforeAll, beforeEach, afterEach, afterAll } from '@jest/globals';
import request from 'supertest';
import express from 'express';
import cookieParser from 'cookie-parser';
import jwt from 'jsonwebtoken';
import { initPool, closePool } from '../database/db.js';
import { runMigrations } from '../database/migrations.js';
import { ScribeUserModel } from '../models/scribeUser.js';
import { CodingTeamModel } from '../models/codingTeam.js';
import { CodingTeamMemberModel } from '../models/codingTeamMember.js';
import { piiScrubber } from '../services/piiScrubber.js';
import { aiService } from '../services/ai/aiService.js';
import coderAiRouter from './coderAi.js';

const SECRET = 'test-secret';

const app = express();
app.use(express.json());
app.use(cookieParser());
app.use('/api/ai/scribe/coder', coderAiRouter);

describe('POST /api/ai/scribe/coder/extract-codes', () => {
  let coderCookie: string;
  let clinicianCookie: string;
  let mockAiChat: ReturnType<typeof jest.spyOn>;
  let mockScrub: ReturnType<typeof jest.spyOn>;
  let mockReInject: ReturnType<typeof jest.spyOn>;

  beforeAll(async () => {
    process.env.NODE_ENV = 'test';
    process.env.JWT_SECRET = SECRET;
    await initPool();
    await runMigrations();

    const userModel = new ScribeUserModel();
    const teamModel = new CodingTeamModel();
    const memberModel = new CodingTeamMemberModel();

    // Create manager + team + coder
    const manager = await userModel.create({ email: 'ai-mgr@test.com', passwordHash: 'hash' });
    // Update user_role directly for test
    const { getPool } = await import('../database/db.js');
    await getPool().query(`UPDATE scribe_users SET user_role = 'coding_manager' WHERE id = $1`, [manager.id]);
    const team = await teamModel.create({ name: 'AI Test Team', managerUserId: manager.id });
    const coder = await userModel.create({ email: 'ai-coder@test.com', passwordHash: 'hash' });
    await getPool().query(`UPDATE scribe_users SET user_role = 'billing_coder', coding_team_id = $1 WHERE id = $2`, [team.id, coder.id]);
    await memberModel.create({ teamId: team.id, userId: coder.id, role: 'coder', invitedBy: manager.id });

    coderCookie = `scribe_token=${jwt.sign({ userId: coder.id }, SECRET, { expiresIn: '1h' })}`;

    // Create clinician (should be denied)
    const clinician = await userModel.create({ email: 'ai-clinician@test.com', passwordHash: 'hash' });
    clinicianCookie = `scribe_token=${jwt.sign({ userId: clinician.id }, SECRET, { expiresIn: '1h' })}`;

    mockAiChat = jest.spyOn(aiService, 'chat');
    mockScrub = jest.spyOn(piiScrubber, 'scrub');
    mockReInject = jest.spyOn(piiScrubber, 'reInject');
  });

  beforeEach(() => {
    mockScrub.mockImplementation(async (fields) => ({ scrubbedFields: { ...fields }, subMap: {} }));
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

  it('returns 401 without auth', async () => {
    const res = await request(app).post('/api/ai/scribe/coder/extract-codes').send({ noteText: 'test' });
    expect(res.status).toBe(401);
  });

  it('returns 403 for clinician role', async () => {
    const res = await request(app)
      .post('/api/ai/scribe/coder/extract-codes')
      .set('Cookie', clinicianCookie)
      .send({ noteText: 'test note' });
    expect(res.status).toBe(403);
  });

  it('extracts codes from pasted note for billing_coder', async () => {
    mockAiChat.mockResolvedValueOnce({
      content: JSON.stringify({
        icd10_codes: [{ code: 'E11.9', description: 'T2DM', confidence: 0.92, supporting_text: 'diabetes mellitus' }],
        cpt_codes: [{ code: '99223', description: 'Initial hospital care', confidence: 0.88, reasoning: 'High complexity MDM' }],
        em_level: { suggested: '99223', mdm_complexity: 'High', reasoning: 'Multiple diagnoses' },
        missing_documentation: ['Laterality not specified'],
      }),
    } as any);

    const res = await request(app)
      .post('/api/ai/scribe/coder/extract-codes')
      .set('Cookie', coderCookie)
      .send({ noteText: 'Patient with diabetes mellitus presents for follow up.' });

    expect(res.status).toBe(200);
    expect(res.body.icd10_codes).toHaveLength(1);
    expect(res.body.icd10_codes[0].code).toBe('E11.9');
    expect(res.body.cpt_codes).toHaveLength(1);
    expect(res.body.em_level.mdm_complexity).toBe('High');
    expect(res.body.disclaimer).toBeDefined();
  });

  it('calls piiScrubber.scrub before AI and reInject after', async () => {
    mockAiChat.mockResolvedValueOnce({
      content: JSON.stringify({
        icd10_codes: [], cpt_codes: [], em_level: null, missing_documentation: [],
      }),
    } as any);

    await request(app)
      .post('/api/ai/scribe/coder/extract-codes')
      .set('Cookie', coderCookie)
      .send({ noteText: 'Patient John Doe has diabetes.' });

    expect(mockScrub).toHaveBeenCalledTimes(1);
  });

  it('returns 503 if PII service is unavailable', async () => {
    const { PiiServiceUnavailableError } = await import('../services/piiScrubber.js');
    mockScrub.mockRejectedValueOnce(new PiiServiceUnavailableError());

    const res = await request(app)
      .post('/api/ai/scribe/coder/extract-codes')
      .set('Cookie', coderCookie)
      .send({ noteText: 'test note' });

    expect(res.status).toBe(503);
  });

  it('returns 400 if noteText is missing', async () => {
    const res = await request(app)
      .post('/api/ai/scribe/coder/extract-codes')
      .set('Cookie', coderCookie)
      .send({});

    expect(res.status).toBe(400);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `cd backend && node --experimental-vm-modules node_modules/.bin/jest --testPathPatterns="coderAi" --no-coverage`
Expected: FAIL — module not found.

**Step 3: Implement `coderAi.ts`**

Create `backend/src/routes/coderAi.ts`. This route follows the exact same PII scrub → AI → re-inject pattern as the existing `/billing-codes` endpoint in `scribeAi.ts`, but accepts raw pasted note text instead of structured sections.

Key points for implementation:
- Import `Router`, `scribeAuthMiddleware`, `piiScrubber`, `aiService`
- Add a role-checking middleware that reads `user_role` from DB and rejects if not `billing_coder` or `coding_manager`
- Validate `noteText` is present and non-empty (400 if missing)
- Scrub `noteText` via `piiScrubber.scrub({ noteText })`
- Call `aiService.chat()` with coding system prompt + scrubbed note
- Parse JSON response, re-inject PII tokens in `supporting_text` and `reasoning` fields
- Return codes + disclaimer
- System prompt: ICD-10-CM guidelines, CPT E/M 2021 MDM framework, temperature 0.2
- Use `cache_control: { type: 'ephemeral' }` on system prompt for prompt caching

**Step 4: Mount in `server.ts`**

In `backend/src/server.ts`, add:

```typescript
import coderAiRouter from './routes/coderAi.js';
// Mount alongside existing AI routes
app.use('/api/ai/scribe/coder', scribeAuthMiddleware, coderAiRouter);
```

**Step 5: Run tests**

Run: `cd backend && node --experimental-vm-modules node_modules/.bin/jest --testPathPatterns="coderAi" --no-coverage`
Expected: All 5 tests PASS.

**Step 6: Run full backend test suite to verify no regressions**

Run: `cd backend && node --experimental-vm-modules node_modules/.bin/jest --no-coverage`
Expected: All tests PASS.

**Step 7: Commit**

```bash
git add backend/src/routes/coderAi.ts backend/src/routes/coderAi.test.ts backend/src/server.ts
git commit -m "feat(codeassist): add /api/ai/scribe/coder/extract-codes route with PII scrubbing"
```

---

### Task 5: Team management routes (`coderTeams.ts`)

**Files:**
- Create: `backend/src/routes/coderTeams.ts`
- Modify: `backend/src/server.ts`
- Test: `backend/src/routes/coderTeams.test.ts`

**Step 1: Write the failing test**

Create `backend/src/routes/coderTeams.test.ts` with tests for:
- `POST /api/scribe/coder/teams` — creates team (manager only)
- `GET /api/scribe/coder/teams/:id` — returns team + members
- `POST /api/scribe/coder/teams/:id/invite` — invites a coder by email
- `PATCH /api/scribe/coder/teams/:id/members/:mid` — deactivate/reactivate
- `GET /api/scribe/coder/teams/:id/usage` — returns current month usage
- 401 without auth, 403 for non-manager roles

Follow the same test setup pattern from Task 4: supertest + express app + JWT cookies + pg-mem.

**Step 2: Run test to verify it fails**

**Step 3: Implement `coderTeams.ts`**

Router with endpoints:
- `POST /` — validate manager role, create team, create manager as member, update user's `coding_team_id`
- `GET /:id` — return team + members list (manager of that team only)
- `POST /:id/invite` — validate email, create user stub if needed, create pending member, (email sending deferred to Phase 4)
- `PATCH /:id/members/:mid` — toggle active/deactivated
- `GET /:id/usage` — return `codingUsage.getForMonth()` + `getHistory()`

**Step 4: Mount in `server.ts`**

```typescript
import coderTeamsRouter from './routes/coderTeams.js';
app.use('/api/scribe/coder/teams', scribeAuthMiddleware, coderTeamsRouter);
```

**Step 5: Run tests**

**Step 6: Commit**

```bash
git add backend/src/routes/coderTeams.ts backend/src/routes/coderTeams.test.ts backend/src/server.ts
git commit -m "feat(codeassist): add team management routes"
```

---

### Task 6: Coding session CRUD routes (`coderSessions.ts`)

**Files:**
- Create: `backend/src/routes/coderSessions.ts`
- Modify: `backend/src/server.ts`
- Test: `backend/src/routes/coderSessions.test.ts`

**Step 1: Write the failing test**

Tests for:
- `GET /api/scribe/coder/sessions` — list coder's sessions (paginated)
- `GET /api/scribe/coder/sessions/:id` — single session
- `PATCH /api/scribe/coder/sessions/:id` — update status to 'reviewed' or 'flagged'
- `DELETE /api/scribe/coder/sessions/:id` — delete session
- Managers can see team sessions, coders can only see their own

**Step 2: Run to verify failure**

**Step 3: Implement `coderSessions.ts`**

- `GET /` — if role is manager, accept optional `teamId` + date range filters; if coder, filter to own sessions
- `GET /:id` — fetch by id, verify ownership (coder owns it or manager of same team)
- `PATCH /:id` — validate status value, update
- `DELETE /:id` — verify ownership, delete

**Step 4: Mount in `server.ts`**

```typescript
import coderSessionsRouter from './routes/coderSessions.js';
app.use('/api/scribe/coder/sessions', scribeAuthMiddleware, coderSessionsRouter);
```

**Step 5: Run tests, commit**

```bash
git add backend/src/routes/coderSessions.ts backend/src/routes/coderSessions.test.ts backend/src/server.ts
git commit -m "feat(codeassist): add coding session CRUD routes"
```

---

### Task 7: Spreadsheet export route

**Files:**
- Run: `cd backend && npm install exceljs` (add dependency)
- Create: `backend/src/routes/coderExport.ts`
- Modify: `backend/src/server.ts`
- Test: `backend/src/routes/coderExport.test.ts`

**Step 1: Install exceljs**

Run: `cd backend && npm install exceljs`

**Step 2: Write the failing test**

Create `backend/src/routes/coderExport.test.ts`:

```typescript
import { jest, describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import request from 'supertest';
import express from 'express';
import cookieParser from 'cookie-parser';
import jwt from 'jsonwebtoken';
import { initPool, closePool } from '../database/db.js';
import { runMigrations } from '../database/migrations.js';
import { ScribeUserModel } from '../models/scribeUser.js';
import { CodingTeamModel } from '../models/codingTeam.js';
import { CodingSessionModel } from '../models/codingSession.js';
import coderExportRouter from './coderExport.js';

const SECRET = 'test-secret';
const app = express();
app.use(express.json());
app.use(cookieParser());
app.use('/api/scribe/coder/export', coderExportRouter);

describe('GET /api/scribe/coder/export', () => {
  let coderCookie: string;

  beforeAll(async () => {
    process.env.NODE_ENV = 'test';
    process.env.JWT_SECRET = SECRET;
    await initPool();
    await runMigrations();

    const userModel = new ScribeUserModel();
    const teamModel = new CodingTeamModel();
    const sessionModel = new CodingSessionModel();

    const manager = await userModel.create({ email: 'export-mgr@test.com', passwordHash: 'hash' });
    const team = await teamModel.create({ name: 'Export Team', managerUserId: manager.id });
    const coder = await userModel.create({ email: 'export-coder@test.com', passwordHash: 'hash' });
    const { getPool } = await import('../database/db.js');
    await getPool().query(
      `UPDATE scribe_users SET user_role = 'billing_coder', coding_team_id = $1 WHERE id = $2`,
      [team.id, coder.id],
    );

    // Seed a session
    await sessionModel.create({
      coderUserId: coder.id, teamId: team.id, patientName: 'Export, Pat',
      dateOfService: '2026-03-28', providerName: 'Dr. Export', noteType: 'inpatient',
      icd10Codes: [{ code: 'E11.9', description: 'T2DM', confidence: 0.9, supporting_text: 'test' }],
      cptCodes: [{ code: '99223', description: 'Initial care', confidence: 0.85, reasoning: 'High MDM' }],
      emLevel: { suggested: '99223', mdm_complexity: 'High', reasoning: 'test' },
      missingDocumentation: [],
    });

    coderCookie = `scribe_token=${jwt.sign({ userId: coder.id }, SECRET, { expiresIn: '1h' })}`;
  });

  afterAll(async () => { await closePool(); });

  it('returns xlsx binary with correct content type', async () => {
    const res = await request(app)
      .get('/api/scribe/coder/export?start=2026-03-01&end=2026-04-30&format=xlsx')
      .set('Cookie', coderCookie);

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('spreadsheetml');
    expect(res.body).toBeTruthy(); // binary content
  });

  it('returns 400 without date range', async () => {
    const res = await request(app)
      .get('/api/scribe/coder/export')
      .set('Cookie', coderCookie);
    expect(res.status).toBe(400);
  });

  it('supports csv format', async () => {
    const res = await request(app)
      .get('/api/scribe/coder/export?start=2026-03-01&end=2026-04-30&format=csv')
      .set('Cookie', coderCookie);

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('csv');
  });
});
```

**Step 3: Run to verify failure**

**Step 4: Implement `coderExport.ts`**

Key implementation details:
- Query `coding_sessions` for the date range (coder: own sessions; manager: team sessions)
- Build workbook with `exceljs`:
  - Worksheet name: `Billing Codes {start} to {end}`
  - Header row: Patient Name, MRN, DOS, Rendering Provider, Facility, Note Type, ICD-10 Dx 1–12, CPT Code 1, CPT Modifier, CPT Units, E/M Level, E/M MDM Complexity, Missing Documentation, Confidence, Coder Status
  - One row per session
  - ICD-10 codes spread across Dx 1–12 columns
  - Bold header row, auto-width columns
- Stream workbook to response (no file written to disk)
- Set headers: `Content-Type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`, `Content-Disposition: attachment; filename="coding-export-{date}.xlsx"`
- CSV alternative: same data, `text/csv` content type

**Step 5: Mount in `server.ts`**

```typescript
import coderExportRouter from './routes/coderExport.js';
app.use('/api/scribe/coder/export', scribeAuthMiddleware, coderExportRouter);
```

**Step 6: Run tests, commit**

```bash
git add backend/src/routes/coderExport.ts backend/src/routes/coderExport.test.ts backend/src/server.ts backend/package.json backend/package-lock.json
git commit -m "feat(codeassist): add spreadsheet export route with exceljs"
```

---

## Phase 3: Frontend

### Task 8: Coder Zustand store

**Files:**
- Create: `src/stores/coderStore.ts`
- Test: `src/stores/coderStore.test.ts`

**Step 1: Write test**

Test the store's state management: initial state, setters, reset. Mock `fetch` for async actions (extractCodes, fetchSessions, fetchUsage).

**Step 2: Implement store**

```typescript
import { create } from 'zustand';
import { getBackendUrl } from '../config/appConfig';

export interface CoderSession { /* matches CodingSession from backend */ }
export interface CoderUsage { /* matches CodingUsage from backend */ }

interface CoderState {
  // Extraction
  extracting: boolean;
  extractError: string | null;
  lastResult: { icd10_codes: any[]; cpt_codes: any[]; em_level: any; missing_documentation: string[]; disclaimer: string } | null;

  // Sessions
  sessions: CoderSession[];
  sessionsLoading: boolean;

  // Usage
  usage: CoderUsage | null;

  // Actions
  extractCodes: (noteText: string, noteType?: string) => Promise<void>;
  fetchSessions: (opts?: { limit?: number; offset?: number }) => Promise<void>;
  fetchUsage: () => Promise<void>;
  saveSession: (session: { patientName: string; mrn?: string; dateOfService: string; providerName: string; facility?: string; noteType: string }) => Promise<void>;
  reset: () => void;
}
```

**Step 3: Run tests, commit**

```bash
git add src/stores/coderStore.ts src/stores/coderStore.test.ts
git commit -m "feat(codeassist): add coder Zustand store"
```

---

### Task 9: Role-based routing in `App.tsx`

**Files:**
- Modify: `src/App.tsx`
- Create: `src/components/coder/CoderLayout.tsx` (shell layout for coder pages)
- Create: `src/components/coder/CoderAuthGuard.tsx` (role check wrapper)

**Step 1: Create `CoderAuthGuard`**

Reads `user.user_role` from `scribeAuthStore`. If role is `billing_coder` or `coding_manager`, render children. Otherwise redirect to `/scribe/dashboard`.

**Step 2: Create `CoderLayout`**

Simple layout shell with sidebar nav: Dashboard, Team (manager only). Uses same design tokens as scribe layout.

**Step 3: Add coder routes to `App.tsx`**

```tsx
<Route path="/coder/*" element={<CoderAuthGuard><CoderLayout /></CoderAuthGuard>}>
  <Route path="dashboard" element={<CoderDashboard />} />
  <Route path="session/:id" element={<CoderSessionDetail />} />
  <Route path="team" element={<CoderTeamManagement />} />
  <Route index element={<Navigate to="/coder/dashboard" replace />} />
</Route>
```

**Step 4: Update login redirect logic**

After login, check `user.user_role`:
- `clinician` → `/scribe/dashboard`
- `billing_coder` or `coding_manager` → `/coder/dashboard`

**Step 5: Run frontend tests, commit**

```bash
git add src/App.tsx src/components/coder/
git commit -m "feat(codeassist): add coder routes, layout, and auth guard"
```

---

### Task 10: CoderDashboard page (main paste + code UI)

**Files:**
- Create: `src/components/coder/CoderDashboard.tsx`
- Create: `src/components/coder/NoteInputPanel.tsx`
- Create: `src/components/coder/CoderResultsPanel.tsx`
- Create: `src/components/coder/WeeklyBatchTable.tsx`
- Test: `src/components/coder/CoderDashboard.test.tsx`

**Step 1: Write test**

Test rendering of the dashboard: empty state, form submission triggers `extractCodes`, results display after extraction, session list rendering.

**Step 2: Build `NoteInputPanel`**

- Patient header form: name (required), MRN, DOS (date picker, default today), provider name (required), note type dropdown, facility
- Large textarea for pasted note
- "Generate Codes" button (disabled while extracting)
- Loading spinner during extraction

**Step 3: Build `CoderResultsPanel`**

- Reuse `BillingCodesPanel` pattern: ICD-10 section, CPT section, E/M level, missing docs
- Add audit trail column: each code has expandable "Supporting Evidence" showing the excerpt
- "Save & Mark Reviewed" / "Flag" / "Save as Coded" buttons
- "Copy All Codes" button
- Disclaimer banner

**Step 4: Build `WeeklyBatchTable`**

- Table: Patient Name | DOS | Provider | Note Type | ICD-10 Codes (count) | CPT Codes (count) | E/M | Status
- Grouped by batch_week
- Checkbox column for batch export selection
- "Export This Week" and "Export Date Range" buttons
- Download triggers `GET /api/scribe/coder/export` and opens browser download

**Step 5: Assemble `CoderDashboard`**

Two-panel layout:
- Left/top: `NoteInputPanel` (collapses after extraction) → `CoderResultsPanel` (shows after extraction)
- Bottom: `WeeklyBatchTable` (always visible, shows recent sessions)

**Step 6: Run tests, commit**

```bash
git add src/components/coder/
git commit -m "feat(codeassist): add CoderDashboard with paste, code extraction, and batch table"
```

---

### Task 11: CoderSessionDetail page

**Files:**
- Create: `src/components/coder/CoderSessionDetail.tsx`
- Test: `src/components/coder/CoderSessionDetail.test.tsx`

Read-only view of a saved session: patient header, all codes with supporting excerpts, status badge, "Change Status" dropdown, "Delete" button.

**Step 1: Write test, Step 2: Implement, Step 3: Run tests, commit**

```bash
git add src/components/coder/CoderSessionDetail.tsx src/components/coder/CoderSessionDetail.test.tsx
git commit -m "feat(codeassist): add CoderSessionDetail page"
```

---

### Task 12: CoderTeamManagement page (manager only)

**Files:**
- Create: `src/components/coder/CoderTeamManagement.tsx`
- Create: `src/components/coder/InviteCoderModal.tsx`
- Create: `src/components/coder/TeamUsageBar.tsx`
- Test: `src/components/coder/CoderTeamManagement.test.tsx`

**Step 1: Write test**

Test: renders team name, member list, usage bar, invite modal opens/closes, deactivate button works.

**Step 2: Build components**

- `TeamUsageBar` — progress bar: "342 / 500 notes this month", overage indicator, cost projection
- `InviteCoderModal` — email input, "Send Invite" button, success/error states
- `CoderTeamManagement` — team name, member table (name, email, role, status, actions), usage bar, invite button, usage history chart (simple bar chart or table)

**Step 3: Run tests, commit**

```bash
git add src/components/coder/CoderTeamManagement.tsx src/components/coder/InviteCoderModal.tsx src/components/coder/TeamUsageBar.tsx src/components/coder/CoderTeamManagement.test.tsx
git commit -m "feat(codeassist): add team management page with invite and usage"
```

---

## Phase 4: Integration & Polish

### Task 13: End-to-end integration test

**Files:**
- Test: `backend/src/routes/coderIntegration.test.ts`

Full flow test:
1. Create manager → create team → invite coder → coder accepts
2. Coder extracts codes (mock AI) → saves session
3. Coder extracts more codes → saves session
4. Export xlsx → verify binary response
5. Verify usage incremented
6. Manager can see team sessions

**Step 1: Write and run integration test, commit**

```bash
git add backend/src/routes/coderIntegration.test.ts
git commit -m "test(codeassist): add end-to-end integration test"
```

---

### Task 14: Rate limiting

**Files:**
- Modify: `backend/src/server.ts` or `backend/src/routes/coderAi.ts`

Add `express-rate-limit` to coder routes:
- `extract-codes`: 10 req/min per user
- `export`: 5 req/min per user

Follow existing rate limit patterns in `server.ts`.

**Step 1: Add limiters, Step 2: Test manually, Step 3: Commit**

```bash
git add backend/src/routes/coderAi.ts backend/src/routes/coderExport.ts
git commit -m "feat(codeassist): add rate limiting to coder routes"
```

---

### Task 15: Run full test suite and fix any issues

**Step 1: Run backend tests**

Run: `cd backend && node --experimental-vm-modules node_modules/.bin/jest --no-coverage`

**Step 2: Run frontend tests**

Run: `npx vitest run src/`

**Step 3: Run type checks**

Run: `npx tsc --noEmit` (frontend) and `cd backend && npx tsc --noEmit` (backend)

**Step 4: Fix any failures**

**Step 5: Final commit**

```bash
git commit -m "chore(codeassist): fix lint and type issues from full suite run"
```

---

## Summary

| Phase | Tasks | What it delivers |
|---|---|---|
| **1: Database** | Tasks 1–3 | Schema, models, migrations for teams, sessions, usage |
| **2: Backend** | Tasks 4–7 | AI extraction, team CRUD, session CRUD, xlsx export |
| **3: Frontend** | Tasks 8–12 | Store, routing, dashboard, session detail, team management |
| **4: Integration** | Tasks 13–15 | E2E tests, rate limiting, full suite green |

Estimated effort: ~3–4 days for an engineer familiar with the codebase.
