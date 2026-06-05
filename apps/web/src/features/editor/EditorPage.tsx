import { useEffect, useRef, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Collaboration from '@tiptap/extension-collaboration'
import CollaborationCursor from '@tiptap/extension-collaboration-cursor'
import Placeholder from '@tiptap/extension-placeholder'
import Underline from '@tiptap/extension-underline'
import Link from '@tiptap/extension-link'
import Image from '@tiptap/extension-image'
import TaskList from '@tiptap/extension-task-list'
import TaskItem from '@tiptap/extension-task-item'
import CodeBlockLowlight from '@tiptap/extension-code-block-lowlight'
import { common, createLowlight } from 'lowlight'
import { Note } from '@collab-notes/types'
import { api } from '../../lib/api'
import { useAuthStore } from '../auth/auth.store'
import { getYDoc } from '../../lib/ydoc'
import { createCollabProvider } from '../../lib/ws-provider'
import EditorToolbar from './EditorToolbar'
import ConnectionStatus from './ConnectionStatus'
import CommentPanel from './CommentPanel'

const lowlight = createLowlight(common)

export default function EditorPage() {
  const { workspaceId, noteId } = useParams<{ workspaceId: string; noteId: string }>()
  const navigate = useNavigate()
  const user = useAuthStore((s) => s.user)
  const qc = useQueryClient()
  const providerRef = useRef<ReturnType<typeof createCollabProvider> | null>(null)
  const [connectionStatus, setConnectionStatus] = useState<'connected' | 'disconnected' | 'connecting'>('connecting')
  const [showComments, setShowComments] = useState(false)
  const [titleEditing, setTitleEditing] = useState(false)

  const { data: note } = useQuery({
    queryKey: ['note', noteId],
    queryFn: () => api.get<Note>(`/notes/${noteId}`),
    enabled: !!noteId,
  })

  const updateTitle = useMutation({
    mutationFn: (title: string) => api.patch<Note>(`/notes/${noteId}`, { title }),
    onSuccess: (updated) => qc.setQueryData(['note', noteId], updated),
  })

  const deleteNote = useMutation({
    mutationFn: () => api.delete(`/notes/${noteId}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['notes', workspaceId] })
      navigate(`/w/${workspaceId}`)
    },
  })

  const ydoc = noteId ? getYDoc(noteId) : null

  const editor = useEditor({
    extensions: [
      StarterKit.configure({ history: false }),
      Underline,
      Link.configure({ openOnClick: false }),
      Image,
      TaskList,
      TaskItem.configure({ nested: true }),
      CodeBlockLowlight.configure({ lowlight }),
      Placeholder.configure({ placeholder: 'Start writing…' }),
      ...(ydoc
        ? [
            Collaboration.configure({ document: ydoc }),
            CollaborationCursor.configure({
              provider: (() => {
                // Provider is set after mount
                return providerRef.current?.wsProvider
              })(),
              user: {
                name: user?.name || 'Anonymous',
                color: '#6366f1',
              },
            }),
          ]
        : []),
    ],
    editorProps: {
      attributes: { class: 'tiptap focus:outline-none h-full' },
    },
  })

  // Setup collab providers
  useEffect(() => {
    if (!noteId || !ydoc || !user) return

    const provider = createCollabProvider(noteId, ydoc, {
      id: user.id,
      name: user.name,
    })
    providerRef.current = provider

    provider.wsProvider.on('status', ({ status }: { status: string }) => {
      setConnectionStatus(status as 'connected' | 'disconnected' | 'connecting')
    })

    return () => {
      provider.destroy()
      providerRef.current = null
    }
  }, [noteId, ydoc, user])

  // Destroy editor on unmount
  useEffect(() => {
    return () => {
      editor?.destroy()
    }
  }, [editor])

  if (!noteId) return null

  return (
    <div className="flex h-screen bg-surface-950 overflow-hidden">
      {/* Main editor */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Editor header */}
        <header className="flex items-center gap-3 px-6 py-3 border-b border-surface-800 flex-shrink-0">
          <button
            onClick={() => navigate(`/w/${workspaceId}`)}
            className="p-1.5 rounded-lg text-zinc-500 hover:text-zinc-300 hover:bg-surface-800 transition-all"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>

          {/* Editable title */}
          {titleEditing ? (
            <input
              autoFocus
              defaultValue={note?.title || 'Untitled'}
              onBlur={(e) => { updateTitle.mutate(e.target.value); setTitleEditing(false) }}
              onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur() }}
              className="flex-1 bg-transparent text-lg font-semibold text-white outline-none border-b border-brand-500"
            />
          ) : (
            <h1
              className="flex-1 text-lg font-semibold text-zinc-200 truncate cursor-pointer hover:text-white transition-colors"
              onClick={() => setTitleEditing(true)}
            >
              {note?.title || 'Untitled'}
            </h1>
          )}

          <div className="flex items-center gap-2">
            <ConnectionStatus status={connectionStatus} />

            <button
              onClick={() => setShowComments(!showComments)}
              className={`p-1.5 rounded-lg transition-all ${showComments ? 'bg-brand-500/20 text-brand-400' : 'text-zinc-500 hover:text-zinc-300 hover:bg-surface-800'}`}
              title="Comments"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-3 3-3-3z" />
              </svg>
            </button>

            <button
              onClick={() => { if (confirm('Delete this note?')) deleteNote.mutate() }}
              className="p-1.5 rounded-lg text-zinc-600 hover:text-red-400 hover:bg-red-400/10 transition-all"
              title="Delete note"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </button>
          </div>
        </header>

        {/* Toolbar */}
        {editor && <EditorToolbar editor={editor} />}

        {/* Editor content */}
        <div className="flex-1 overflow-y-auto">
          <div className="max-w-3xl mx-auto px-8 py-10 min-h-full">
            <EditorContent editor={editor} className="min-h-full" />
          </div>
        </div>
      </div>

      {/* Comments panel */}
      {showComments && (
        <CommentPanel noteId={noteId} workspaceId={workspaceId!} user={user} />
      )}
    </div>
  )
}
