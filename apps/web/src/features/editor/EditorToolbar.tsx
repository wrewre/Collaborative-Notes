import { Editor } from '@tiptap/react'

interface EditorToolbarProps {
  editor: Editor
}

export default function EditorToolbar({ editor }: EditorToolbarProps) {
  const btn = (
    active: boolean,
    onClick: () => void,
    title: string,
    children: React.ReactNode,
  ) => (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className={`p-1.5 rounded transition-all ${
        active
          ? 'bg-brand-500/20 text-brand-400'
          : 'text-zinc-500 hover:text-zinc-300 hover:bg-surface-700'
      }`}
    >
      {children}
    </button>
  )

  return (
    <div className="flex items-center gap-0.5 px-4 py-2 border-b border-surface-800 bg-surface-900/50 flex-wrap">
      {/* Text formatting */}
      {btn(editor.isActive('bold'), () => editor.chain().focus().toggleBold().run(), 'Bold',
        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M15.6 10.79c.97-.67 1.65-1.77 1.65-2.79 0-2.26-1.75-4-4-4H7v14h7.04c2.09 0 3.71-1.7 3.71-3.79 0-1.52-.86-2.82-2.15-3.42zM10 6.5h3c.83 0 1.5.67 1.5 1.5s-.67 1.5-1.5 1.5h-3v-3zm3.5 9H10v-3h3.5c.83 0 1.5.67 1.5 1.5s-.67 1.5-1.5 1.5z"/></svg>
      )}
      {btn(editor.isActive('italic'), () => editor.chain().focus().toggleItalic().run(), 'Italic',
        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M10 4v3h2.21l-3.42 8H6v3h8v-3h-2.21l3.42-8H18V4z"/></svg>
      )}
      {btn(editor.isActive('underline'), () => editor.chain().focus().toggleUnderline().run(), 'Underline',
        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M12 17c3.31 0 6-2.69 6-6V3h-2.5v8c0 1.93-1.57 3.5-3.5 3.5S8.5 12.93 8.5 11V3H6v8c0 3.31 2.69 6 6 6zm-7 2v2h14v-2H5z"/></svg>
      )}
      {btn(editor.isActive('strike'), () => editor.chain().focus().toggleStrike().run(), 'Strikethrough',
        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M6.85 7.08C6.85 4.37 9.45 3 12.24 3c1.64 0 3 .49 3.9 1.28.77.65 1.46 1.73 1.46 3.24h-3.01c0-.31-.05-.59-.15-.85-.29-.86-1.2-1.28-2.25-1.28-1.86 0-2.34.92-2.34 1.69 0 .48.25.88.74 1.21L6.85 7.08zM21 12h-9.22l-.49-.86c-.38-.68-.56-1.22-.56-1.77 0-.61.29-1.42 2.34-1.42 1.23 0 2.1.49 2.3 1.28h2.95c-.1-1.59-.94-2.66-1.92-3.34C16 5.26 14.58 5 13.17 5c-1.48 0-2.93.39-3.92 1.31-1 .93-1.27 2.07-1.27 2.95 0 .31.03.6.08.88H3v2h18v-2zm-8.58 6.56c.03.15.04.3.04.44 0 1.7-1.5 2.11-2.9 2.11-1.72 0-2.89-.77-2.89-2.02H4.63c.07 1.63 1.25 2.83 2.69 3.3C8.14 22.63 9.1 23 10.56 23c1.58 0 3.17-.41 4.12-1.29.95-.88 1.26-2.03 1.26-2.9 0-.17-.01-.34-.03-.5L12.42 18.56z"/></svg>
      )}
      {btn(editor.isActive('code'), () => editor.chain().focus().toggleCode().run(), 'Inline code',
        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M9.4 16.6L4.8 12l4.6-4.6L8 6l-6 6 6 6 1.4-1.4zm5.2 0l4.6-4.6-4.6-4.6L16 6l6 6-6 6-1.4-1.4z"/></svg>
      )}

      <div className="w-px h-5 bg-surface-700 mx-1" />

      {/* Headings */}
      {(['h1', 'h2', 'h3'] as const).map((level, i) => {
        const n = (i + 1) as 1 | 2 | 3
        return btn(
          editor.isActive('heading', { level: n }),
          () => editor.chain().focus().toggleHeading({ level: n }).run(),
          `Heading ${n}`,
          <span className="text-xs font-bold font-mono">H{n}</span>
        )
      })}

      <div className="w-px h-5 bg-surface-700 mx-1" />

      {/* Lists */}
      {btn(editor.isActive('bulletList'), () => editor.chain().focus().toggleBulletList().run(), 'Bullet list',
        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M4 10.5c-.83 0-1.5.67-1.5 1.5s.67 1.5 1.5 1.5 1.5-.67 1.5-1.5-.67-1.5-1.5-1.5zm0-6c-.83 0-1.5.67-1.5 1.5S3.17 7.5 4 7.5 5.5 6.83 5.5 6 4.83 4.5 4 4.5zm0 12c-.83 0-1.5.68-1.5 1.5s.68 1.5 1.5 1.5 1.5-.68 1.5-1.5-.67-1.5-1.5-1.5zM7 19h14v-2H7v2zm0-6h14v-2H7v2zm0-8v2h14V5H7z"/></svg>
      )}
      {btn(editor.isActive('orderedList'), () => editor.chain().focus().toggleOrderedList().run(), 'Ordered list',
        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M2 17h2v.5H3v1h1v.5H2v1h3v-4H2v1zm1-9h1V4H2v1h1v3zm-1 3h1.8L2 13.1v.9h3v-1H3.2L5 10.9V10H2v1zm5-6v2h14V5H7zm0 14h14v-2H7v2zm0-6h14v-2H7v2z"/></svg>
      )}
      {btn(editor.isActive('taskList'), () => editor.chain().focus().toggleTaskList().run(), 'Task list',
        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-9 14l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/></svg>
      )}

      <div className="w-px h-5 bg-surface-700 mx-1" />

      {/* Code block & blockquote */}
      {btn(editor.isActive('codeBlock'), () => editor.chain().focus().toggleCodeBlock().run(), 'Code block',
        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M20 3H4v10c0 2.21 1.79 4 4 4h6c2.21 0 4-1.79 4-4v-3h2c1.11 0 2-.89 2-2V5c0-1.11-.89-2-2-2zm0 5h-2V5h2v3zM4 19h16v2H4z"/></svg>
      )}
      {btn(editor.isActive('blockquote'), () => editor.chain().focus().toggleBlockquote().run(), 'Blockquote',
        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M6 17h3l2-4V7H5v6h3zm8 0h3l2-4V7h-6v6h3z"/></svg>
      )}

      <div className="w-px h-5 bg-surface-700 mx-1" />

      {/* Undo / Redo */}
      {btn(false, () => editor.chain().focus().undo().run(), 'Undo',
        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M12.5 8c-2.65 0-5.05.99-6.9 2.6L2 7v9h9l-3.62-3.62c1.39-1.16 3.16-1.88 5.12-1.88 3.54 0 6.55 2.31 7.6 5.5l2.37-.78C21.08 11.03 17.15 8 12.5 8z"/></svg>
      )}
      {btn(false, () => editor.chain().focus().redo().run(), 'Redo',
        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M18.4 10.6C16.55 8.99 14.15 8 11.5 8c-4.65 0-8.58 3.03-9.96 7.22L3.9 16c1.05-3.19 4.05-5.5 7.6-5.5 1.95 0 3.73.72 5.12 1.88L13 16h9V7l-3.6 3.6z"/></svg>
      )}
    </div>
  )
}
