import { Link } from 'react-router-dom'
import { Note } from '@collab-notes/types'
import { formatDistanceToNow } from 'date-fns'

interface NoteListProps {
  notes: Note[]
  loading: boolean
  search: string
  onSearchChange: (s: string) => void
  onCreateNote: () => void
  workspaceId: string
  selectedFolder: string | null
}

export default function NoteList({
  notes, loading, search, onSearchChange, onCreateNote, workspaceId
}: NoteListProps) {
  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-3 px-6 py-4 border-b border-surface-800">
        <div className="flex-1 relative">
          <svg className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search notes..."
            className="w-full bg-surface-800 border border-surface-700 rounded-lg pl-9 pr-4 py-2 text-sm text-zinc-300 placeholder-zinc-600 focus:outline-none focus:ring-2 focus:ring-brand-500/50 focus:border-brand-500 transition-all"
          />
        </div>
        <button
          onClick={onCreateNote}
          className="flex items-center gap-1.5 gradient-brand text-white text-sm font-medium px-4 py-2 rounded-lg hover:opacity-90 active:scale-[0.98] transition-all shadow-lg shadow-brand-500/20 flex-shrink-0"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          New note
        </button>
      </div>

      {/* Note list */}
      <div className="flex-1 overflow-y-auto p-4">
        {loading ? (
          <div className="space-y-3">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="animate-pulse bg-surface-800 rounded-xl h-20" />
            ))}
          </div>
        ) : notes.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center py-20">
            <div className="w-16 h-16 rounded-2xl gradient-brand/20 border border-brand-500/20 flex items-center justify-center mb-4">
              <svg className="w-8 h-8 text-brand-500/50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <p className="text-zinc-400 font-medium mb-1">
              {search ? 'No notes match your search' : 'No notes yet'}
            </p>
            <p className="text-zinc-600 text-sm mb-6">
              {search ? 'Try different keywords' : 'Create your first note to get started'}
            </p>
            {!search && (
              <button
                onClick={onCreateNote}
                className="gradient-brand text-white text-sm px-5 py-2 rounded-lg hover:opacity-90 transition-all"
              >
                Create note
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-2">
            {notes.map((note) => (
              <Link
                key={note.id}
                to={`/w/${workspaceId}/notes/${note.id}`}
                className="group block glass rounded-xl p-4 hover:border-brand-500/30 hover:bg-white/[0.07] transition-all animate-fade-in"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <h3 className="font-medium text-zinc-200 truncate group-hover:text-white transition-colors">
                      {note.title || 'Untitled'}
                    </h3>
                    <p className="text-xs text-zinc-600 mt-0.5">
                      {formatDistanceToNow(new Date(note.updatedAt), { addSuffix: true })}
                    </p>
                  </div>
                  <svg className="w-4 h-4 text-zinc-700 group-hover:text-brand-400 transition-colors flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
