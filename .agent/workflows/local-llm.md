---
description: How to start/manage the local LLM (Ollama + Qwen3) for ProposalFlow AI
---

# Local LLM Management

## Prerequisites
- Ollama installed at `C:\Users\user\AppData\Local\Programs\Ollama\ollama.exe`
- Model `qwen3:4b` already pulled

## Check Status
// turbo
1. Check if Ollama is running:
```
curl -s http://localhost:11434/api/tags
```

## Start Ollama (if not running)
Ollama usually auto-starts as a Windows service. If it's not running:
// turbo
2. Start Ollama service:
```
Start-Process "C:\Users\user\AppData\Local\Programs\Ollama\ollama.exe" -ArgumentList "serve" -WindowStyle Hidden
```

## Pull Additional Models
3. Download Qwen3-7B (for heavy analysis tasks):
```
C:\Users\user\AppData\Local\Programs\Ollama\ollama.exe pull qwen3:8b
```

## Switch Models
4. Change `OLLAMA_MODEL` in `d:\WDMC\erptw\.env`:
```
OLLAMA_MODEL=qwen3:4b    # Fast (default)
OLLAMA_MODEL=qwen3:8b    # Better quality
```

## Force Cloud Mode
5. To force Groq cloud:
```
AI_PREFER_LOCAL=false     # in .env
```

## Architecture
```
ProposalFlow (port 5173)
    → Node.js backend (port 3001)
        → ai-provider.js
            → Ollama (localhost:11434) [PRIMARY]
            → Groq API (cloud) [FALLBACK]
```
