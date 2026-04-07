/**
 * Shared remark/rehype plugin configuration for all ReactMarkdown instances.
 * Add new plugins here and they will be active everywhere.
 */
import remarkGfm from 'remark-gfm'
import type { Plugin } from 'unified'
import remarkCustomHeadingId from 'remark-custom-heading-id'
import remarkEmoji from 'remark-emoji'
import remarkSupersub from 'remark-supersub'
import remarkFlexibleMarkers from 'remark-flexible-markers'
import rehypeHighlight from 'rehype-highlight'

export const remarkPlugins = [
  [remarkGfm, { singleTilde: false }] as [Plugin, object], // tables, strikethrough (~~only~~), task lists, autolinks
  remarkCustomHeadingId, // ### Heading {#custom-id}
  remarkEmoji,         // :joy: → 😂
  remarkSupersub,      // H~2~O  X^2^
  remarkFlexibleMarkers, // ==highlight==
]

export const rehypePlugins = [
  rehypeHighlight,     // syntax highlighting in code blocks
]
