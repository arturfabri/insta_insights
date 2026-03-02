import { describe, it, expect, vi, beforeEach } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import ExportMenu from './ExportMenu'

const mockDownloadMarkdown = vi.fn()
const mockCopyToClipboard = vi.fn().mockResolvedValue(undefined)
const mockExportPdf = vi.fn().mockResolvedValue(undefined)

vi.mock('@/lib/export/markdownExporter', () => ({
  downloadMarkdown: (...args: unknown[]) => mockDownloadMarkdown(...args),
  copyToClipboard: (...args: unknown[]) => mockCopyToClipboard(...args),
}))

vi.mock('@/lib/export/pdfExporter', () => ({
  exportBriefsToPdf: (...args: unknown[]) => mockExportPdf(...args),
}))

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}))

const briefs = [
  {
    title: 'Brief title',
    format: 'IMAGE' as const,
    hook: 'Hook',
    structure: 'Structure',
    captionDraft: 'Caption',
    cta: 'CTA',
    rationale: 'Rationale',
  },
]

describe('ExportMenu', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('opens and closes popover on click', () => {
    render(<ExportMenu briefs={briefs} goal="growth" />)

    const trigger = screen.getByRole('button', { name: /export content briefs/i })
    fireEvent.click(trigger)
    expect(screen.getByRole('dialog', { name: /export options/i })).toBeInTheDocument()

    fireEvent.click(trigger)
    expect(screen.queryByRole('dialog', { name: /export options/i })).not.toBeInTheDocument()
  })

  it('focuses first action when opened', async () => {
    render(<ExportMenu briefs={briefs} goal="growth" />)

    fireEvent.click(screen.getByRole('button', { name: /export content briefs/i }))

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /download markdown/i })).toHaveFocus()
    })
  })

  it('closes on escape and returns focus to trigger', async () => {
    render(<ExportMenu briefs={briefs} goal="growth" />)

    const trigger = screen.getByRole('button', { name: /export content briefs/i })
    fireEvent.click(trigger)
    expect(screen.getByRole('dialog', { name: /export options/i })).toBeInTheDocument()

    fireEvent.keyDown(document, { key: 'Escape' })

    await waitFor(() => {
      expect(screen.queryByRole('dialog', { name: /export options/i })).not.toBeInTheDocument()
      expect(trigger).toHaveFocus()
    })
  })
})
