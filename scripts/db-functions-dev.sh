#!/usr/bin/env bash
set -euo pipefail

DEV_REF="rsnqdfqlzqteagancgvc"

echo "🔗 Linking to DEV project: ${DEV_REF}"
export SUPABASE_ACCESS_TOKEN=sbp_9ed5f90e06631ab5f1c9cc9bc8fd97b7f8bc4ab3
npx supabase link --project-ref "${DEV_REF}" --yes

echo "➡️  Pushing functions to DEV"
npx supabase functions deploy instagram-sync --project-ref rsnqdfqlzqteagancgvc --no-verify-jwt
npx supabase functions deploy instagram-oauth --project-ref rsnqdfqlzqteagancgvc
npx supabase functions deploy token-refresh --project-ref rsnqdfqlzqteagancgvc --no-verify-jwt
npx supabase functions deploy daily-sync --project-ref rsnqdfqlzqteagancgvc --no-verify-jwt

# Confirm deployed functions
npx supabase functions list --project-ref rsnqdfqlzqteagancgvc

echo "✅ DEV functions updated"

