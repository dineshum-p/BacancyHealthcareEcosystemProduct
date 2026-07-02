#!/usr/bin/env bash
# Require the `ci` check + 1 review before anything can merge to main.
# Usage: ./scripts/setup-branch-protection.sh OWNER/REPO
set -euo pipefail
REPO="${1:?Usage: setup-branch-protection.sh OWNER/REPO}"
gh api -X PUT "repos/${REPO}/branches/main/protection" --input - <<'JSON'
{
  "required_status_checks": { "strict": true, "contexts": ["ci"] },
  "enforce_admins": false,
  "required_pull_request_reviews": { "required_approving_review_count": 1 },
  "restrictions": null,
  "allow_force_pushes": false,
  "allow_deletions": false
}
JSON
echo "✅ Branch protection set on ${REPO}:main (requires ci + 1 review)."
