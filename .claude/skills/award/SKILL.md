---
name: award
description: Bank XP to the Wahnahbe dashboard ledger when Josh learns or accomplishes something in a session. Use when Josh says "award XP", "log that", "bank it", or you finish teaching him something substantial outside the vault tutoring flow.
---

# Award XP → Dashboard Ledger

Preferred (server running): POST http://localhost:4777/api/xp/award with JSON
`{"amount": <int 1-500>, "stat": <one of: Conceptual | Mathematical | Statistical & Data Reasoning | Programming & Implementation | Software Eng. & Systems | Applied Problem-Solving | Communication & Translation | Retention & Connections | GENERAL>, "reason": "<one line>", "source": "claude-session"}`

Response: `{ok:true,data:{award:{total, amount, ascended, …}}}` — if `ascended` is non-null, tell Josh he leveled up.

Fallback (server down): edit `C:\Users\gjgut\second-brain\system\xpLedger.json` directly — append to `entries`: `{"ts": "<ISO now>", "amount": N, "stat": "...", "reason": "...", "source": "claude-session"}`. Do NOT edit `crossings` by hand.

Guidance: S/M/L session ≈ 10/20/40 XP. Match the report card's spirit — XP is mileage, not mastery. Never award for trivia.
