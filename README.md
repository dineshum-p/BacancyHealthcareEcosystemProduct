# HEP AutoDev — Full-Stack Autonomous Development Kit

Turn the HEP PRD into shipped software with a team of Claude agents. A `planner`
decides what to build next from the PRD, opens Jira tickets, and specialist
agents implement **frontend (Next.js)** and **backend (NestJS)**, test in a real
browser and against the API, fix their own bugs, raise a GitHub PR, review it,
and merge — with stacked gates so autonomy never means unreviewed code on `main`.

```
                    orchestrator.mjs  (Claude Agent SDK, headless)
                                │ delegates via the Agent tool
 planner → jira-ticketer → ┌──────────────── per ticket, by surface ───────────────┐
                           │ backend  : backend-engineer  → api-tester             │
                           │ frontend : frontend-engineer → qa-tester (Playwright) │
                           │ fullstack: backend first, then frontend               │
                           │   any failure → bug-fixer → re-test (≤3)              │
                           │ → pr-manager → reviewer → CI → (human) → merger        │
                           └───────────────────────────────────────────────────────┘
```

## What's in the box
```
docs/HEP_Master_Plan_SSoT.md   your PRD (converted to markdown)
docs/HEP_ARCHITECTURE.md       condensed index the planner reads (token-cheap)
package.json + turbo.json      monorepo (workspaces + Turborepo, affected builds)
apps/ services/ packages/      where web / NestJS services / shared code live
CLAUDE.md                      operating rules every agent inherits
.mcp.json                      Atlassian (Jira) + Playwright MCP
.claude/agents/*.md            planner, jira-ticketer, frontend-engineer,
                               backend-engineer, qa-tester, api-tester,
                               bug-fixer, reviewer, pr-manager, merger, prd-analyst
.claude/commands/ship-prd.md   interactive orchestrator (/ship-prd)
.claude/hooks/                 affected-gate (commit) + surface-aware merge guard
.claude/settings.json          hook wiring
.github/workflows/             ci (turbo affected) · claude-qa (PR browser E2E) · claude (@claude)
orchestrator.mjs + config      headless autonomous orchestrator
scripts/                       bootstrap-monorepo · install-orchestrator · setup-branch-protection
SETUP.md · AUTONOMOUS.md       detailed setup + autonomous-mode guides
```

## Add it to your repo (best path)
1. **Foundations** (once): `gh auth login`; install Claude Code
   (`npm i -g @anthropic-ai/claude-code`); create the repo and push
   (`gh repo create hep --private --source=. --push`). See SETUP.md Stage A.
2. **Scaffold the monorepo:** `./scripts/bootstrap-monorepo.sh` (Next.js web +
   first NestJS service + shared-types), then `npm install`.
3. **Drop this kit in** at the repo root and commit.
4. **Protect main:** `./scripts/setup-branch-protection.sh <owner>/hep`
   (requires the `ci` check + 1 review).
5. **Connect MCP + CI:** in `claude`, run `/install-github-app`, then `/mcp` to
   auth Atlassian (Jira) + Playwright. Scope the three Atlassian agents (SETUP A8).
6. **Install the SDK:** `./scripts/install-orchestrator.sh`; `export ANTHROPIC_API_KEY=...`.
7. **First run — one ticket, human merge:**
   ```bash
   npm run auto:one          # plan → ticket → BE/FE build → test → PR → CI → (you merge)
   ```
   Verify the whole chain, then scale: `MAX_TICKETS=3 npm run auto:supervised`,
   and only later `MODE=auto npm run auto`.

## The gates (why full autonomy stays safe)
commit gate (affected typecheck/lint/test) · api-tester + qa-tester per surface ·
adversarial reviewer · pre-merge hook (requires the surface's test markers +
review) · GitHub branch protection (green `ci` + 1 review) · `canUseTool`
(supervised = never auto-merge). HEP is a PHI product — keep `supervised` until
you've seen many clean runs; keep branch protection on `main` even in `auto`.

Detailed guides: **SETUP.md** (GitHub+Jira foundations) and **AUTONOMOUS.md**
(how the headless loop, modes, cost controls, and troubleshooting work).
