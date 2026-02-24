# DocAssistAI

A FHIR SMART on FHIR application for Oracle Health/Cerner that helps front-line clinicians quickly digest patient data through an AI-powered chatbot interface and automated document generation.

## Quick Start

### Prerequisites
- **Node.js 18+** - Download from https://nodejs.org/
- **Oracle Health Code Console account** (for sandbox testing)
- **AI API Key** (OpenRouter or OpenAI) - for backend AI service

### Setup Steps

1. **Install Frontend Dependencies**
   ```bash
   npm install
   ```

2. **Install Backend Dependencies**
   ```bash
   cd backend
   npm install
   cd ..
   ```

3. **Configure Environment Variables**
   - Frontend: Copy `.env.example` to `.env.local`
   - Backend: Copy `backend/.env.example` to `backend/.env`
   - Add your API keys and Oracle Health credentials

4. **Start Backend Server** (Terminal 1)
   ```bash
   cd backend
   npm run dev
   # Backend runs on http://localhost:3000
   ```

5. **Start Frontend Server** (Terminal 2)
   ```bash
   npm run dev
   # Frontend runs on http://localhost:8080
   ```

6. **Test the Application**
   - Open `http://localhost:8080` in browser
   - With mock data: App loads automatically
   - With Oracle Health: Launch from EHR sandbox

### Architecture

DocAssistAI uses a **backend-frontend architecture** for HIPAA compliance:

- **Frontend**: React app (UI, FHIR data fetching, user interface)
- **Backend**: Express API (AI operations, audit logging, PHI protection)

This architecture ensures:
- ✅ PHI protection and HIPAA compliance
- ✅ Flexible AI provider support (external or self-hosted)
- ✅ Comprehensive audit logging
- ✅ Secure API key management

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

## Documentation

- **[Testing Guide](docs/TESTING.md)** - Comprehensive testing instructions
- **[Backend Documentation](backend/README.md)** - Backend setup and API docs
- **[Architecture Guide](ARCHITECTURE.md)** - System architecture overview
- **[Setup Guide](SETUP.md)** - Detailed setup instructions
- **[Full Documentation](docs/README.md)** - Complete project documentation

## Key Features

- ✅ SMART on FHIR authentication
- ✅ Patient data fetching and display
- ✅ AI-powered chat interface
- ✅ HIPAA-compliant backend architecture
- ✅ Flexible AI provider support
- ✅ Comprehensive audit logging
- ✅ Mock data for local development
- ✅ **Scribe** — AI-powered clinical note authoring with templates, verbosity control, and smart suggestion resolution

## Next Steps

1. Install Node.js (if not already installed)
2. Follow setup steps above
3. Configure your AI provider in backend `.env`
4. Start both servers and test!

For detailed information, see the documentation links above.
