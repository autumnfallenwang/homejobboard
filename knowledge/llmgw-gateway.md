---
name: llmgw-gateway
description: How to reach the cluster llmgw LLM gateway — OpenAI-compatible, models, env var
metadata:
  type: reference
---

The home cluster's **`llmgw`** LLM gateway is **OpenAI-compatible** — call it with the `openai`
SDK pointed at `${LLM_GATEWAY_URL}/v1` (chat completions at `/v1/chat/completions`, model list at
`/v1/models`). No real API key needed (the gateway doesn't validate it). Mirrors `homenews`.

- **Env var:** `LLM_GATEWAY_URL` (default `http://llmgw.arch.local`). Reachable from dev — the host's
  `/etc/hosts` maps `llmgw.arch.local` → 127.0.0.1, so a real LLM smoke works locally.
- **Client:** `apps/api/src/services/llm-client.ts`.
- **Models** (verified via `/v1/models` 2026-06-08): `claude-haiku-4-5` (our scoring default — cheap +
  fast), `claude-sonnet-4-5`, `claude-opus-4-5`/`4-6`, `gpt-5.1`/`5.2`, and local `gemma4:26b` /
  `gpt-oss:20b` (good free fallbacks). Model choice is stored in the `settings` table
  (`llm_model_<task>` + `_fallback`), not hardcoded.
- **Output:** prompt-based JSON (no tool-calling/response_format) → regex-extract `{…}` → validate;
  fall back to the fallback model on a primary error. See `apps/api/src/services/score.ts`.
