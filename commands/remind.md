---
description: Remind me to come back to this Claude session at a specific time (registers it in the local claude-scheduler)
---

The user wants to register the current conversation in their local Claude Scheduler so it pops back open later.

Use the `schedule_session` tool from the `claude-scheduler` MCP server. Parse the user's natural-language argument into the right shape:

**`when` — required.** Choose one form:
- ISO datetime for one-shot, e.g. `2026-05-10T09:00:00`. Convert relative phrases ("tomorrow at 9", "in 30 min") to absolute datetimes using the current local time.
- 5-field cron expression for recurring, e.g. `0 9 * * 1-5` (weekdays 9am), `0 18 * * 2,4` (Tue and Thu 6pm).

**`name` — required.** A short label. Derive from the user's text or the conversation topic if they didn't specify one.

**`prompt` — optional.** Initial message Claude should receive when the session resumes. Include if the user said something like "remind me to ..." or "come back and ...".

**`session_id` and `repo_path` — leave blank.** The MCP server auto-detects both.

If the user's request is ambiguous (e.g. "tomorrow" without a time, "weekly" without a day), ask one clarifying question before calling the tool.

After scheduling, confirm to the user with: the task name, when it will fire (in their local time), and the URL `http://localhost:3333` for managing tasks.

Examples of inputs the user might give:
- `mañana 9am — revisa los resultados de la noche`
- `cada lunes 10:00 weekly review`
- `en 30 min sigue donde lo dejamos`
- `2026-05-15T08:30 reminder to ship`
