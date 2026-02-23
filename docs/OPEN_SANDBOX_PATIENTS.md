# Oracle Health Open Sandbox Test Patients

## Current Patient ID

The app is currently configured to use patient ID: **12742400** (Tim Peters)

To change the patient ID, update `.env.local`:
```env
VITE_OPEN_SANDBOX_PATIENT_ID=12742400
```

## Common Test Patient IDs

Here are some known test patient IDs in the Oracle Health Open Sandbox:

### Patient IDs to Try

1. **12742400** - Tim Peters (current default)
   - May have mixed notes from multiple patients
   - Try this first

2. **4342009** - Common test patient
   - Often used in Oracle Health examples

3. **12724067** - Alternative test patient
   - May have different note types

4. **12742648** - Another test patient
   - May have more complete note sets

5. **12742500** - Additional test patient
   - May have various clinical documents

## How to Switch Patients

### Option 1: Update Environment Variable

Edit `.env.local`:
```env
VITE_OPEN_SANDBOX_PATIENT_ID=4342009
```

Then restart the dev server.

### Option 2: Test Multiple Patients

You can temporarily modify `src/App.tsx` to try different patient IDs:

```typescript
// Try different patient IDs
const patientIds = ['12742400', '4342009', '12724067', '12742648'];
const testPatientId = patientIds[0]; // Change index to try different patients
```

## Finding Patients with Notes

### Method 1: Check Browser Console

When the app loads, check the console for:
```
[Open Sandbox] Found X DocumentReference(s) using 'subject' parameter
```

If you see `Found 0 DocumentReference(s)`, that patient doesn't have notes.

### Method 2: Direct FHIR Query

You can test directly in your browser:

```
https://fhir-open.cerner.com/r4/ec2458f2-1e24-41c8-b71b-0e701af7583d/DocumentReference?subject=Patient/12742400
```

Replace `12742400` with different patient IDs to see which ones have notes.

### Method 3: Query All DocumentReferences

To see all available DocumentReferences (may include multiple patients):

```
https://fhir-open.cerner.com/r4/ec2458f2-1e24-41c8-b71b-0e701af7583d/DocumentReference?_count=100
```

Then check the `subject.reference` field to see which patient each note belongs to.

## Troubleshooting

### No Notes Found

If you see "No DocumentReferences found":

1. **Try a different patient ID** - Some patients may not have notes
2. **Check query format** - The app now tries both `subject=` and `patient=` parameters
3. **Check console logs** - Look for error messages about query failures

### Notes from Wrong Patient

If you see notes that don't match the patient:

1. **Check validation logs** - The app filters out mismatched notes
2. **Check console warnings** - You'll see messages like "belongs to different patient"
3. **The sandbox may have mixed data** - This is a known issue with some test patients

### Query Format Issues

The app now tries both:
- `DocumentReference?subject=Patient/{id}` (FHIR R4 standard)
- `DocumentReference?patient={id}` (legacy format)

Check the console to see which format worked.

## Notes

- The Open Sandbox is read-only and may have inconsistent test data
- Some patients may have notes, others may not
- Notes may be from multiple patients (sandbox data quality issue)
- The app validates patient matches and filters out mismatches

