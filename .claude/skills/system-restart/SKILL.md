---
name: system-restart
description: Rebuild the Wahnahbe dashboard frontend and restart the auto-start server. Use after changing dashboard code, or when Josh says the dashboard looks stale or broken.
---

# System Restart

From `C:\Users\gjgut\codingprojects\THESYSTEM`:

1. `npm run build` — must succeed; if it fails, fix the build, don't restart.
2. Stop the running server by port: `powershell -Command "Get-NetTCPConnection -LocalPort 4777 -State Listen -ErrorAction SilentlyContinue | Select-Object -ExpandProperty OwningProcess -Unique | ForEach-Object { Stop-Process -Id $_ -Force }"`
3. Wait for the task instance to end: poll `(Get-ScheduledTask -TaskName WahnahbeSystem).State` until it is not 'Running' (up to 15s). Note: Task Scheduler's own restart-on-failure may also relaunch it within ~1 min — if State returns to Running by itself, skip step 4. Also note: a crashed or killed server also self-heals within ~5 minutes via the watchdog trigger; the manual steps below are for immediate restarts.
4. `Start-ScheduledTask -TaskName WahnahbeSystem`
5. Verify: poll `curl http://localhost:4777/api/dashboard` until `{"ok":true` (up to 30s). Check `logs\server.log` tail on failure.
6. If the task doesn't exist (first setup): `powershell -ExecutionPolicy Bypass -File scripts\install-autostart.ps1`.
