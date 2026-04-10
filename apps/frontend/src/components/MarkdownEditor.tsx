import { useState } from 'react'
import ReactMarkdown from 'react-markdown'
import { remarkPlugins, rehypePlugins } from '@/lib/markdown'

interface Props {
  value: string
  onChange: (value: string) => void
  rows?: number
  placeholder?: string
}

export default function MarkdownEditor({ value, onChange, rows = 6, placeholder }: Props) {
  const [activeTab, setActiveTab] = useState<'write' | 'preview'>('write')
  const minHeight = `${rows * 1.6}em`

  return (
    <div className="md-editor">
      {/* Tab bar — only visible on mobile via CSS */}
      <div className="md-tabs">
        <button
          className={`md-tab${activeTab === 'write' ? ' active' : ''}`}
          onClick={() => setActiveTab('write')}
        >
          Write
        </button>
        <button
          className={`md-tab${activeTab === 'preview' ? ' active' : ''}`}
          onClick={() => setActiveTab('preview')}
        >
          Preview
        </button>
      </div>

      {/* Write pane — hidden via CSS when preview tab is active on mobile */}
      <div className={`md-editor-pane${activeTab !== 'write' ? ' md-pane-hidden' : ''}`}>
        <div className="md-editor-pane-label">Write</div>
        <textarea
          className="form-input form-textarea md-editor-textarea"
          style={{ minHeight }}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder ?? 'Markdown supported…'}
        />
      </div>

      <div className="md-editor-divider" />

      {/* Preview pane — hidden via CSS when write tab is active on mobile */}
      <div className={`md-editor-pane${activeTab !== 'preview' ? ' md-pane-hidden' : ''}`}>
        <div className="md-editor-pane-label">Preview</div>
        <div className="md-editor-preview prose" style={{ minHeight }}>
          {value.trim() ? (
            <ReactMarkdown remarkPlugins={remarkPlugins} rehypePlugins={rehypePlugins}>
              {value}
            </ReactMarkdown>
          ) : (
            <span className="text-light" style={{ fontSize: 13 }}>Nothing to preview.</span>
          )}
        </div>
      </div>
    </div>
  )
}
