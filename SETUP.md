# End-to-End Build Guide — PRD-to-Merge Automation (GitHub + Jira)

A conductor (`/ship-prd` in your Claude Code session) decomposes a PRD and hands
scoped jobs to seven subagents. **Jira** holds tickets (via the Atlassian MCP);
**GitHub** holds code + PRs (via the `gh` CLI). Deterministic hooks run a
quality gate on commit and block `gh pr merge` until every gate passes.

```
PRD ─▶ prd-analyst ─▶ jira-ticketer ─▶ [ per ticket ]
                                         implementer ─▶ qa-tester ─▶ pr-manager
                                              ▲              │
                                              └── reviewer ◀─┘ ─▶ (human yes) ─▶ merger
```

## Kit contents
```
CLAUDE.md                       Operating rules every agent inherits
.mcp.json                       Atlassian (Jira) + Playwright MCP
.claude/settings.json           Hook wiring + "ask" on `gh pr merge`
.claude/agents/*.md             The 7 subagents
.claude/commands/ship-prd.md    Orchestrator playbook (/ship-prd)
.claude/hooks/                  post-commit-gate.mjs, pre-merge-guard.mjs
.github/workflows/ci.yml        The required `ci` status check
.github/workflows/claude.yml    @claude helper in issues/PRs (optional)
.github/workflows/claude-qa.yml Automated browser QA on PRs (advanced)
scripts/setup-branch-protection.sh
```

===============================================================================
STAGE A — ONE-TIME FOUNDATIONS
===============================================================================

## A1. Install tooling
- Node 20+, `git`.
- GitHub CLI: `brew install gh` (or your OS equivalent), then `gh auth login`.
- Claude Code: `npm i -g @anthropic-ai/claude-code` (v2.1.154+ for later
  dynamic-workflow scaling). Verify: `claude --version`, `gh auth status`.

## A2. Create the GitHub repo
```bash
# Scaffold a React + TS app (matches your VeriFlow stack). Vite example:
npm create vite@latest hep-app -- --template react-ts
cd hep-app && npm install

# Add test + lint tooling the gate expects
npm i -D vitest @vitest/coverage-v8 eslint
npm pkg set scripts.lint="eslint ."
npm pkg set scripts.test="vitest run"
npm pkg set scripts.preview="vite preview"

git init -b main
git add -A && git commit -m "chore: scaffold app"

# Create the remote and push (private)
gh repo create hep-app --private --source=. --remote=origin --push
```

## A3. Drop this kit into the repo root
Copy `CLAUDE.md`, `.mcp.json`, `.gitignore`, `.claude/`, `.github/`, and
`scripts/` into `hep-app/`. Commit:
```bash
git add -A && git commit -m "chore: add Claude orchestration kit"
git push
```

## A4. Protect `main` (server-side gate)
```bash
./scripts/setup-branch-protection.sh <your-gh-username>/hep-app
```
This requires the `ci` check + 1 approving review before any merge — a backstop
independent of the local hook.

## A5. Install the Claude GitHub App (enables CI workflows)
In your terminal: open `claude`, then run `/install-github-app` and follow the
prompts. (Alternatively: install https://github.com/apps/claude on the repo and
add `ANTHROPIC_API_KEY` under Settings ▸ Secrets and variables ▸ Actions.)
The `contents`, `pull-requests`, and `issues` permissions are what the workflows
need.

## A6. Connect the MCP servers
`.mcp.json` auto-loads. Start `claude`, run `/mcp`, and authorise:
- **atlassian** (Jira) — complete OAuth. If a call ever 401s / "session not
  found", run `/mcp reconnect` and retry.
- **playwright** — connects with no auth; run `npx playwright install` once.
Verify read-only first:
> "List my open Jira issues in <PROJECT>."   "What does `gh pr list` show?"

## A7. Link GitHub ↔ Jira (traceability)
Install the **GitHub for Jira** app and connect your GitHub org. Because the
agents put the Jira key in the branch, commits, and PR title/body, the issue's
Development panel will show the branch/PR/commit automatically. (Status moves
are done explicitly by the agents via the Atlassian MCP — no smart-commit
transitions needed.)

## A8. Scope the tool lists (`# SCOPE ME`)
Run `/mcp` ▸ `atlassian` to see exact tool names, then edit the `tools:` lines in
`jira-ticketer.md`, `pr-manager.md`, and `merger.md` to list only the atlassian
create-issue / transition-issue tools each needs (plus the Bash/Read/Write
already listed). Until you do, remove the `# SCOPE ME` `tools:` line to grant all
tools so they work immediately.

## A9. Point the gate at your scripts
The post-commit hook defaults to `tsc --noEmit`, `lint`, `vitest run`. To reuse
your existing `ship.mjs` checks verbatim:
```bash
export SHIP_GATE_CMDS="node ship.mjs --check && npx vitest run"
```

===============================================================================
STAGE B — PROVE IT ON ONE TICKET (merge stays manual)
===============================================================================

## B1. Run the pipeline on a single ticket
```bash
claude
/ship-prd ./docs/PRD.md
```
- Approve the decomposition when it stops.
- Let it create Jira tickets, then implement + E2E-test + open a PR for the
  FIRST ticket only.
- At the HUMAN GATE, open the PR yourself, confirm `ci` is green, and approve the
  merge manually.

What you're validating: Atlassian auth stability, the exact Jira tool names, the
`gh pr create/merge` flow, and that the hooks fire (you'll see the gate run on
commit and the merge get blocked if a marker is missing).

## B2. Confirm the guardrails actually bite
Try `gh pr merge` before E2E/review are done — the pre-merge hook should refuse
with the list of missing gates. That's the safety net working.

===============================================================================
STAGE C — SCALE UP
===============================================================================

## C1. Parallel tickets
Give each ticket its own worktree so branches don't collide:
```bash
git worktree add ../wt-HEP-142 -b feature/HEP-142-slug
```
Then: `/ship-prd ./docs/PRD.md --parallel 3` (independent tickets only).
Optional: enable Agent Teams (`CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1`) so a
team lead coordinates workers that each hold their own context.

## C2. Automated browser QA in CI
`.github/workflows/claude-qa.yml` starts the app and runs a black-box Claude +
Playwright QA pass on every PR, commenting PASS/FAIL. Needs `ANTHROPIC_API_KEY`
(A5). Tune `--max-turns` / model for cost.

## C3. Unattended / issue-triggered
- `.github/workflows/claude.yml` lets you drive work by tagging `@claude` on a
  Jira-linked GitHub issue (Claude branches, implements, opens a PR).
- Codify `/ship-prd` as a **dynamic workflow** (Claude Code v2.1.154+) so the
  loop runs in the background as a rerunnable script.
- Relax the manual-merge rule ONLY after runs are consistently green — keep
  branch protection + required `ci` on `main` regardless.

===============================================================================
SAFETY, COST, TROUBLESHOOTING
===============================================================================
- **Never auto-merge unreviewed code.** The official GitHub action deliberately
  does not auto-merge; keep the pre-merge hook + human gate + branch protection.
- **Cost.** Subagent-heavy runs can cost ~7x a single-thread session; parallel
  agents hit rate limits fast. Keep agent returns to compact summaries; set
  `--max-turns` and per-repo budget alerts. A CI PR review typically runs tens of
  thousands of tokens.
- **Least privilege.** qa-tester is source-blind by design. Tighten the three
  atlassian agents in A8. In CI, restrict `--allowedTools`.
- **Troubleshooting**
  - Merge refused → the hook is working; check `.claude/state/` for the missing
    marker named in the error, or `ci` not yet green on GitHub.
  - Atlassian 401 / "session not found" → `/mcp reconnect`, retry.
  - `ci` never turns green in branch protection → the required context name must
    match the workflow job name (`ci`); confirm under the PR's Checks tab.
  - Playwright "no browser tools" → run `npx @playwright/mcp@latest` directly to
    see the real error (Node version or missing browser binary).
  - Hook schema errors → hook config format evolves; verify against the current
    Claude Code hooks docs.
