# /sync-data — Sync GeoCarHelpDesk data

Sync the sibling `GeoCarHelpDesk` repo and regenerate `geo-car-helpdesk.ts`, then reapply the crawler merge.

## Steps

1. **Check sibling repo exists**
   Verify `../GeoCarHelpDesk` exists relative to the project root. If not, tell the user and stop — they need to clone it first.

2. **Run sync**
   ```
   pnpm --filter geoguessr-helper-backend sync:data
   ```
   This pulls the latest GeoCarHelpDesk repo (`git pull --ff-only`), regenerates `backend/src/data/geo-car-helpdesk.ts`, then runs `merge:crawlers` to reapply any crawler-derived data.

## After completion

- Report what changed in `geo-car-helpdesk.ts` (git diff summary).
- Remind the user that `geo-car-helpdesk.ts` is auto-generated — hand edits should not be made to it.
