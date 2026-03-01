/**
 * ExportMenu — dropdown to export content briefs as Markdown, PDF, or clipboard.
 */

import { useState, useRef, useEffect } from 'react'
import { toast } from 'sonner'
import { downloadMarkdown, copyToClipboard } from '@/lib/export/markdownExporter'
import { exportBriefsToPdf } from '@/lib/export/pdfExporter'
import type { ContentBrief, Goal } from '@/types/database'

interface ExportMenuProps {
  briefs: ContentBrief[]
  goal: Goal
  disabled?: boolean
}

export default function ExportMenu({ briefs, goal, disabled = false }: ExportMenuProps) {
  const [open, setOpen] = useState(false)
  const [pdfState, setPdfState] = useState<'idle' | 'exporting'>('idle')
  const menuRef = useRef<HTMLDivElement>(null)

  // Close on outside click
  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  const handleMarkdown = () => {
    downloadMarkdown(briefs, goal)
    toast.success('Markdown downloaded')
    setOpen(false)
  }

  const handleCopy = async () => {
    await copyToClipboard(briefs, goal)
    toast.success('Copied to clipboard!')
    setOpen(false)
  }

  const handlePdf = async () => {
    setPdfState('exporting')
    setOpen(false)
    try {
      await exportBriefsToPdf(goal)
      toast.success('PDF exported')
    } catch {
      toast.error('PDF export failed — please try again.')
    } finally {
      setPdfState('idle')
    }
  }

  return (
    <div className="relative" ref={menuRef}>
      <button
        onClick={() => setOpen(o => !o)}
        disabled={disabled || pdfState === 'exporting'}
        aria-label="Export content briefs"
        aria-expanded={open}
        aria-haspopup="menu"
        className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {pdfState === 'exporting' ? (
          <>
            <svg className="animate-spin h-4 w-4 text-gray-400" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
            </svg>
            Exporting…
          </>
        ) : (
          <>
            <span aria-hidden="true">↓</span>
            Export
            <span className="text-gray-400" aria-hidden="true">{open ? '↑' : '↓'}</span>
          </>
        )}
      </button>

      {open && (
        <div
          role="menu"
          aria-label="Export options"
          className="absolute right-0 top-full mt-1 w-52 bg-white border border-gray-200 rounded-xl shadow-lg z-10 overflow-hidden"
        >
          <button
            role="menuitem"
            onClick={handleMarkdown}
            className="w-full flex items-center gap-3 px-4 py-3 text-sm text-gray-700 hover:bg-gray-50 transition-colors text-left"
          >
            <span className="text-base" aria-hidden="true">📄</span>
            <div>
              <p className="font-medium">Download Markdown</p>
              <p className="text-xs text-gray-400">Notion-compatible .md file</p>
            </div>
          </button>

          <div className="border-t border-gray-100" role="separator" />

          <button
            role="menuitem"
            onClick={handleCopy}
            className="w-full flex items-center gap-3 px-4 py-3 text-sm text-gray-700 hover:bg-gray-50 transition-colors text-left"
          >
            <span className="text-base" aria-hidden="true">📋</span>
            <div>
              <p className="font-medium">Copy Notion-ready</p>
              <p className="text-xs text-gray-400">Paste directly into Notion</p>
            </div>
          </button>

          <div className="border-t border-gray-100" role="separator" />

          <button
            role="menuitem"
            onClick={handlePdf}
            className="w-full flex items-center gap-3 px-4 py-3 text-sm text-gray-700 hover:bg-gray-50 transition-colors text-left"
          >
            <span className="text-base" aria-hidden="true">📑</span>
            <div>
              <p className="font-medium">Export PDF</p>
              <p className="text-xs text-gray-400">Saves insta-insights-briefs.pdf</p>
            </div>
          </button>
        </div>
      )}
    </div>
  )
}
