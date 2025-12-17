# Setup Guide for DocAssistAI

## Step 1: Install Node.js

**Download and Install:**
1. Visit https://nodejs.org/
2. Download the **LTS version** (recommended)
3. Run the installer (.pkg file)
4. Follow the installation prompts
5. **Restart your terminal** after installation

**Verify Installation:**
```bash
node --version  # Should show v18.x.x or higher
npm --version   # Should show 9.x.x or higher
```

## Step 2: Configure Environment Variables

The `.env.local` file has been created. You need to add your API keys:

**For Local Testing (Mock Data Mode):**
```env
VITE_USE_MOCK_DATA=true
VITE_OPENROUTER_API_KEY=your_openrouter_key_here
# OR
VITE_OPENAI_API_KEY=your_openai_key_here
```

**For Sandbox Testing:**
```env
VITE_USE_MOCK_DATA=false
VITE_CLIENT_ID=your_client_id_from_oracle
VITE_APP_ID=your_application_id_from_oracle
VITE_REDIRECT_URI=http://localhost:8080/redirect
VITE_OPENROUTER_API_KEY=your_openrouter_key_here
```

## Step 3: Install Dependencies

```bash
cd /Users/bitbox/Documents/DocAssistAI
npm install
```

## Step 4: Run Development Server

```bash
npm run dev
```

The app will be available at: `http://localhost:8080`

## Step 5: Test the Application

**With Mock Data (Local Testing):**
1. Ensure `VITE_USE_MOCK_DATA=true` in `.env.local`
2. Open `http://localhost:8080` in your browser
3. You should see the app with mock patient data
4. Test the AI chat (requires API key)

**With Oracle Health Sandbox:**
1. Set `VITE_USE_MOCK_DATA=false` in `.env.local`
2. Configure Client ID and App ID
3. Launch from Oracle Health EHR sandbox
4. App loads with real patient data

## Troubleshooting

**Node.js not found:**
- Make sure you restarted your terminal after installing Node.js
- Check installation: `which node`
- Try: `export PATH="/usr/local/bin:$PATH"` (if installed to /usr/local)

**npm install fails:**
- Check Node.js version: `node --version` (need v18+)
- Try: `npm cache clean --force`
- Try: `npm install --legacy-peer-deps`

**App won't start:**
- Check `.env.local` exists
- Verify API keys are set (for AI features)
- Check console for errors: `npm run dev`

## Next Steps

After setup:
1. Test locally with mock data
2. Test in Oracle Health sandbox
3. Start developing features!

For detailed testing guide, see [docs/TESTING.md](./docs/TESTING.md)

