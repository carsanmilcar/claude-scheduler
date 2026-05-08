---
description: Mark this Claude Code conversation for deletion when you /exit
---

The user wants to discard this conversation so it doesn't accumulate in their session history.

## What to do

**1. Locate the current session deterministically — no filesystem listing.**

Use the Bash tool to read two environment variables that Claude Code exposes to every subprocess:

```bash
sid="$CLAUDE_CODE_SESSION_ID"
proj="$CLAUDE_PROJECT_DIR"
echo "session: $sid"
echo "project: $proj"
```

- If either is empty, **abort**: tell the user "Esta skill necesita `CLAUDE_CODE_SESSION_ID` y `CLAUDE_PROJECT_DIR` en el entorno y no están disponibles. No marco nada." and stop.
- Validate the session ID matches the UUID shape (`^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$`). If not, abort the same way.

**2. Build the JSONL path determinístically.**

```bash
encoded=$(echo "$proj" | sed 's/[:\\]/-/g; s|/|-|g')
jsonl="$HOME/.claude/projects/$encoded/$sid.jsonl"
```

Check **only** that one path exists (`[ -f "$jsonl" ]`). If it does not exist, tell the user the path that was checked and abort. **Do not list directories, do not glob, do not enumerate other sessions.**

**3. Show a confirmation.**

Read the file size with `stat` or `wc -c "$jsonl"` (a single read of one specific file is fine). Tell the user briefly:

> Voy a marcar esta sesión para borrar al `/exit`:
> - Session: `<uuid>`
> - Path: `<full path>`
> - Tamaño: `<KB>`
>
> ¿Confirmas?

Wait for their answer. If they say no, do nothing further.

**4. If they confirm, write the marker.**

```bash
mkdir -p "$HOME/.claude/forget-marks"
echo "$jsonl" > "$HOME/.claude/forget-marks/$sid.flag"
```

Then tell the user:

> Marcada. Cuando hagas `/exit` se borrará. Si cambias de idea, ejecuta `/forget` de nuevo y te ofrezco desmarcarla.

## If the session is already marked

Before step 3, check if `$HOME/.claude/forget-marks/$sid.flag` already exists. If yes, ask:

> Esta sesión ya estaba marcada para borrar. ¿La desmarco?

On yes, `rm "$HOME/.claude/forget-marks/$sid.flag"` and confirm.

## Important

- The session ID and project path come **only** from the environment. No `pwd` fallback, no most-recent-jsonl heuristic, no directory listing.
- Never delete the JSONL directly here — the file is open by Claude and deletion fails on Windows. Only mark.
- The actual deletion is performed by the `SessionEnd` hook (`scripts/forget-cleanup.ps1`).
