import { createClient } from '@supabase/supabase-js'

const REQUIRED_ENV = [
  'VITE_SUPABASE_URL',
  'VITE_SUPABASE_ANON_KEY',
  'SECURITY_TEST_OWNER_EMAIL',
  'SECURITY_TEST_OWNER_PASSWORD',
  'SECURITY_TEST_OTHER_EMAIL',
  'SECURITY_TEST_OTHER_PASSWORD',
]

function fail(message) {
  console.error(`[security-smoke] ${message}`)
  process.exit(1)
}

function log(message) {
  console.log(`[security-smoke] ${message}`)
}

function hasRequiredEnv() {
  return REQUIRED_ENV.every((name) => process.env[name] && process.env[name].trim().length > 0)
}

function shouldSkipLocally() {
  return process.env.CI !== 'true' && !hasRequiredEnv()
}

function assertSafeTarget(urlValue) {
  let host
  try {
    host = new URL(urlValue).hostname
  } catch {
    fail(`Invalid VITE_SUPABASE_URL: ${urlValue}`)
  }

  if (/(prod|production)/i.test(host)) {
    fail(`Refusing to run against production-like host: ${host}`)
  }

  const allowedProjectRef = process.env.SECURITY_TEST_ALLOWED_PROJECT_REF
  if (allowedProjectRef && !host.startsWith(`${allowedProjectRef}.supabase.co`)) {
    fail(`Host ${host} does not match SECURITY_TEST_ALLOWED_PROJECT_REF=${allowedProjectRef}`)
  }
}

async function signIn(client, email, password, label) {
  const { error } = await client.auth.signInWithPassword({ email, password })
  if (error) {
    fail(`Failed to sign in ${label} user: ${error.message}`)
  }
}

async function main() {
  if (shouldSkipLocally()) {
    log('Skipping live smoke test (set SECURITY_TEST_* env vars to run locally).')
    process.exit(0)
  }

  if (!hasRequiredEnv()) {
    fail(`Missing required environment variables: ${REQUIRED_ENV.filter((name) => !process.env[name]).join(', ')}`)
  }

  const url = process.env.VITE_SUPABASE_URL
  const anonKey = process.env.VITE_SUPABASE_ANON_KEY
  assertSafeTarget(url)

  const ownerClient = createClient(url, anonKey)
  const otherClient = createClient(url, anonKey)

  await signIn(
    ownerClient,
    process.env.SECURITY_TEST_OWNER_EMAIL,
    process.env.SECURITY_TEST_OWNER_PASSWORD,
    'owner',
  )

  await signIn(
    otherClient,
    process.env.SECURITY_TEST_OTHER_EMAIL,
    process.env.SECURITY_TEST_OTHER_PASSWORD,
    'other',
  )

  const { data: ownerAccount, error: ownerAccountError } = await ownerClient
    .from('instagram_accounts')
    .select('id,user_id')
    .limit(1)
    .maybeSingle()

  if (ownerAccountError || !ownerAccount) {
    fail('Owner user has no instagram_accounts row to validate against')
  }

  const { data: deniedRows, error: deniedReadError } = await otherClient
    .from('instagram_accounts')
    .select('id')
    .eq('id', ownerAccount.id)

  if (deniedReadError) {
    fail(`Unexpected error when testing denied cross-user read: ${deniedReadError.message}`)
  }

  if ((deniedRows ?? []).length !== 0) {
    fail('Cross-user read was allowed unexpectedly')
  }

  const { data: allowedRows, error: allowedReadError } = await ownerClient
    .from('instagram_accounts')
    .select('id')
    .eq('id', ownerAccount.id)

  if (allowedReadError || !allowedRows || allowedRows.length === 0) {
    fail(`Owner read failed unexpectedly: ${allowedReadError?.message ?? 'no rows returned'}`)
  }

  const { error: updateError } = await ownerClient
    .from('instagram_accounts')
    .update({ sync_error: 'security-smoke-test' })
    .eq('id', ownerAccount.id)

  if (!updateError) {
    fail('Direct user update to instagram_accounts unexpectedly succeeded')
  }

  await ownerClient.auth.signOut()
  await otherClient.auth.signOut()

  log('Passed: denied cross-user read, allowed own read, denied direct account update.')
}

main().catch((error) => {
  fail(error instanceof Error ? error.message : String(error))
})
