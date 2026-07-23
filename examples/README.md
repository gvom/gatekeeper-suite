# Examples

Copiar os trechos para o seu `.env` (ou para o bloco `env` do `settings.json`).
Todos os valores sensíveis são placeholders — preencha os seus.

## Cadeia de backends (Gemini primário, Ollama local de fallback)

```env
GATEKEEPER_BACKEND=gemini
GATEKEEPER_BACKEND_CHAIN=gemini,ollama
GATEKEEPER_GEMINI_API_KEY=<SUA_CHAVE_GEMINI>
GATEKEEPER_GEMINI_MODEL=gemini-flash-latest
GATEKEEPER_FALLBACK_BACKEND=ollama
```

## Só local (sem chave, 100% Ollama)

```env
GATEKEEPER_BACKEND=ollama
GATEKEEPER_BACKEND_CHAIN=ollama
GATEKEEPER_CLAUDE_HEADLESS=false
```

## Ask/avisos remotos via Telegram (compartilhado gatekeeper + governor)

```env
GATEKEEPER_REMOTE=telegram
GATEKEEPER_REMOTE_TOKEN=<SEU_BOT_TOKEN>
GATEKEEPER_REMOTE_CHAT_ID=<SEU_CHAT_ID>
GATEKEEPER_REMOTE_TIMEOUT=60
```

## Governor mais conservador (pausa a 90%, margem maior)

```env
GOVERNOR_MAXIMUM_USAGE_PERCENTAGE=90
GOVERNOR_SAFETY_MARGIN_MS=300000
```
