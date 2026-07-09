# HEP AutoDev — Complete Automated Development Kit

A self-driving development loop for HEP. A `planner` agent decides what to build
next from the HEP master plan, creates Jira tickets, and a team of agents
implements, browser-tests, fixes its own bugs, and ships — with deterministic
gates so "automated" never means "unchecked".

```
                       orchestrator.mjs  (Claude Agent SDK, headless)
                                  │  delegates via the Agent tool
   ┌──────────┬───────────┬──────┴──────┬───────────┬──────────┬─────────┐
 planner   jira-      implementer   qa-tester    reviewer   pr-manager  merger
 (thinks)  ticketer   (code+commit) (browser E2E)(review)   (PR)        (merge)
                             ▲            │            │
                             └── bug-fixer ◀──────────┘   (recheck-and-solve loop:
                                 root-cause + fix test-first, then re-test/re-review)
```

## Two ways to run the same agents + gates
- **Interactive:** `claude` then `/ship-prd docs/HEP_Master_Plan_SSoT.md`
  (human confirms each merge in the terminal).
- **Autonomous:** `node orchestrator.mjs` (headless; unattended or CI-triggered).

## The gates (why autonomous is still safe)
1. **post-commit hook** — typecheck + lint + unit tests on every commit; a bad
   commit is blocked and the agent must fix forward.
2. **qa-tester** — black-box browser E2E for every acceptance criterion.
3. **reviewer** — adversarial diff review; writes `review-approved` only when no
   blocking findings.
4. **pre-merge hook** — refuses `gh pr merge` unless the quality + E2E + review
   markers exist for the branch.
5. **branch protection** — GitHub requires the `ci` check + 1 review on `main`.
6. **canUseTool** — in supervised mode, refuses every merge outright (a human
   merges on GitHub). In auto mode, allows it only after 1–5 pass.

Merge policy: `supervised` (default) until the loop has earned trust on real
tickets; flip to `auto` with `MODE=auto` once you're confident.

===============================================================================
SETUP (adds to the GitHub + Jira foundations in SETUP-github-jira.md)
===============================================================================

## 1. Do the base setup first
Follow SETUP-github-jira.md Stages A–B (repo, gh, Claude GitHub app, branch
protection, connect Atlassian + Playwright MCP, scope the atlassian agents).

## 2. Install the Agent SDK + scripts
```bash
./scripts/install-orchestrator.sh
# (runs: npm i -D @anthropic-ai/claude-agent-sdk  + adds npm run auto* scripts)
export ANTHROPIC_API_KEY=sk-ant-...        # the SDK authenticates with an API key
```

## 3. Give the planner its source of truth
Export the HEP master plan to markdown and drop it at the configured path:
```bash
# e.g. from your .docx:
#   pandoc HEP_Master_Plan_SSoT.docx -o docs/HEP_Master_Plan_SSoT.md
```
Edit `orchestrator.config.json` to match your project:
```json
{
  "mode": "supervised",
  "model": "claude-opus-4-8",
  "sourceDoc": "docs/HEP_Master_Plan_SSoT.md",
  "jiraProject": "HEP",
  "maxTicketsPerRun": 1,
  "parallel": 1,
  "maxTurns": 400,
  "bugFixMaxAttempts": 3
}
```

## 4. First autonomous run — ONE ticket, human merge
```bash
npm run auto:one          # MAX_TICKETS=1 MODE=supervised
```
Watch it: plan → approve nothing (it runs) → ticket created → implement →
browser-test → (auto-fix on failure) → PR opened → review → CI. It STOPS at the
merge and prints the PR url for you to merge on GitHub. Verify the whole chain
before trusting it further.

## 5. Scale up
```bash
MAX_TICKETS=3 npm run auto:supervised     # a few tickets, still human-merged
# once trusted:
MODE=auto MAX_TICKETS=3 npm run auto       # auto-merge when every gate is green
```
- Parallelism: set `"parallel"` > 1 (the orchestrator uses one git worktree per
  ticket so branches don't collide).
- Unattended/scheduled: run `npm run auto` from cron or a CI job (see
  .github/workflows/claude-qa.yml for the browser-QA-in-CI pattern), keeping
  `mode: "supervised"` unless you have strong reasons to auto-merge.

===============================================================================
SAFETY & COST (read before flipping to auto)
===============================================================================
- **HEP is healthcare/PHI.** Keep `supervised` until you've seen many clean runs;
  keep branch protection + required `ci` on `main` even in auto mode. The
  official GitHub action likewise does not auto-merge by default.
- **Cost/limits.** Multi-agent runs are token-hungry (subagent fan-out can be
  ~7x a single session; sprawl causes OOM/limit hits). Controls in place:
  `maxTicketsPerRun`, `maxTurns`, `bugFixMaxAttempts`, compact hand-offs, and a
  cheaper model per subagent (set `model` in an agent's frontmatter). Set an
  Anthropic budget alert. The SDK bills per token / your plan's Agent SDK credit.
- **Least privilege.** qa-tester is source-blind; the atlassian agents must be
  scoped (SETUP step A8); `bug-fixer`/`implementer` have no merge/Jira tools.
- **Stop conditions.** After `bugFixMaxAttempts`, a ticket is marked blocked, not
  forced through. The orchestrator never fabricates a state marker to pass a gate.

## Troubleshooting
- `ANTHROPIC_API_KEY` missing → export it (claude.ai login is not permitted for
  SDK apps; use an API key).
- Merge refused → a gate is unmet; check `.claude/state/` for the missing marker,
  or `ci` not green yet.
- Atlassian 401 → the run will retry; if persistent, reconnect the MCP and rerun.
- Runaway cost → lower `maxTurns` / `maxTicketsPerRun`, use a cheaper subagent model.
