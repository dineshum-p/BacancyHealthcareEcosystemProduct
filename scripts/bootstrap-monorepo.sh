#!/usr/bin/env bash
# Scaffold the HEP monorepo skeleton: web app, first service, shared package.
set -euo pipefail

# Frontend: Next.js 14
if [ ! -d apps/web ]; then
  npx create-next-app@latest apps/web --ts --app --tailwind --eslint --no-src-dir --use-npm --yes
fi

# Backend: first NestJS service (repeat per service in services/*)
if [ ! -d services/tenant ]; then
  npx @nestjs/cli new services/tenant --package-manager npm --skip-git --language TS
fi

# Shared TS types package consumed by both FE and BE
mkdir -p packages/shared-types/src
[ -f packages/shared-types/package.json ] || cat > packages/shared-types/package.json <<'JSON'
{ "name": "@hep/shared-types", "version": "0.0.0", "main": "src/index.ts", "types": "src/index.ts",
  "scripts": { "build": "tsc -p .", "typecheck": "tsc --noEmit", "lint": "eslint .", "test": "vitest run --passWithNoTests" } }
JSON
[ -f packages/shared-types/src/index.ts ] || echo "export type TenantId = string;" > packages/shared-types/src/index.ts

# Make sure every workspace exposes typecheck/lint/test scripts the gate expects.
echo "✅ Skeleton ready. Add typecheck/lint/test scripts to each new service, then:"
echo "   npm install && npx turbo run build --dry"
