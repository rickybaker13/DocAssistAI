# Testing Guide for DocAssistAI

This guide covers all testing approaches for DocAssistAI, from local development to production validation.

## Quick Start Testing

### Option 1: Local Testing with Mock Data (Fastest)

1. **Set up environment:**
   ```bash
   cp .env.example .env.local
   ```

2. **Enable mock data mode:**
   ```env
   VITE_USE_MOCK_DATA=true
   VITE_OPENROUTER_API_KEY=your_key_here  # For AI chat testing
   ```

3. **Start dev server:**
   ```bash
   npm install  # First time only
   npm run dev
   ```

4. **Open browser:**
   - Navigate to `http://localhost:8080`
   - App loads with mock patient data
   - Test UI, components, and AI chat

**✅ Use this for:** Rapid UI development, component testing, styling

### Option 2: Oracle Health Sandbox Testing (Required for Integration)

1. **Register app in Oracle Health Code Console:**
   - Get Client ID and Application ID
   - Set Launch URL: `http://localhost:8080`
   - Set Redirect URI: `http://localhost:8080/redirect`

2. **Configure `.env.local`:**
   ```env
   VITE_USE_MOCK_DATA=false
   VITE_CLIENT_ID=your_client_id
   VITE_APP_ID=your_application_id
   VITE_REDIRECT_URI=http://localhost:8080/redirect
   ```

3. **Start dev server:**
   ```bash
   npm run dev
   ```

4. **Launch from EHR:**
   - Log into Oracle Health sandbox
   - Open patient chart
   - Launch DocAssistAI from EHR
   - App loads embedded with patient context

**✅ Use this for:** Full integration testing, SMART authentication, real FHIR data

## Testing Workflow

### Daily Development Cycle

```
┌─────────────────────────────────────────┐
│ 1. Code Changes                         │
└──────────────┬──────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────┐
│ 2. Local Testing (Mock Data)           │
│    - npm run dev                        │
│    - Test UI/components                 │
│    - Iterate quickly                   │
└──────────────┬──────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────┐
│ 3. Sandbox Testing (When Ready)        │
│    - Launch from EHR                   │
│    - Test integration                   │
│    - Verify with real data             │
└─────────────────────────────────────────┘
```

## Testing Scenarios

### UI Component Testing

**With Mock Data:**
```bash
# Enable mock data
VITE_USE_MOCK_DATA=true npm run dev
```

Test:
- Patient info display
- Conditions list
- Medications list
- Allergies display
- Lab results
- Chat interface layout

### Integration Testing

**In Sandbox:**
1. Launch from EHR
2. Verify SMART authentication
3. Check patient data loads
4. Test AI chat with patient context
5. Verify all FHIR resources display

### Error Scenario Testing

**Test Cases:**
- Network failures
- Missing patient data
- Invalid API responses
- Authentication failures
- AI service errors

**How to Test:**
- Use browser DevTools to simulate network failures
- Test with patients that have missing data
- Temporarily use invalid API keys

## Mock Data Details

The mock data includes:

**Patient:**
- Name: John Michael Doe
- DOB: 1985-06-15
- Gender: Male
- MRN: MRN-123456

**Conditions:**
- Type 2 Diabetes Mellitus (Active)
- Hypertension (Active)

**Medications:**
- Metformin 500mg (twice daily)
- Amlodipine 5mg (once daily)

**Allergies:**
- Penicillin (High severity, Rash reaction)

**Labs:**
- Blood Glucose: 145 mg/dL (High)
- Hemoglobin: 14.2 g/dL
- Total Cholesterol: 195 mg/dL

**Vitals:**
- Blood Pressure: 132/85 mmHg
- Heart Rate: 72 bpm
- Temperature: 98.6°F

## Browser Testing

Test in multiple browsers:
- ✅ Chrome/Edge (Chromium)
- ✅ Safari (macOS/iOS)
- ✅ Firefox

**Mobile Testing:**
- Open `http://localhost:8080` on iPhone Safari
- Test responsive design
- Test touch interactions

## Debugging Tips

### Browser DevTools

**Console:**
- Check for errors
- View logs: `console.log('[MOCK]', ...)`
- Monitor AI API calls

**Network Tab:**
- Monitor FHIR API calls
- Check AI service requests
- Verify authentication flow

**React DevTools:**
- Inspect component state
- Check Zustand stores
- Debug state updates

### Common Issues

**Mock data not loading:**
- Verify `VITE_USE_MOCK_DATA=true` in `.env.local`
- Check browser console for errors
- Ensure dev server is running

**SMART launch fails:**
- Verify Client ID is correct
- Check Redirect URI matches Code Console
- Ensure launching from EHR (not direct URL)

**AI chat not working:**
- Verify API key is set
- Check API quota/limits
- Review console for API errors

## Production Testing Checklist

Before deploying to production:

- [ ] Production build succeeds: `npm run build`
- [ ] Preview production build: `npm run preview`
- [ ] Update Oracle Health Code Console with production URL
- [ ] Test launch from production EHR
- [ ] Verify all features work in production
- [ ] Test with multiple patient records
- [ ] Verify error handling
- [ ] Check performance and load times

## Best Practices

1. **Use mock data for rapid UI development**
2. **Test in sandbox frequently** (at least daily)
3. **Test with multiple patient records**
4. **Test error scenarios**
5. **Use browser DevTools for debugging**
6. **Test in embedded context** (iframe constraints)
7. **Verify responsive design**
8. **Test AI responses with patient context**

## Testing Commands Reference

```bash
# Development
npm run dev              # Start dev server
npm run build            # Build for production
npm run preview          # Preview production build
npm run lint             # Run linter

# Environment
cp .env.example .env.local    # Create env file
# Edit .env.local with your credentials
```

## Next Steps

After testing locally:
1. Test in Oracle Health sandbox
2. Verify all features work
3. Test with different patient records
4. Prepare for production deployment

For detailed information, see the main [README.md](./README.md).

