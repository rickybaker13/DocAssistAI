# Backend Logging Guide

## How to View Backend Logs

### Option 1: Cursor Integrated Terminal
1. Open Cursor's integrated terminal (View → Terminal or `` Ctrl+` ``)
2. Look for the terminal tab running the backend
3. You should see logs like:
   ```
   [Backend] Server running on http://localhost:3000
   [RAG] Patient data indexed successfully
   ```

### Option 2: Separate Terminal Window
1. Open a new terminal window/tab
2. Navigate to the backend directory:
   ```bash
   cd /Users/bitbox/Documents/DocAssistAI/backend
   ```
3. Check if backend is running:
   ```bash
   lsof -i :3000
   ```
4. If running, you'll see the process. Logs are output to that terminal.

### Option 3: Check Running Processes
```bash
# Find backend process
ps aux | grep "node.*backend\|npm.*dev" | grep -v grep

# Or check what's listening on port 3000
lsof -i :3000
```

## Understanding the Logs

### When You Send a Chat Message

You'll see logs in this order:

#### 1. Initial Request
```
[Chat Request] Initial patient context: 2.5k tokens
```
Shows the size of the full patient context sent from frontend.

#### 2. RAG Processing (if enabled)
```
[RAG] Query: "What are the patient's lab results?"
[RAG] Context Size Comparison:
  Full context: 2.5k tokens
  RAG context: 450 tokens
  Reduction: 82.0%
  Retrieved 5 documents

[RAG] Retrieved Documents:
  [1] lab: 120 tokens
      Preview: "Lab Result: Hemoglobin, Value: 12.5 g/dL, Date: 2024-01-15..."
  [2] lab: 95 tokens
      Preview: "Lab Result: White Blood Cell Count, Value: 8.2..."
  ...
```
Shows:
- What query triggered RAG
- Size reduction achieved
- Each retrieved document with token count

#### 3. Final Request to LLM
```
[AI Request] Preparing to send to LLM:
  Patient context: 450 tokens
  User message: 15 tokens
  Total messages: 2

[AI Service] Final Message Analysis:
  Total tokens: 520 tokens
  Tokens by role:
    system: 465 tokens (1 message(s))
    user: 15 tokens (1 message(s))
  System prompt preview: "You are a clinical assistant helping healthcare providers..."
```
Shows exactly what's being sent to the LLM.

#### 4. LLM Response
```
[AI Response] Token Usage:
  Prompt tokens: 520
  Completion tokens: 150
  Total tokens: 670
```
Shows actual token usage from the LLM API.

## Common Issues to Look For

### Issue: RAG Not Working
```
[RAG] RAG retrieval failed, falling back to full context: ...
```
**Solution**: Check if RAG indexing completed successfully. Look for:
```
[RAG] Patient data indexed successfully
```

### Issue: RAG Documents Too Large
```
[RAG] Retrieved Documents:
  [1] note: 2500 tokens
```
**Problem**: Each document is very large (should be ~100-200 tokens each)
**Solution**: Check document chunking in `patientDataIndexer.ts`

### Issue: Full Context Still Being Sent
```
[Chat Request] Initial patient context: 2.5k tokens
[RAG] Context Size Comparison:
  Full context: 2.5k tokens
  RAG context: 2.4k tokens  ← Should be much smaller!
  Reduction: 4.0%  ← Should be 80%+ reduction
```
**Problem**: RAG is retrieving too many/large documents
**Solution**: Adjust `topK` parameter (currently 5) or `minScore` threshold

## Log Levels

- **Info**: Normal operation logs
- **Warn**: Non-critical issues (e.g., RAG fallback)
- **Error**: Critical errors that need attention

## Filtering Logs

To see only RAG-related logs:
```bash
# In terminal running backend
# Look for lines containing "[RAG]"
```

To see only token-related logs:
```bash
# Look for lines containing "tokens" or "Token"
```

## Debugging Tips

1. **Check if RAG is enabled**: Look for `[RAG]` logs
2. **Check context size**: Compare "Full context" vs "RAG context"
3. **Check document sizes**: Each retrieved document should be reasonable (~100-300 tokens)
4. **Check total tokens**: Should be under 2000 tokens for most queries
5. **Check LLM usage**: Compare estimated vs actual tokens

