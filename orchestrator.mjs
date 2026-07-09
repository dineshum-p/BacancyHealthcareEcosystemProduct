#!/usr/bin/env node
/**
 * HEP full-stack autonomous development orchestrator (Claude Agent SDK).
 *
 *   planner -> jira-ticketer -> [ per ticket, routed by surface:
 *     backend  : backend-engineer  -> api-tester ⇄ bug-fixer
 *     frontend : frontend-engineer -> qa-tester  ⇄ bug-fixer
 *     fullstack: backend-engineer -> api-tester, then frontend-engineer -> qa-tester
 *     -> pr-manager -> reviewer ⇄ bug-fixer -> wait CI -> merge -> merger ]
 *
 * Agents live in .claude/agents/*.md; gates live in .claude/hooks (loaded via
 * settingSources). Run: node orchestrator.mjs  |  MODE=auto  |  MAX_TICKETS=n
 * Requires ANTHROPIC_API_KEY, gh authenticated, MCP servers reachable.
 */
import { query } from "@anthropic-ai/claude-agent-sdk";
import { readFileSync } from "node:fs";

const cfg = JSON.parse(readFileSync(new URL("./orchestrator.config.json", import.meta.url), "utf8"));
const MODE = process.env.MODE || cfg.mode;
const MAX_TICKETS = Number(process.env.MAX_TICKETS || cfg.maxTicketsPerRun);

if (!process.env.ANTHROPIC_API_KEY) {
  console.error("Set ANTHROPIC_API_KEY (the Agent SDK authenticates with an API key).");
  process.exit(1);
}

const mcpServers = {
  atlassian:  { type: "http", url: "https://mcp.atlassian.com/v1/mcp" },
  playwright: { command: "npx", args: ["-y", "@playwright/mcp@latest", "--headless"] },
  // Optional (TEST DB ONLY — never prod; the popular server has a read-only bypass):
  // postgres: { command: "npx", args: ["-y", "@crystaldba/postgres-mcp", "--access-mode=restricted"], env: { DATABASE_URI: process.env.TEST_DATABASE_URI ?? "" } },
};

async function canUseTool(toolName, input) {
  const c = (input && input.command) || "";
  const isMerge = toolName === "Bash" && /gh\s+pr\s+merge/.test(c);
  if (isMerge && MODE !== "auto") {
    return { behavior: "deny", message:
      "Supervised mode: do not merge. Leave the PR open (all gates green) and report its url for a human to merge on GitHub." };
  }
  return { behavior: "allow" };
}

const prompt = `
You are the HEP FULL-STACK AUTONOMOUS DEVELOPMENT ORCHESTRATOR. You think about
the work, create Jira tickets, drive frontend AND backend implementation, test
(browser E2E for UI, integration/contract tests for services), fix bugs, and
ship — delegating every scoped task to a subagent via the Agent tool. You are
the integration layer; subagents cannot spawn subagents.

CONTEXT
- Architecture index: ${cfg.architectureDoc}  (full PRD: ${cfg.sourceDoc})
- Jira project key: ${cfg.jiraProject}
- Merge mode: ${MODE}   (supervised = human merges; auto = you may merge when every gate is green)
- Ship at most ${MAX_TICKETS} ticket(s) this run, up to ${cfg.parallel} in parallel (one git worktree each).
- Monorepo: apps/web (Next.js), services/* (NestJS), packages/* (shared). Follow
  CLAUDE.md and the org skills (tdd-workflow, frontend-patterns, token-aware).

LOOP
1) THINK: delegate to \`planner\` with the architecture index. It writes
   .claude/state/backlog.json with the next prioritised slice, each story tagged
   surface (backend|frontend|fullstack) + target workspace. Respect the ticket cap.
2) TICKETS: delegate to \`jira-ticketer\`.
3) FOR EACH ticket (respect depends_on; independent tickets first):
   Before testing, write .claude/state/required-tests.json for THIS ticket:
     backend  -> {"markers":["api-tests-passed"]}
     frontend -> {"markers":["e2e-tests-passed"]}
     fullstack-> {"markers":["api-tests-passed","e2e-tests-passed"]}
   Then, by surface:
   a) IMPLEMENT
      - backend/fullstack: \`backend-engineer\` builds the service first (commit;
        post-commit hook runs the affected gate).
      - frontend/fullstack: \`frontend-engineer\` builds the UI (after the API for
        fullstack). 
   b) TEST
      - backend/fullstack: \`api-tester\` (writes api-tests-passed on green).
      - frontend/fullstack: \`qa-tester\` (writes e2e-tests-passed on green).
      On any failure -> \`bug-fixer\` with the evidence -> re-run the failed tester.
      Repeat up to ${cfg.bugFixMaxAttempts} attempts; if still failing, mark the
      ticket blocked and move on (do not force it).
   c) \`pr-manager\` — push, open the GitHub PR (gh), move the ticket to In Review.
   d) \`reviewer\` — adversarial review (FE + BE). On BLOCKER/MAJOR -> \`bug-fixer\`
      -> re-run reviewer until .claude/state/review-approved exists.
   e) CI — wait for the required \`ci\` check: \`gh pr checks --watch\`. If red ->
      \`bug-fixer\` -> back to (b).
   f) MERGE — supervised: STOP and report the PR url for a human. auto: \`merger\`
      (\`gh pr merge\`). The pre-merge hook + branch protection enforce every gate.
   g) \`merger\` moves the ticket to Done and clears this ticket's markers
      (including required-tests.json).
4) REPORT: ticket -> surface -> status -> PR url -> merged/blocked.

RULES: never weaken the merge policy; fix causes via \`bug-fixer\`; never fabricate
a state marker. Keep subagent briefs and returns compact (token-aware).
`.trim();

const options = {
  settingSources: ["project"],
  mcpServers,
  permissionMode: "acceptEdits",
  allowedTools: ["Agent", "Read", "Write", "Edit", "Grep", "Glob", "Bash", "mcp__atlassian", "mcp__playwright"],
  canUseTool,
  model: cfg.model,
  maxTurns: cfg.maxTurns,
};

console.log(`\n▶ HEP full-stack orchestrator — mode=${MODE}, maxTickets=${MAX_TICKETS}, model=${cfg.model}\n`);
try {
  for await (const msg of query({ prompt, options })) {
    if (msg.type === "assistant") {
      for (const b of msg.message?.content ?? []) {
        if (b.type === "text" && b.text.trim()) console.log(b.text.trim());
        if (b.type === "tool_use") {
          const who = msg.parent_tool_use_id ? "  ↳ subagent" : "orchestrator";
          console.log(`\x1b[36m[${who}] → ${b.name}\x1b[0m`);
        }
      }
    } else if (msg.type === "result") {
      console.log(`\n✅ Run complete. ${msg.result ?? ""}`);
      if (msg.total_cost_usd != null) console.log(`   cost: $${msg.total_cost_usd.toFixed(4)}`);
    }
  }
} catch (err) {
  if (err?.name === "CLINotFoundError")
    console.error("Claude Code binary not found. Reinstall: npm i @anthropic-ai/claude-agent-sdk");
  else console.error("Orchestrator error:", err?.message ?? err);
  process.exit(1);
}
