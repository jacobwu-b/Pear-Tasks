# 0002 — Scheduled batched dependency updates over advisory-driven reaction

**Status:** Accepted
**Date:** 2026-08-02
**Deciders:** jacob

## Context

Between 2026-06-25 and 2026-08-02, Pear absorbed 13 Dependabot alerts and nine dependency
PRs (#72–#79, #81). The work felt like whack-a-mole. Reviewing the record (issue #82) shows
why.

**The alerts are uniformly low-stakes.** All 13 are `development` scope, all are transitive
(`manifest_path: package-lock.json`, none named in `package.json`). The tree is 315 dev
packages against 12 production packages, and `npm audit --omit=dev` has reported zero
vulnerabilities throughout. Pear is a static, backendless, local-only app, so nothing that
raised an alert is reachable by a user of the deployed bundle. One package — `brace-expansion`,
a glob parser pulled in by eslint — produced four advisories across two coexisting version
lines (1.1.x and 5.0.x) and 31% of the PR volume.

**Dependabot's failure mode was silence, not incorrectness.** All seven of its PRs passed CI
on the first run and none were closed unmerged. But:

- Alerts #13 (postcss, high, CVSS 7.5) and #14 (brace-expansion, high) were created by the
  same scan at `2026-08-02T02:45:39Z` in the same `npm_and_yarn` group. Dependabot opened one
  PR (#78) covering brace-expansion and never touched postcss. Nothing in the PR indicated a
  group member had been dropped; a human found it by running `npm audit`.
- Alert #5 (`@babel/core`, low, CVSS 3.2, development) sat open for 38 days with no Dependabot
  activity at all. The fix was a plain `npm update` — the parent's `^7.24.4` already admitted
  the patched version. No capability limit, just no attempt.

**Nothing we own would have caught either.** `ci.yml` ran lint, test, and build — no audit
step. And the repository had no `.github/dependabot.yml`, so only GitHub's automatically
enabled *security* updates ran and no *version* updates ran at all. Under
security-updates-only the lockfile moves only when an advisory lands, so it permanently sits
at "last CVE" state. The reactive churn was the configured behaviour, not a malfunction.

A secondary effect compounded it: PR #75 (vite 8.0.8 → 8.1.4) moved postcss 8.5.15 → 8.5.16
across 238 lockfile lines as a side effect. Nobody selected 8.5.16, and it is the version the
next postcss advisory landed on.

## Decision

Treat dependency maintenance as scheduled batch work gated by CI, not as interrupt-driven
security response.

1. **`.github/dependabot.yml` with monthly version updates**, npm and github-actions, grouped
   by scope: one production PR, one development PR. Groups are restricted to minor/patch, so
   majors fall outside them and arrive as individual PRs. `versioning-strategy: increase` keeps
   `package.json` ranges honest rather than letting the lockfile drift underneath them.
2. **`npm audit` in the Quality Gate.** `--omit=dev --audit-level=moderate` blocks; a
   full-tree `--audit-level=low` runs `continue-on-error` as a visible warning. The blocking
   gate matches the actual blast radius; the informational one makes a silently skipped alert
   surface in CI instead of only in the alerts UI.
3. **Auto-merge for development-scope and transitive patch/minor bumps** with green CI, via
   `dependabot/fetch-metadata`. Production dependencies and majors keep a human.
4. **A written severity policy** in `CLAUDE.md` §6: development-scope advisories are hygiene
   and clear on the monthly pass; they do not justify a same-day PR.
5. **GitHub auto-triage rules** (repository setting, applied outside this repo's source) to
   auto-dismiss low-impact development-scope alerts at the source.

## Alternatives considered

- **Weekly version updates.** Originally proposed. Rejected as still too much interrupt for a
  solo personal project — monthly batches the same work into a twelfth of the touchpoints, and
  the CI audit gate covers anything genuinely urgent between passes.
- **Ignore all development-scope advisories outright** (`ignore` block in `dependabot.yml`).
  Correct about today's risk, wrong over time: a dev package can be promoted, and a silently
  frozen toolchain turns into a forced multi-major migration. The monthly pass costs one PR.
- **Pin transitive packages with `overrides`.** Would have deterministically fixed postcss and
  `@babel/core`, but every entry is a hand-maintained pin that goes stale silently and masks
  the parent's own upgrades. Neither case needed it — both parents' declared ranges already
  admitted the patched version.
- **Blocking `npm audit` on the full tree.** Would make any dev-scope advisory — four
  `brace-expansion` ones in five weeks — break CI for unrelated PRs. Inverts the priority: it
  is the production tree that ships.
- **Drop Dependabot, upgrade by hand on a cadence.** Removes the silent-skip problem by
  removing the automation, at the cost of the thing automation is good at. The CI audit gate
  addresses the actual defect (no detector) without giving up the coverage.
- **Auto-merge everything green, including production and majors.** CI is a real gate, but a
  green build does not establish that a major-version behaviour change is wanted. Conflicts
  with §6's approval requirement for a reason.

## Consequences

**Easier:**
- Dependency work becomes one predictable batch per month instead of an unpredictable
  interrupt stream, and the dev-scope batch merges itself.
- A production advisory now fails the build, which is the only case that warrants stopping
  work — the signal is proportional to the risk for the first time.
- An alert Dependabot skips shows up in CI output rather than waiting for someone to run
  `npm audit` by hand.

**Harder / committed to maintain:**
- `pull_request_target` in `dependabot-auto-merge.yml` runs with a writable token. It is safe
  only because the workflow never checks out PR code. Adding a checkout step there would be an
  arbitrary-code-execution hole; the file carries a comment saying so.
- `dependabot/fetch-metadata` is pinned to a commit SHA, so it will not pick up upstream fixes
  until the monthly github-actions group bumps it.
- Dev-scope advisories will now sit open for up to a month by design. That is the intended
  trade, and it is only defensible while the production tree stays small and the app stays
  backendless. If Pear ever grows a server, this ADR needs revisiting.
- Auto-merged PRs land on main without a human reading them. The Quality Gate is the only
  thing standing behind them, which raises the cost of ever letting it go yellow.

## Related

- Issue: #82 — Research package / module version control and management
- Config: `.github/dependabot.yml`, `.github/workflows/ci.yml`,
  `.github/workflows/dependabot-auto-merge.yml`
- Policy: `CLAUDE.md` §6 — Dependencies, Advisory triage
