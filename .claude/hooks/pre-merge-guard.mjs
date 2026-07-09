#!/usr/bin/env node
// PreToolUse (Bash). Guards `gh pr merge`: blocks unless the quality + review
// markers exist AND every test marker required for this ticket's surface exists.
// Required test markers come from .claude/state/required-tests.json (written by
// the orchestrator per ticket). Deterministic, model-independent.
import { readFileSync, existsSync } from "node:fs";
import { execSync } from "node:child_process";

let payload = {};
try { payload = JSON.parse(readFileSync(0, "utf8") || "{}"); } catch {}
const cmd = payload?.tool_input?.command ?? "";
if (!/gh\s+pr\s+merge/.test(cmd)) process.exit(0);

const STATE = ".claude/state";
let branch = "";
try { branch = execSync("git rev-parse --abbrev-ref HEAD").toString().trim(); } catch {}

// Which test markers are required? Default to both if unspecified.
let requiredTests = ["e2e-tests-passed", "api-tests-passed"];
try {
  const rt = JSON.parse(readFileSync(`${STATE}/required-tests.json`, "utf8"));
  if (Array.isArray(rt.markers) && rt.markers.length) requiredTests = rt.markers;
} catch {}

const required = [
  ["gate-passed.json", "quality gate (typecheck / lint / tests)"],
  ["review-approved",  "code review, no blocking findings"],
  ...requiredTests.map(m => [m, `tests: ${m}`]),
];

const missing = required.filter(([f]) => !existsSync(`${STATE}/${f}`));
if (missing.length) {
  console.error(
    "⛔ Merge blocked. Missing required gates:\n" +
    missing.map(([, d]) => `  - ${d}`).join("\n") +
    `\nBranch: ${branch}. Complete these, then retry the merge.`
  );
  process.exit(2);
}
try {
  const g = JSON.parse(readFileSync(`${STATE}/gate-passed.json`, "utf8"));
  if (g.branch && branch && g.branch !== branch) {
    console.error(`⛔ Merge blocked: gate marker is for '${g.branch}', not '${branch}'.`);
    process.exit(2);
  }
} catch {}
console.error("✅ All required gates present for this branch — merge allowed.");
process.exit(0);
