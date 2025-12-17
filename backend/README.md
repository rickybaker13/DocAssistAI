# DocAssistAI Backend

HIPAA-compliant backend service for AI operations in DocAssistAI.

## Overview

The backend service provides:
- **Flexible AI Provider Support**: External APIs (OpenAI/OpenRouter) or self-hosted LLMs (Ollama/vLLM)
- **HIPAA Compliance**: Audit logging, PHI protection, secure handling
- **Configurable Architecture**: Easy switching between providers via environment variables
- **Production Ready**: Security middleware, rate limiting, error handling

## Architecture

```
Frontend (React)
    ↓ HTTP/HTTPS
Backend API (Express)
    ↓
AI Service Layer
    ├── External Providers (OpenAI/OpenRouter)
    └── Self-Hosted Providers (Ollama/vLLM)
```

## Quick Start

### 1. Install Dependencies

```bash
cd backend
npm install
```

### 2. Configure Environment

```bash
cp .env.example .env
# Edit .env with your configuration
```

### 3. Start Development Server

```bash
npm run dev
```

Server runs on `http://localhost:3000`

## Configuration

### External AI Provider (Default)

```env
AI_PROVIDER=external
EXTERNAL_AI_TYPE=openrouter
OPENROUTER_API_KEY=your_key_here
OPENROUTER_MODEL=openai/gpt-4-turbo-preview
```

### Self-Hosted LLM (Ollama)

```env
AI_PROVIDER=self-hosted
SELF_HOSTED_LLM_TYPE=ollama
SELF_HOSTED_LLM_URL=http://localhost:11434
SELF_HOSTED_LLM_MODEL=llama2
```

### HIPAA Compliance Settings

```env
ENABLE_AUDIT_LOGGING=true
AUDIT_LOG_PATH=./logs/audit.log
ENABLE_PHI_REDACTION=false  # Set true to redact PHI before sending to AI
```

## API Endpoints

### POST /api/ai/chat

Chat completion endpoint.

**Request:**
```json
{
  "messages": [
    { "role": "user", "content": "What are the patient's active conditions?" }
  ],
  "patientContext": "Patient: John Doe, DOB: 1985-06-15...",
  "options": {
    "temperature": 0.7,
    "maxTokens": 500
  }
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "content": "The patient has...",
    "model": "gpt-4",
    "provider": "openrouter"
  }
}
```

### POST /api/ai/generate-document

Document generation endpoint.

**Request:**
```json
{
  "template": "SOAP Note Template...",
  "patientData": "Patient information...",
  "additionalContext": "Optional context"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "content": "Generated document..."
  }
}
```

### GET /api/ai/health

Health check endpoint.

**Response:**
```json
{
  "success": true,
  "data": {
    "provider": "openrouter",
    "available": true
  }
}
```

## HIPAA Compliance Features

### Audit Logging

All API requests are automatically logged with:
- Timestamp
- User ID (from SMART context)
- Patient ID (from SMART context)
- Action performed
- Success/failure status
- Error details (if any)

Logs are stored in `./logs/audit.log` (configurable).

### PHI Protection

- **Context Extraction**: Automatically extracts user/patient context from requests
- **PHI Redaction**: Optional redaction of PHI before sending to AI (configurable)
- **Secure Headers**: CORS, Helmet security headers
- **Rate Limiting**: Prevents abuse

### Security Features

- **Helmet**: Security headers
- **CORS**: Configured for frontend origin
- **Rate Limiting**: 100 requests per 15 minutes (configurable)
- **Request Validation**: Input validation on all endpoints

## Development

### Scripts

```bash
npm run dev      # Start development server with hot reload
npm run build    # Build for production
npm run start    # Start production server
npm run lint     # Run linter
```

### Testing with Self-Hosted LLM (Ollama)

1. **Install Ollama:**
   ```bash
   # macOS
   brew install ollama
   # Or download from https://ollama.ai
   ```

2. **Start Ollama:**
   ```bash
   ollama serve
   ```

3. **Pull a model:**
   ```bash
   ollama pull llama2
   ```

4. **Configure backend:**
   ```env
   AI_PROVIDER=self-hosted
   SELF_HOSTED_LLM_TYPE=ollama
   SELF_HOSTED_LLM_URL=http://localhost:11434
   SELF_HOSTED_LLM_MODEL=llama2
   ```

5. **Start backend:**
   ```bash
   npm run dev
   ```

## Production Deployment

### Environment Variables

Set production environment variables:
- `NODE_ENV=production`
- `PORT=3000` (or your port)
- `FRONTEND_URL=https://your-frontend-url.com`
- Configure AI provider settings
- Set HIPAA compliance settings

### Building

```bash
npm run build
npm start
```

### Docker (Optional)

```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
RUN npm run build
EXPOSE 3000
CMD ["npm", "start"]
```

## Provider Support

### External Providers
- ✅ OpenAI (GPT-4, GPT-3.5)
- ✅ OpenRouter (Multiple models)

### Self-Hosted Providers
- ✅ Ollama (Local LLM)
- ✅ vLLM (OpenAI-compatible API)
- ✅ Custom (OpenAI-compatible endpoints)

## Troubleshooting

**Backend won't start:**
- Check Node.js version: `node --version` (need v18+)
- Verify `.env` file exists and is configured
- Check port 3000 is available

**AI provider errors:**
- Verify API keys are set correctly
- Check provider is available (for self-hosted)
- Review logs for detailed error messages

**CORS errors:**
- Verify `FRONTEND_URL` matches your frontend URL
- Check CORS configuration in `server.ts`

## Architecture Decisions

### Why Backend?

- **HIPAA Compliance**: Centralized PHI handling and audit logging
- **Security**: API keys never exposed to frontend
- **Flexibility**: Easy to switch between AI providers
- **Scalability**: Can add caching, queuing, etc.

### Provider Abstraction

All providers implement the same interface, making it easy to:
- Switch providers via configuration
- Add new providers
- Test with different providers
- Support multiple customers with different preferences

## Next Steps

1. Configure your AI provider in `.env`
2. Start the backend server
3. Update frontend to use backend API (already done)
4. Test with mock data or Oracle Health sandbox

For frontend setup, see the main [README.md](../README.md).

