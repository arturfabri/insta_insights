#!/usr/bin/env bash
set -euo pipefail

DEV_REF="rsnqdfqlzqteagancgvc"

echo "🔗 Linking to DEV project: ${DEV_REF}"
export SUPABASE_ACCESS_TOKEN=sbp_9ed5f90e06631ab5f1c9cc9bc8fd97b7f8bc4ab3
npx supabase link --project-ref "${DEV_REF}" --yes

echo "➡️  Pushing migrations to DEV"
npx supabase db push

echo "✅ DEV database updated"

