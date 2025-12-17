# DocAssistAI

A FHIR SMART on FHIR application for Oracle Health/Cerner that helps front-line clinicians quickly digest patient data through an AI-powered chatbot interface and automated document generation.

## Quick Start

1. **Install Node.js** (if not already installed)
   - Download from https://nodejs.org/ (version 18 or higher)

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   - Copy `.env.local.example` to `.env.local`
   - Fill in your API keys and Oracle Health credentials

4. **Run development server**
   ```bash
   npm run dev
   ```

5. **Launch from Oracle Health Sandbox**
   - Access the Oracle Health sandbox launcher
   - Launch DocAssistAI
   - The app will authenticate via SMART and receive patient context

## Quick Testing

**Local Development (Mock Data):**
```bash
# Set VITE_USE_MOCK_DATA=true in .env.local
npm run dev
# Open http://localhost:8080
```

**Sandbox Testing (Full Integration):**
- Launch from Oracle Health EHR sandbox
- App loads with real patient data

For detailed testing guide, see [docs/TESTING.md](./docs/TESTING.md)  
For full documentation, see [docs/README.md](./docs/README.md)

