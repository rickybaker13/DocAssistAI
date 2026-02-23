# Quick Patient Switcher Guide

## Quick Test: Switch Patient IDs

### Method 1: Update Environment Variable (Recommended)

1. **Edit `.env.local`** (in project root):
   ```env
   VITE_OPEN_SANDBOX_PATIENT_ID=4342009
   ```

2. **Restart dev server**:
   - Stop current server (Ctrl+C)
   - Run `npm run dev` again

3. **Refresh browser** and check console

### Method 2: Test in Browser Console

Open browser console and run:

```javascript
// Test different patient IDs
const testPatients = ['12742400', '4342009', '12724067', '12742648'];

async function testPatient(patientId) {
  const url = `https://fhir-open.cerner.com/r4/ec2458f2-1e24-41c8-b71b-0e701af7583d/DocumentReference?subject=Patient/${patientId}&_count=10`;
  try {
    const response = await fetch(url);
    const data = await response.json();
    const count = data.entry?.length || 0;
    console.log(`Patient ${patientId}: ${count} notes found`);
    return { patientId, count, hasNotes: count > 0 };
  } catch (err) {
    console.error(`Patient ${patientId}: Error`, err);
    return { patientId, count: 0, hasNotes: false };
  }
}

// Test all patients
Promise.all(testPatients.map(testPatient)).then(results => {
  console.table(results);
  const withNotes = results.filter(r => r.hasNotes);
  console.log(`\nPatients with notes: ${withNotes.map(r => r.patientId).join(', ')}`);
});
```

### Method 3: Direct URL Test

Open these URLs in your browser to see raw FHIR data:

- Patient 12742400: https://fhir-open.cerner.com/r4/ec2458f2-1e24-41c8-b71b-0e701af7583d/DocumentReference?subject=Patient/12742400&_count=10
- Patient 4342009: https://fhir-open.cerner.com/r4/ec2458f2-1e24-41c8-b71b-0e701af7583d/DocumentReference?subject=Patient/4342009&_count=10
- Patient 12724067: https://fhir-open.cerner.com/r4/ec2458f2-1e24-41c8-b71b-0e701af7583d/DocumentReference?subject=Patient/12724067&_count=10

Look for `"total"` in the response - if it's 0, that patient has no notes.

## What to Look For

### In Browser Console

When app loads, you should see:
```
[Open Sandbox] Trying DocumentReference query with subject=Patient/12742400
[Open Sandbox] Found X DocumentReference(s) using 'subject' parameter
```

If you see:
```
[Open Sandbox] No DocumentReferences found for patient 12742400
```

That patient doesn't have notes - try a different ID.

### In Network Tab

1. Open DevTools → Network tab
2. Filter by "DocumentReference"
3. Look at the response
4. Check if `entry` array has items

## Current Status

The app now:
- ✅ Tries both `subject=` and `patient=` query formats
- ✅ Validates patient matches
- ✅ Logs detailed information about queries
- ✅ Filters out notes from wrong patients

If no notes are found, it's likely:
1. The patient ID doesn't have notes in the sandbox
2. Oracle Health sandbox data is incomplete for that patient
3. The query format needs adjustment (but we're trying both now)

Try switching to a different patient ID using Method 1 above!

