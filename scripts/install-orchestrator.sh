#!/usr/bin/env bash
set -euo pipefail
npm i -D @anthropic-ai/claude-agent-sdk
echo "✅ Agent SDK installed. Scripts already in package.json:"
echo "   npm run auto:one   (1 ticket, human merges)   |   MODE=auto npm run auto"
