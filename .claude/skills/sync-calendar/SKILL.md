---
name: sync-calendar
description: Pull the next 7 days of Google Calendar events into the Wahnahbe dashboard agenda. Use when Josh says "sync my calendar", "update my agenda", or similar.
---

# Sync Calendar → Dashboard Agenda

1. Read `C:\Users\gjgut\second-brain\system\agenda.json` (schema: `{events: [{id, date, time, title, type, source, gcalId?}]}`).
2. List Google Calendar events for today through today+7 using the calendar MCP tools (`list_events`). If the calendar MCP is not connected, STOP and tell Josh to authorize it — do not fabricate events.
3. Merge, never duplicate:
   - Match existing events by `gcalId`. Update `date`/`time`/`title` in place if changed on the calendar side.
   - New calendar events → append `{id: <new uuid>, date: "YYYY-MM-DD", time: "HH:MM" (24h, event start, local), title: <summary uppercased>, type: <best fit of SCHOOL|INTERVIEW|WORK|TRAINING|OTHER>, source: "gcal", gcalId: <event id>}`.
   - Events with `source: "gcal"` whose `gcalId` no longer exists in the calendar window → remove.
   - NEVER touch events with `source: "manual"`.
4. Write the full updated JSON back (2-space indent). The dashboard picks it up automatically.
5. Report: N added, N updated, N removed.
