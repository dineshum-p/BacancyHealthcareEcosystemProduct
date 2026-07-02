#!/usr/bin/env node
// PostToolUse (Bash). After `git commit`, run the AFFECTED-package quality gate
// (monorepo-aware via Turborepo). On failure exit 2 so the agent fixes forward.
import { readFileSync, mkdirSync, writeFileSync, rmSync, existsSync } from "node:fs";
import { execSync } from "node:child_process";

let payload = {};
try { payload = JSON.parse(readFileSync(0, "utf8") || "{}"); } catch {}
const cmd = payload?.tool_input?.command ?? "";
if (!/git\s+commit/.test(cmd)) process.exit(0);

const STATE = ".claude/state";
const MARKER = `${STATE}/gate-passed.json`;

// Priority: explicit override > turbo affected > root defaults.
const GATE = process.env.SHIP_GATE_CMDS
  ? process.env.SHIP_GATE_CMDS.split("&&").map(s => s.trim()).filter(Boolean)
  : existsSync("turbo.json")
    ? ["npx turbo run typecheck lint test --filter=...[origin/main] --output-logs=errors-only"]
    : ["npx tsc --noEmit", "npm run lint --if-present", "npx vitest run"];

mkdirSync(STATE, { recursive: true });
for (const step of GATE) {
  try { execSync(step, { stdio: "pipe" }); }
  catch (e) {
    rmSync(MARKER, { force: true });
    const out = (e.stdout?.toString() || "") + (e.stderr?.toString() || "");
    console.error(`❌ Quality gate failed at: ${step}\n${out.slice(-4000)}\nFix and re-commit.`);
    process.exit(2);
  }
}
let branch = "", sha = "";
try { branch = execSync("git rev-parse --abbrev-ref HEAD").toString().trim(); } catch {}
try { sha = execSync("git rev-parse HEAD").toString().trim(); } catch {}
writeFileSync(MARKER, JSON.stringify({ branch, sha, at: new Date().toISOString() }, null, 2));
console.error("✅ Quality gate passed (affected packages: typecheck, lint, tests).");
process.exit(0);
