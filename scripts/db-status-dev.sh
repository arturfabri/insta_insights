#!/usr/bin/env bash
set -euo pipefail

DEV_REF="rsnqdfqlzqteagancgvc"

npx supabase link --project-ref "${DEV_REF}" --yes
npx supabase migration list
