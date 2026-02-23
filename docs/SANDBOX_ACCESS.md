# Oracle Health Sandbox Access Guide

## Understanding Oracle Health Sandbox

Based on the [Oracle Health FHIR R4 API documentation](https://docs.oracle.com/en/industries/health/millennium-platform-apis/mfrap/r4_overview.html), there are two main components:

### 1. **Code Console** (App Registration)
- **URL**: https://code-console.cerner.com/ (or Oracle Health equivalent)
- **Purpose**: Register apps, get Client IDs, configure OAuth
- **Status**: ✅ You already have access (Client ID and App ID configured)

### 2. **Sandbox EHR** (SMART Launch)
- **Purpose**: Test SMART apps with real patient data
- **Access**: Requires sandbox EHR login credentials
- **How to Access**: Usually through Oracle Health Developer Portal or direct sandbox URL

## FHIR API Configuration

Your current configuration matches the Oracle Health documentation:

- **FHIR Base URL**: `https://fhir-ehr-code.cerner.com/r4/ec2458f2-1e24-41c8-b71b-0e701af7583d`
- **Auth Base URL**: `https://authorization.cerner.com`
- **Tenant ID**: `ec2458f2-1e24-41c8-b71b-0e701af7583d` ✅ (matches docs)

## Testing Options

### Option 0: Open Sandbox (No Auth Required) ⭐ **RECOMMENDED FOR DEVELOPMENT**

The **Open Sandbox** allows you to fetch real FHIR data without any authentication:

**Base URL:**
```
https://fhir-open.cerner.com/r4/ec2458f2-1e24-41c8-b71b-0e701af7583d
```

**Features:**
- ✅ No OAuth/login required
- ✅ Real FHIR data from Oracle Health sandbox
- ✅ Read-only access (perfect for development)
- ✅ Works immediately - no credentials needed

**Setup:**

1. **Update `.env.local`:**
   ```env
   VITE_USE_OPEN_SANDBOX=true
   VITE_FHIR_BASE_URL=https://fhir-open.cerner.com/r4/ec2458f2-1e24-41c8-b71b-0e701af7583d
   VITE_OPEN_SANDBOX_PATIENT_ID=12742400
   ```

2. **Test Open Sandbox:**
   ```bash
   node test-open-sandbox.js
   ```

3. **Start your dev server:**
   ```bash
   npm run dev
   ```

4. **Open the app:**
   - Navigate to `http://localhost:8080`
   - App will automatically load real patient data from Open Sandbox
   - No authentication required!

**What You Can Do:**
- ✅ Fetch Patient, Conditions, Observations, Medications, etc.
- ✅ Test your FHIR parsing logic
- ✅ Build and test AI/note generation features
- ✅ Develop UI with real data structures

**Limitations:**
- Read-only (no write operations)
- Limited to test patient data
- No OAuth token (can't test secure sandbox features)

### Option 1: Test Launcher Page (For OAuth Testing)

We've created a test launcher page at `public/smart-launcher.html` that you can use:

1. **Start your dev server:**
   ```bash
   npm run dev
   ```

2. **Open the launcher:**
   ```
   http://localhost:8080/smart-launcher.html
   ```

3. **Test FHIR Connection:**
   - Click "Test FHIR Connection" to verify API access
   - This tests the metadata endpoint (no auth required)

4. **Launch SMART App:**
   - Click "Launch SMART App" to initiate OAuth flow
   - You'll be redirected to Oracle Health authorization
   - After authorization, you'll be redirected back to your app

### Option 2: Direct FHIR API Testing

You can test FHIR API access directly using curl or Postman:

```bash
# Test metadata endpoint (no auth required)
curl -H "Accept: application/fhir+json" \
  https://fhir-ehr-code.cerner.com/r4/ec2458f2-1e24-41c8-b71b-0e701af7583d/metadata

# Test with patient ID (requires OAuth token)
curl -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -H "Accept: application/fhir+json" \
  https://fhir-ehr-code.cerner.com/r4/ec2458f2-1e24-41c8-b71b-0e701af7583d/Patient/12742400
```

### Option 3: Access Sandbox EHR (If Available)

If you have sandbox EHR access:

1. **Log into Oracle Health Sandbox EHR**
   - URL typically: `https://sandbox.cerner.com/` or similar
   - Or through Oracle Health Developer Portal

2. **Navigate to Patient Chart**
   - Select a test patient
   - Open patient chart

3. **Launch DocAssistAI**
   - Look for "Apps" or "SMART Apps" menu
   - Find DocAssistAI in the list
   - Click to launch

4. **App Will:**
   - Authenticate via SMART on FHIR
   - Receive patient context automatically
   - Load with real patient data

## Finding Sandbox EHR Access

If you don't have sandbox EHR access yet:

1. **Check Oracle Health Developer Portal:**
   - Visit: https://developer.cerner.com/ (or Oracle Health equivalent)
   - Look for "Sandbox Access" or "Test Environment"
   - May require separate registration

2. **Contact Oracle Health Support:**
   - Request sandbox EHR access
   - Mention you're developing a SMART on FHIR app
   - Provide your Application ID: `3113c383-0129-49a3-b81f-67420f15d6e4`

3. **Use Test Launcher:**
   - The `smart-launcher.html` page can simulate EHR launch
   - Allows testing OAuth flow without full EHR access

## Current Configuration Status

✅ **Configured:**
- Client ID: `eb36ea98-c4e4-47ae-a002-1357fb97d176`
- Application ID: `3113c383-0129-49a3-b81f-67420f15d6e4`
- FHIR Base URL: `https://fhir-ehr-code.cerner.com/r4/ec2458f2-1e24-41c8-b71b-0e701af7583d`
- Redirect URI: `http://localhost:8080/redirect`
- Mock Data: Disabled (ready for sandbox)

## Next Steps

1. **Test FHIR API Connection:**
   - Use the test launcher page to verify API access
   - Check that metadata endpoint responds

2. **Test SMART Launch:**
   - Use the launcher to initiate OAuth flow
   - Verify redirect URI works correctly

3. **Get Sandbox EHR Access:**
   - Contact Oracle Health for sandbox credentials
   - Or use test launcher for now

4. **Once Sandbox Access Available:**
   - Launch from EHR
   - Test with real patient data
   - Use Discovery tab to explore note types

## Troubleshooting

**FHIR API Not Responding:**
- Verify FHIR base URL is correct
- Check network connectivity
- Verify tenant ID matches documentation

**OAuth Flow Fails:**
- Verify Client ID is correct
- Check Redirect URI matches Code Console exactly
- Ensure scopes are properly formatted

**Can't Find Sandbox EHR:**
- Use test launcher page instead
- Contact Oracle Health support
- Check Oracle Health Developer Portal

## References

- [Oracle Health FHIR R4 API Documentation](https://docs.oracle.com/en/industries/health/millennium-platform-apis/mfrap/r4_overview.html)
- [SMART on FHIR Specification](http://hl7.org/fhir/smart-app-launch/)
- Oracle Health Code Console: https://code-console.cerner.com/

