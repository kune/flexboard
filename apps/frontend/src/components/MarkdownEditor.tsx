import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import rehypeHighlight from 'rehype-highlight'

interface Props {
  value: string
  onChange: (value: string) => void
  rows?: number
  placeholder?: string
}

export default function MarkdownEditor({ value, onChange, rows = 6, placeholder }: Props) {
  const minHeight = `${rows * 1.6}em`

  return (
    <div className="md-editor">
      <div className="md-editor-pane">
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
      <div className="md-editor-pane">
        <div className="md-editor-pane-label">Preview</div>
        <div className="md-editor-preview prose" style={{ minHeight }}>
          {value.trim() ? (
            <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeHighlight]}>
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
