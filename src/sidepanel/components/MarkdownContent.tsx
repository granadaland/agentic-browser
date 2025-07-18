import React from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import remarkSqueezeParagraphs from 'remark-squeeze-paragraphs'
import rehypeRaw from 'rehype-raw'
import rehypeSanitize from 'rehype-sanitize'
import styles from '../styles/components/MarkdownContent.module.scss'
import { cn } from '@/sidepanel/lib/utils'

interface MarkdownContentProps {
  content: string
  className?: string
  forceMarkdown?: boolean  // Force markdown rendering even if not detected
  skipMarkdown?: boolean  // Skip markdown rendering even if detected
}

// Lightweight regex to detect markdown patterns
// Includes common markdown indicators and double newlines
const MARKDOWN_PATTERNS = /[#_*~`>|!\[\]-]|\n\n/

/**
 * Checks if content looks like markdown
 */
function looksLikeMarkdown(content: string): boolean {
  return MARKDOWN_PATTERNS.test(content)
}

/**
 * Component that intelligently renders markdown or plain text content
 */
export function MarkdownContent({ 
  content, 
  className, 
  forceMarkdown = false,
  skipMarkdown = false
}: MarkdownContentProps): JSX.Element {
  // Determine if we should render as markdown
  const shouldRenderMarkdown = forceMarkdown || (!skipMarkdown && looksLikeMarkdown(content))
  
  // Plain text rendering path
  if (!shouldRenderMarkdown) {
    return (
      <div className={cn(
        styles.container, 
        styles.plainText, 
        styles.compact,  // Always use compact mode
        className
      )}>
        <span style={{ whiteSpace: 'pre-wrap' }}>{content}</span>
      </div>
    )
  }

  // Build remark plugins array
  const remarkPlugins = [
    remarkGfm,
    remarkSqueezeParagraphs  // Automatically removes empty paragraphs and excessive blank lines
  ]
  
  // For tool results, we might want to apply additional formatting in the future
  // For now, the squeeze paragraphs plugin will handle the whitespace cleanup

  // Markdown rendering path with react-markdown
  return (
    <div className={cn(
      styles.container, 
      styles.markdown,
      styles.compact,  // Always use compact mode
      className
    )}>
      <ReactMarkdown
        remarkPlugins={remarkPlugins}
        rehypePlugins={[rehypeRaw, rehypeSanitize]}
        components={{
          // Style links
          a: ({ node, ...props }) => (
            <a {...props} className={styles.link} target="_blank" rel="noopener noreferrer" />
          ),
          // Style inline code
          code: ({ className, children, ...props }) => {
            const inline = !('data-language' in props)
            if (inline) {
              return <code className={styles.inlineCode} {...props}>{children}</code>
            }
            // Code blocks
            return (
              <pre className={styles.codeBlock}>
                <code className={className} {...props}>{children}</code>
              </pre>
            )
          },
          // Style blockquotes
          blockquote: ({ node, ...props }) => (
            <blockquote className={styles.blockquote} {...props} />
          ),
          // Style tables
          table: ({ node, ...props }) => (
            <div className={styles.tableWrapper}>
              <table className={styles.table} {...props} />
            </div>
          ),
          // Style list items with proper spacing
          ul: ({ node, ...props }) => (
            <ul className={styles.list} {...props} />
          ),
          ol: ({ node, ...props }) => (
            <ol className={styles.orderedList} {...props} />
          ),
          // Style paragraphs
          p: ({ node, ...props }) => (
            <p className={styles.paragraph} {...props} />
          ),
          // Style headings
          h1: ({ node, ...props }) => <h1 className={styles.heading1} {...props} />,
          h2: ({ node, ...props }) => <h2 className={styles.heading2} {...props} />,
          h3: ({ node, ...props }) => <h3 className={styles.heading3} {...props} />,
          h4: ({ node, ...props }) => <h4 className={styles.heading4} {...props} />,
          h5: ({ node, ...props }) => <h5 className={styles.heading5} {...props} />,
          h6: ({ node, ...props }) => <h6 className={styles.heading6} {...props} />,
          // Style horizontal rules
          hr: ({ node, ...props }) => <hr className={styles.divider} {...props} />,
          // Handle task lists (from remark-gfm)
          input: ({ node, ...props }) => {
            if (props.type === 'checkbox') {
              return <input className={styles.taskCheckbox} {...props} disabled />
            }
            return <input {...props} />
          }
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  )
}