---
name: check
description: >-
  Use when the user asks to "check", "run checks", "validate", "run tests",
  "type check", "lint", "make sure everything passes", "CI check",
  "pre-commit check", or "is everything green". Runs the full validation
  suite across frontend and backend: type-check, lint, and tests.
version: 0.1.0
---

# Full-Stack Validation Check

Run type-check, lint, and tests across both frontend and backend. Reports a unified pass/fail summary.

## Workflow

Run all 5 checks. Run independent checks in parallel where possible, then report results.

### Checks to Run

**1. Frontend type-check:**
```bash
cd /Users/bitbox/Documents/DocAssistAI && npx tsc --noEmit
```

**2. Frontend lint:**
```bash
cd /Users/bitbox/Documents/DocAssistAI && npm run lint
```

**3. Backend build (type-check):**
```bash
cd /Users/bitbox/Documents/DocAssistAI/backend && npx tsc --noEmit
```

**4. Backend lint:**
```bash
cd /Users/bitbox/Documents/DocAssistAI/backend && npm run lint
```

**5. Backend tests (scribe suite):**
```bash
cd /Users/bitbox/Documents/DocAssistAI/backend && node --experimental-vm-modules node_modules/.bin/jest --testPathPatterns="scribe" --no-coverage
```

**6. Frontend tests:**
```bash
cd /Users/bitbox/Documents/DocAssistAI && npx vitest run src/
```

### Execution Strategy

- Run checks 1-4 (type-checks and lints) in parallel — they are independent and fast.
- Run checks 5-6 (tests) in parallel after type-checks pass — tests are slower and less useful if types are broken.
- If a type-check or lint fails, still run the remaining checks to give a full picture — don't stop early.

### Reporting

After all checks complete, output a summary table:

```
── Check Results ──────────────────────────────
  Frontend type-check   ✅ passed
  Frontend lint         ✅ passed
  Backend type-check    ✅ passed
  Backend lint          ✅ passed
  Backend tests         ✅ passed  (X tests, Ys)
  Frontend tests        ✅ passed  (X tests, Ys)
───────────────────────────────────────────────
  Result: ALL PASSED ✅
```

Or if something fails:

```
── Check Results ──────────────────────────────
  Frontend type-check   ✅ passed
  Frontend lint         ❌ FAILED
  Backend type-check    ✅ passed
  Backend lint          ✅ passed
  Backend tests         ✅ passed  (12 tests, 4s)
  Frontend tests        ❌ FAILED
───────────────────────────────────────────────
  Result: 2 FAILED ❌

  Failures:
  1. Frontend lint — 3 warnings (max-warnings 0)
  2. Frontend tests — ScribeEditor.test.tsx: expected 200, got 401
```

### On Failure

When a check fails:
- Show the specific error output (not the entire log — just the relevant lines)
- For lint failures: show the file, line, and rule that triggered
- For type-check failures: show the file, line, and TS error code
- For test failures: show the failing test name and assertion
- Ask the user if they want to fix the issues

### Gotchas

- **Backend tests require ESM mode:** The `--experimental-vm-modules` flag is non-negotiable. Without it, Jest mocking doesn't work and tests throw `ReferenceError: jest is not defined`.
- **`ANTHROPIC_API_KEY=` blocks dotenv:** If running in Claude Code bash, the empty `ANTHROPIC_API_KEY` env var prevents dotenv from loading. Backend tests set `NODE_ENV=test` which bypasses this, but be aware if tests fail with API key errors.
- **Frontend lint has `--max-warnings 0`:** Any warning is a failure. This is intentional — don't change it.
- **Backend lint uses `--ext ts`** (not `ts,tsx`) since backend has no JSX.
