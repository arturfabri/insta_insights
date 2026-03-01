/**
 * AES-256-GCM token encryption/decryption using the Web Crypto API (Deno-compatible).
 * Stored format: hex(iv) + ':' + hex(ciphertext)
 */

function hexToBytes(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2)
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.slice(i, i + 2), 16)
  }
  return bytes
}

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

async function importKey(keyHex: string): Promise<CryptoKey> {
  const keyBytes = hexToBytes(keyHex)
  return crypto.subtle.importKey('raw', keyBytes, 'AES-GCM', false, [
    'encrypt',
    'decrypt',
  ])
}

export async function encryptToken(token: string, keyHex: string): Promise<string> {
  const key = await importKey(keyHex)
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const encoded = new TextEncoder().encode(token)
  const ciphertext = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, encoded)
  return `${bytesToHex(iv)}:${bytesToHex(new Uint8Array(ciphertext))}`
}

export async function decryptToken(encrypted: string, keyHex: string): Promise<string> {
  const [ivHex, ciphertextHex] = encrypted.split(':')
  const key = await importKey(keyHex)
  const iv = hexToBytes(ivHex)
  const ciphertext = hexToBytes(ciphertextHex)
  const decrypted = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, ciphertext)
  return new TextDecoder().decode(decrypted)
}
