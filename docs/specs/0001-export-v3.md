# 0001 — Export format v3 with recurrence

**Status:** Approved
**Owner:** jacob
**Created:** 2026-05-25

## Problem

The Dexie schema is at v3 (recurrence fields added on tasks), but the export envelope in `src/db/exportImport.ts` still hard-codes `version: 2` and rejects anything else on import. Recurring task data round-trips silently as missing fields, and an MCP server reading the file cannot see recurrence at all.

## Proposal

Bump the export envelope to v3. The new envelope includes `recurrence` and `recurringParentId` on every task. Import accepts v2 envelopes by upgrading them in memory (recurrence fields default to undefined), accepts v3 envelopes as-is, and rejects v1 or anything unknown with a typed error.

## Out of scope

- Migrating existing on-disk v2 backup files in user storage (handled at import time).
- Any change to the Dexie schema itself.
- The sync-file path (spec 0002).

## Acceptance criteria

- Export writes `version: 3` and serializes `recurrence` and `recurringParentId` on tasks.
- Import accepts v2 envelopes and upgrades them in memory without data loss.
- Import accepts v3 envelopes unchanged.
- Import rejects `version: 1` and unknown versions with a typed error.
- Round-trip of a task with a non-trivial recurrence config preserves every field exactly.

## Open questions

None.

## Related

- Plan: `docs/plans/plan-for-pear-mcp.md`
- Depends on: none
