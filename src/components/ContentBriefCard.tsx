/**
 * ContentBriefCard — collapsible card for a single AI-generated content brief.
 * Sections: Hook, Structure, Caption Draft, CTA, Rationale.
 */

import { useState } from 'react'
import type { ContentBrief, MediaType } from '@/types/database'

interface ContentBriefCardProps {
  brief: ContentBrief
  index: number
}

const FORMAT_BADGES: Record<MediaType, { label: string; color: string }> = {
  IMAGE:          { label: 'Image',    color: 'bg-gray-100 text-gray-600' },
  VIDEO:          { label: 'Reel',     color: 'bg-purple-100 text-purple-700' },
  CAROUSEL_ALBUM: { label: 'Carousel', color: 'bg-blue-100 text-blue-700' },
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="border-t border-gray-100 pt-3 mt-3">
      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">{title}</p>
      <div className="text-sm text-gray-700 leading-relaxed whitespace-pre-line">{children}</div>
    </div>
  )
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // clipboard API not available
    }
  }

  return (
    <button
      onClick={handleCopy}
      className="text-xs text-gray-400 hover:text-brand-600 transition-colors"
      title="Copy caption"
    >
      {copied ? '✓ Copied' : 'Copy'}
    </button>
  )
}

export default function ContentBriefCard({ brief, index }: ContentBriefCardProps) {
  const [expanded, setExpanded] = useState(index === 0) // first brief open by default
  const badge = FORMAT_BADGES[brief.format] ?? FORMAT_BADGES['IMAGE']

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      {/* Header — always visible */}
      <button
        className="w-full flex items-start gap-3 p-4 text-left hover:bg-gray-50 transition-colors"
        onClick={() => setExpanded(e => !e)}
      >
        <span className="text-sm font-medium text-gray-400 w-6 shrink-0 mt-0.5">
          {index + 1}.
        </span>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-gray-900 mb-1">{brief.title}</p>
          <div className="flex items-center gap-2">
            <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${badge.color}`}>
              {badge.label}
            </span>
            <span className="text-xs text-gray-400 truncate">{brief.hook}</span>
          </div>
        </div>
        <span className="text-gray-400 shrink-0 mt-0.5">
          {expanded ? '↑' : '↓'}
        </span>
      </button>

      {/* Collapsible body */}
      {expanded && (
        <div className="px-4 pb-4">
          <Section title="Hook">
            {brief.hook}
          </Section>

          <Section title="Structure">
            {brief.structure}
          </Section>

          <Section title="Caption draft">
            <div className="flex justify-between items-start gap-2">
              <span className="flex-1">{brief.captionDraft}</span>
              <CopyButton text={brief.captionDraft} />
            </div>
          </Section>

          <Section title="Call to action">
            {brief.cta}
          </Section>

          <div className="border-t border-gray-100 pt-3 mt-3">
            <p className="text-xs text-gray-400 italic">{brief.rationale}</p>
          </div>
        </div>
      )}
    </div>
  )
}
