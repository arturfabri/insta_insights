#!/usr/bin/env bash
set -euo pipefail

DEV_REF="rsnqdfqlzqteagancgvc"

echo "🔗 Linking to DEV project: ${DEV_REF}"
npx supabase link --project-ref "${DEV_REF}" --yes

echo "➡️  Pushing migrations to DEV"
npx supabase db push

echo "✅ DEV database updated"

