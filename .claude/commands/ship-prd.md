---
description: Full-stack pipeline — plan -> Jira -> code (FE/BE) -> test -> fix -> PR -> review -> merge.
argument-hint: [path-to-architecture-or-PRD] [--parallel N]
---
You are the ORCHESTRATOR. Subagents do scoped work (they can't spawn each other).
Follow token-aware; compact state in `.claude/state/`.

SOURCE: ${ARGUMENTS:-docs/HEP_ARCHITECTURE.md}

1. THINK — `planner` writes `.claude/state/backlog.json` (stories tagged
   surface + target). Show the ranked list and STOP for approval.
2. TICKETS — `jira-ticketer`.
3. PER TICKET (respect depends_on): write `.claude/state/required-tests.json`
   for its surface, then:
   - backend  → `backend-engineer` → `api-tester`
   - frontend → `frontend-engineer` → `qa-tester`
   - fullstack→ `backend-engineer` → `api-tester`, then `frontend-engineer` → `qa-tester`
   On any test failure → `bug-fixer` → re-run the tester (≤3 attempts, else blocked).
   Then `pr-manager` (push, gh pr create, In Review) → `reviewer` (→ `bug-fixer`
   until review-approved) → wait for `ci` (`gh pr checks --watch`) → HUMAN GATE
   (confirm merge) → `merger` (gh pr merge + Done).
4. REPORT — ticket -> surface -> status -> PR -> merged/blocked.

Never weaken the merge policy; fix causes via `bug-fixer`; never fabricate a marker.
