# Project Operating Rules (read by the orchestrator and every subagent)

This repo runs an automated PRD -> Jira -> code -> GitHub PR -> test -> merge
pipeline. Stack: GitHub (code + PRs via the `gh` CLI) and Jira (tickets via the
Atlassian MCP). Skills referenced below are the org set (`tdd-workflow`,
`frontend-patterns`, `token-aware`).

## Definition of Done (a ticket is not done until ALL are true)
1. Code follows `frontend-patterns` (page.tsx routing-only, no `any`, Tailwind
   only, hooks for fetch, repositories for DB, `@/` imports, loading/empty states).
2. Written test-first per `tdd-workflow` (RED -> GREEN -> REFACTOR);
   service-layer coverage >= 80%.
3. Quality gate green: typecheck + lint + unit tests (post-commit hook).
4. Browser E2E for every acceptance criterion passes (qa-tester).
5. Code review has no blocking findings (reviewer).
6. GitHub PR merged and the Jira ticket moved to Done.

## Branch & commit conventions (also drive Jira auto-linking)
- Branch: `feature/<JIRA-KEY>-<kebab-slug>` (one branch/worktree per ticket).
- Commits: Conventional Commits, always include the key, e.g.
  `feat(scheduling): add waiting-list notify [BAC-142]`.
- PR title starts with the key; PR body ends with `Closes <KEY>` for traceability.
  (With the GitHub-for-Jira app installed, keys in branch/commit/PR surface in
  the Jira issue's Development panel automatically.)

## Jira status transitions (who moves what)
- first push / PR opened -> To Do -> In Progress -> In Review (pr-manager)
- merge -> In Review -> Done (merger)

## GitHub is the code host
- Use the `gh` CLI for all repo/PR actions: `gh pr create`, `gh pr view`,
  `gh pr merge`. Never invent a different mechanism.
- `main` is protected: required status check `ci` + 1 review. The merge is ALSO
  gated locally by the pre-merge hook. Do not attempt to bypass either.

## Token discipline (`token-aware`)
- Spawn gate: <30 LOC inline, 30-100 one worker, 100+ domain agent.
- Facts-only state in `.claude/state/`; summaries <= 200 chars; read cache first.

## Merge policy (SAFETY — do not weaken without a human decision)
- `.claude/hooks/pre-merge-guard.mjs` blocks `gh pr merge` until the quality,
  E2E, and review markers exist for the current branch.
- `/ship-prd` additionally requires an explicit human "yes" before the merger
  step, until the pipeline has proven itself on real tickets.

## State markers (source of truth for the gate)
- `.claude/state/backlog.json`      decomposition + Jira keys
- `.claude/state/gate-passed.json`  typecheck/lint/unit gate (post-commit hook)
- `.claude/state/tests-passed`      browser E2E passed (qa-tester)
- `.claude/state/review-approved`   no blocking review findings (reviewer)
- `.claude/state/pr-<KEY>.json`     opened PR metadata (pr-manager)

## Autonomous mode & the full agent roster
This repo can run unattended via `orchestrator.mjs` (Claude Agent SDK) or
interactively via `/ship-prd`. Both use the same 9 subagents and the same gates.

Agents: `planner` (decides what to build next from the source of truth),
`jira-ticketer`, `implementer`, `qa-tester`, `bug-fixer` (root-causes and fixes
failures test-first), `pr-manager`, `reviewer`, `merger`. (`prd-analyst` is the
PRD-driven alternative to `planner`.)

Recheck-and-solve loop (binding): whenever `qa-tester`, `reviewer`, or CI reports
a failure, delegate the evidence to `bug-fixer`, then re-run the failed step.
Cap fix attempts per the orchestrator config; if still failing, mark the ticket
blocked rather than forcing it through.

Merge control in autonomous runs is enforced by the pre-merge hook + branch
protection + `orchestrator.mjs`'s `canUseTool` (supervised = human merges on
GitHub; auto = merge only when every gate is green). Never fabricate a state
marker to bypass a gate.

## Full-stack rules (monorepo)
- Layout: `apps/web` (Next.js 14), `services/<name>` (NestJS 10), `packages/*`
  (shared, incl. `@hep/shared-types`). Frontend and backend SHARE API types via
  `@hep/shared-types` — never redefine a contract on one side.
- Each story is tagged by the planner with `surface` (backend|frontend|fullstack)
  and a `target` workspace. Routing:
  - backend  → backend-engineer → api-tester
  - frontend → frontend-engineer → qa-tester
  - fullstack→ backend-engineer + api-tester, THEN frontend-engineer + qa-tester
- Backend conventions: Module/Controller/Service/Repository; thin controllers;
  DTO validation (class-validator); schema-per-tenant isolation; domain events on
  the bus per the PRD; migrations for schema changes; integration tests against an
  ephemeral Postgres (docker-compose.test.yml), never a shared/prod DB.
- The commit gate is affected-only (Turborepo `--filter=...[origin/main]`), so a
  change in one service doesn't rebuild the world.
- Required test markers per ticket are recorded in
  `.claude/state/required-tests.json`; the pre-merge hook enforces exactly those.
- DB access for agents: prefer the test suite. If a Postgres MCP is ever enabled,
  point it at a LOCAL/TEST database only and use a hardened (restricted-mode)
  server — the common read-only server has a documented write-bypass.
