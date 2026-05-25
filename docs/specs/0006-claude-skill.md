# 0006 — pear-tasks Claude Code skill

**Status:** Approved
**Owner:** jacob
**Created:** 2026-05-25

## Problem

The MCP tools are useless until Claude knows when to reach for them and how Pear's conventions shape their use. Without a skill, the user has to spell out the workflow every time ("use the pear MCP", "remember deps are project-scoped", "ask before completing").

## Proposal

A single Skill file shipped at `pear-mcp/skills/pear-tasks.md` (also documented for install to `~/.claude/skills/`). The skill:

- Triggers on natural phrases: "pear", "my tasks", "what's blocked", "add to my tasks", and on project codenames the user keeps in their working memory.
- Documents the full tool surface in one place.
- Encodes invariants users should not have to repeat: dependencies are project-scoped, soft-delete is the only delete, ask before calling `complete_task`, never invent project ids — list first.
- Includes one worked example: list open tasks → create a task → add a dependency → fetch the project graph.

## Out of scope

- Auto-installing the skill into `~/.claude/skills/` (manual step documented in README).
- A separate Claude Desktop variant (Claude Code is the v1 target).

## Acceptance criteria

- Skill description triggers on the listed natural phrases without false positives on unrelated task talk.
- Documentation covers every tool from specs 0004 and 0005.
- The "ask before completing" convention is explicit.
- The worked example runs end-to-end against a fresh sync file.

## Open questions

- Trigger phrase tuning will need iteration after dogfooding.

## Related

- Plan: `docs/plans/plan-for-pear-mcp.md`
- Depends on: 0005-mcp-write-tools
