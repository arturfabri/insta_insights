import { describe, expect, it } from 'vitest'
import { buildProviderErrorDiagnostics } from './provider-error-diagnostics'

describe('buildProviderErrorDiagnostics', () => {
  it('prioritizes media error text and includes all populated scopes', () => {
    const result = buildProviderErrorDiagnostics({
      media: '[code 100] media unsupported',
      account: '[code 100] account unsupported',
      businessDiscovery: '[code 10] permissions error',
    })

    expect(result.providerErrorText).toBe('[code 100] media unsupported')
    expect(result.providerErrorDetails).toEqual({
      media: '[code 100] media unsupported',
      account: '[code 100] account unsupported',
      business_discovery: '[code 10] permissions error',
    })
  })

  it('returns null and empty object for clean runs', () => {
    const result = buildProviderErrorDiagnostics({
      media: null,
      account: null,
      businessDiscovery: null,
    })

    expect(result.providerErrorText).toBeNull()
    expect(result.providerErrorDetails).toEqual({})
  })

  it('trims whitespace and ignores blank values', () => {
    const result = buildProviderErrorDiagnostics({
      media: '   ',
      account: ' [code 4] temporarily unavailable  ',
      businessDiscovery: '',
    })

    expect(result.providerErrorText).toBe('[code 4] temporarily unavailable')
    expect(result.providerErrorDetails).toEqual({
      account: '[code 4] temporarily unavailable',
    })
  })
})
