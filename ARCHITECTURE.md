# DocAssistAI Architecture

## Overview

DocAssistAI is built with a **backend-frontend architecture** designed for HIPAA compliance and flexibility.

## System Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    User's Browser                       │
│  ┌──────────────────────────────────────────────────┐  │
│  │         Frontend (React + TypeScript)            │  │
│  │  - Patient Dashboard                             │  │
│  │  - Chat Interface                                │  │
│  │  - FHIR Data Fetching                            │  │
│  └──────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────┘
                    │                    │
                    │                    │
        ┌───────────┘                    └───────────┐
        │                                           │
        ▼                                           ▼
┌───────────────────┐                    ┌──────────────────┐
│  Oracle Health    │                    │  Backend API     │
│  EHR Server       │                    │  (Express)       │
│  - FHIR API       │                    │  - AI Service    │
│  - SMART Auth     │                    │  - Audit Logging │
└───────────────────┘                    │  - PHI Protection│
                                         └──────────────────┘
                                                    │
                                                    ▼
                                         ┌──────────────────┐
                                         │  AI Providers    │
                                         │  - OpenAI        │
                                         │  - OpenRouter    │
                                         │  - Self-Hosted   │
                                         └──────────────────┘
```

## Components

### Frontend (`/src`)

**Purpose**: User interface and FHIR data interaction

**Technologies**:
- React 18 + TypeScript
- Vite (build tool)
- Zustand (state management)
- fhirclient (FHIR/SMART integration)
- Tailwind CSS (styling)

**Key Features**:
- SMART on FHIR authentication
- Patient data fetching and display
- Chat interface (calls backend API)
- Responsive UI

**No PHI Storage**: All data fetched on-demand, not stored locally

### Backend (`/backend`)

**Purpose**: AI operations and HIPAA compliance

**Technologies**:
- Express.js (Node.js)
- TypeScript
- Winston (audit logging)

**Key Features**:
- **Flexible AI Providers**: External (OpenAI/OpenRouter) or self-hosted (Ollama/vLLM)
- **HIPAA Compliance**: Audit logging, PHI protection
- **Security**: Rate limiting, CORS, Helmet
- **Provider Abstraction**: Easy switching via configuration

**HIPAA Features**:
- Automatic audit logging of all PHI access
- Optional PHI redaction before sending to AI
- Context extraction from SMART tokens
- Secure API key management

## Data Flow

### Patient Data Flow

```
1. User launches app from EHR
   ↓
2. SMART authentication (OAuth 2.0)
   ↓
3. Frontend receives patient context
   ↓
4. Frontend fetches FHIR data directly from EHR
   ↓
5. Data displayed in UI (not stored)
```

### AI Chat Flow

```
1. User asks question in chat
   ↓
2. Frontend sends request to Backend API
   ↓
3. Backend extracts user/patient context
   ↓
4. Backend logs audit event (HIPAA)
   ↓
5. Backend calls AI provider (external or self-hosted)
   ↓
6. Backend returns response to Frontend
   ↓
7. Frontend displays response
```

## Security & Compliance

### HIPAA Compliance Features

1. **Audit Logging**
   - All PHI access logged automatically
   - Includes: user ID, patient ID, action, timestamp
   - Stored in secure log files

2. **PHI Protection**
   - No PHI stored in frontend
   - Optional redaction before AI calls
   - Secure context extraction

3. **Authentication**
   - SMART on FHIR OAuth 2.0
   - Token-based authentication
   - No credentials stored locally

4. **Network Security**
   - HTTPS in production
   - CORS protection
   - Rate limiting
   - Security headers (Helmet)

### PHI Handling

- **Frontend**: Fetches PHI on-demand, displays only, never stores
- **Backend**: Receives PHI in requests, can redact before AI calls
- **AI Providers**: May receive PHI (with BAA) or redacted data
- **Audit Logs**: Log PHI access but don't store full PHI

## AI Provider Architecture

### Provider Abstraction

All AI providers implement the same interface:

```typescript
interface AIProvider {
  chat(messages: AIMessage[]): Promise<AIResponse>;
  getName(): string;
  isAvailable(): Promise<boolean>;
}
```

### Supported Providers

**External**:
- OpenAI (GPT-4, GPT-3.5)
- OpenRouter (Multiple models)

**Self-Hosted**:
- Ollama (Local LLM)
- vLLM (OpenAI-compatible)
- Custom (Any OpenAI-compatible endpoint)

### Configuration

Switching providers is done via environment variables:

```env
# External API
AI_PROVIDER=external
EXTERNAL_AI_TYPE=openrouter

# Self-Hosted
AI_PROVIDER=self-hosted
SELF_HOSTED_LLM_TYPE=ollama
```

## Deployment Architecture

### Development

```
Frontend: localhost:8080
Backend:  localhost:3000
EHR:      Oracle Health Sandbox
```

### Production

```
Frontend: Hospital web server or CDN
Backend:  Hospital secure server
EHR:      Production Oracle Health EHR
AI:       Configured provider (external or self-hosted)
```

## Key Design Decisions

### Why Backend for AI?

1. **HIPAA Compliance**: Centralized PHI handling and audit logging
2. **Security**: API keys never exposed to frontend
3. **Flexibility**: Easy to switch AI providers
4. **Scalability**: Can add caching, queuing, load balancing

### Why Direct FHIR Access from Frontend?

1. **SMART on FHIR**: Designed for direct client access
2. **Efficiency**: No unnecessary backend hop
3. **Standard**: Follows SMART on FHIR best practices
4. **Security**: OAuth tokens handled securely by fhirclient

### Why Provider Abstraction?

1. **Customer Flexibility**: Different customers prefer different providers
2. **Cost Control**: Self-hosted for cost-sensitive customers
3. **Compliance**: Self-hosted for maximum HIPAA compliance
4. **Future-Proof**: Easy to add new providers

## Development Workflow

### Local Development

1. Start backend: `cd backend && npm run dev`
2. Start frontend: `npm run dev`
3. Use mock data: `VITE_USE_MOCK_DATA=true`
4. Test UI/UX independently

### Integration Testing

1. Configure backend with AI provider
2. Launch from Oracle Health sandbox
3. Test with real patient data
4. Verify audit logging

### Production Deployment

1. Build frontend: `npm run build`
2. Build backend: `cd backend && npm run build`
3. Deploy to hospital infrastructure
4. Configure environment variables
5. Test end-to-end

## Future Enhancements

- [ ] Backend caching for AI responses
- [ ] Queue system for AI requests
- [ ] Multiple AI provider fallback
- [ ] Advanced PHI redaction
- [ ] Real-time audit log monitoring
- [ ] Backend API for FHIR operations (optional)

## Scribe Module

Scribe is a standalone AI-powered clinical documentation module within DocAssistAI.

**Auth:** JWT-based (`scribeAuth` middleware), separate from SMART on FHIR. Cookies, 7-day expiry.

**Backend routes** (`backend/src/routes/`):
- `scribe.ts` — note CRUD, template management (`/api/scribe/...`)
- `scribeAi.ts` — AI endpoints: focused analysis, ghost-write, resolve-suggestion (`/api/ai/scribe/...`)
- `scribeAuth.ts` — login/logout/me (`/api/scribe/auth/...`)

**Frontend** (`src/components/scribe-standalone/`):
- `ScribeNotePage` — note editor with section management
- `FocusedAIPanel` — per-section AI analysis with clarify/preview overlay flow
- `ScribeChatDrawer` — floating chat with ghost-write insert
- `NoteBuilderPage` — template selection + verbosity preference

**DB** (`backend/data/scribe.db`): SQLite via better-sqlite3. Schema in `backend/src/database/migrations.ts`. New columns added via `COLUMN_MIGRATIONS` array, not `CREATE TABLE IF NOT EXISTS`.

## References

- [SMART on FHIR Specification](http://hl7.org/fhir/smart-app-launch/)
- [FHIR R4 Specification](https://www.hl7.org/fhir/R4/)
- [HIPAA Compliance Guidelines](https://www.hhs.gov/hipaa/index.html)

