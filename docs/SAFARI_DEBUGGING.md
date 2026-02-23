# Safari Console Debugging Guide

## How to Open Safari Console on Mac

### Step 1: Enable Developer Menu

1. Open **Safari**
2. Go to **Safari → Settings** (or **Preferences**)
3. Click the **Advanced** tab
4. Check the box: **"Show features for web developers"**
5. Close settings

### Step 2: Open JavaScript Console

**Method 1: Menu**
- **Safari → Develop → Show JavaScript Console**

**Method 2: Keyboard Shortcut**
- Press **Cmd + Option + C**

**Method 3: Right-click**
- Right-click on the page
- Select **"Inspect Element"**
- Click the **"Console"** tab

## What to Look For

### SMART Launch Errors

Look for these log prefixes:
- `[SMART]` - SMART authentication logs
- `[App]` - Application initialization logs
- `[Debug]` - Debug tool logs

### Common Error Patterns

1. **CORS Errors**
   ```
   Access to fetch at '...' from origin '...' has been blocked by CORS policy
   ```
   - Solution: Check if redirect URI matches Code Console exactly

2. **Redirect Errors**
   ```
   Failed to redirect to authorization server
   ```
   - Solution: Check authorization endpoint URL

3. **Configuration Errors**
   ```
   Missing required configuration
   ```
   - Solution: Verify all environment variables are set

4. **Discovery Errors**
   ```
   Failed to discover SMART configuration
   ```
   - Solution: Check FHIR base URL is correct

## Filtering Console Logs

1. Click the **filter icon** (funnel) in console
2. Type `SMART` or `Debug` to filter relevant logs
3. Use **Clear** button to clear old logs before testing

## Network Tab

To see API calls:

1. **Safari → Develop → Show Web Inspector**
2. Click **Network** tab
3. Filter by **XHR** or **Fetch**
4. Look for:
   - `/.well-known/smart-configuration`
   - `/metadata`
   - Authorization endpoint calls

## Tips

- **Keep console open** while testing
- **Clear console** before each test
- **Copy error messages** to share for debugging
- Check **both Console and Network tabs**

## Quick Reference

| Action | Shortcut |
|--------|----------|
| Open Console | Cmd + Option + C |
| Open Inspector | Cmd + Option + I |
| Clear Console | Cmd + K |
| Filter Logs | Type in filter box |

---

**Note**: If you don't see the Develop menu, make sure you've enabled "Show features for web developers" in Safari Settings → Advanced.

