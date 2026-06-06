import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { UserButton, useUser } from '@clerk/clerk-react'
import { Folder, Workspace, User } from '@collab-notes/types'
import { api } from '../../lib/api'

interface SidebarProps {
  workspace?: Workspace & { role: string }
  workspaces: (Workspace & { role: string })[]
  folders: Folder[]
  selectedFolder: string | null
  onFolderSelect: (id: string | null) => void
  user: User | null
  workspaceId: string
}

export default function Sidebar({
  workspace, workspaces, folders, selectedFolder, onFolderSelect, user, workspaceId
}: SidebarProps) {
  const navigate = useNavigate()
  const { user: clerkUser } = useUser()
  const qc = useQueryClient()
  const [showNewFolder, setShowNewFolder] = useState(false)
  const [newFolderName, setNewFolderName] = useState('')
  const [showWsList, setShowWsList] = useState(false)

  const createFolder = useMutation({
    mutationFn: (name: string) => api.post<Folder>(`/workspaces/${workspaceId}/folders`, { name }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['folders', workspaceId] })
      setShowNewFolder(false)
      setNewFolderName('')
    },
  })

  return (
    <aside className="w-64 bg-surface-900 border-r border-surface-800 flex flex-col h-full">
      {/* Workspace selector */}
      <div className="p-4 border-b border-surface-800">
        <button
          onClick={() => setShowWsList(!showWsList)}
          className="w-full flex items-center gap-2.5 p-2 rounded-lg hover:bg-surface-800 transition-colors group"
        >
          <div className="w-8 h-8 rounded-lg gradient-brand flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
            {workspace?.name?.charAt(0).toUpperCase() || 'W'}
          </div>
          <div className="flex-1 text-left min-w-0">
            <p className="text-sm font-semibold text-zinc-100 truncate">{workspace?.name || 'Loading...'}</p>
            <p className="text-xs text-zinc-500 capitalize">{workspace?.role || ''}</p>
          </div>
          <svg className={`w-4 h-4 text-zinc-500 transition-transform ${showWsList ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        {/* Workspace list dropdown */}
        {showWsList && (
          <div className="mt-2 space-y-1 animate-fade-in">
            {workspaces.map((ws) => (
              <button
                key={ws.id}
                onClick={() => { navigate(`/w/${ws.id}`); setShowWsList(false) }}
                className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${ws.id === workspaceId ? 'bg-brand-500/20 text-brand-300' : 'hover:bg-surface-800 text-zinc-400'}`}
              >
                {ws.name}
              </button>
            ))}
            <button
              onClick={() => { setShowWsList(false); navigate('/register') }}
              className="w-full text-left px-3 py-2 rounded-lg text-xs text-zinc-600 hover:text-zinc-400 transition-colors"
            >
              + Create workspace
            </button>
          </div>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-3 overflow-y-auto space-y-1">
        {/* All Notes */}
        <button
          onClick={() => onFolderSelect(null)}
          className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors ${
            selectedFolder === null ? 'bg-brand-500/15 text-brand-300' : 'text-zinc-400 hover:bg-surface-800 hover:text-zinc-200'
          }`}
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          All Notes
        </button>

        {/* Folders */}
        <div className="pt-2">
          <div className="flex items-center justify-between px-3 mb-1">
            <span className="text-xs font-semibold text-zinc-600 uppercase tracking-wider">Folders</span>
            <button
              onClick={() => setShowNewFolder(true)}
              className="p-0.5 rounded text-zinc-600 hover:text-zinc-400 transition-colors"
              title="New folder"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
            </button>
          </div>

          {showNewFolder && (
            <form
              className="px-2 mb-1"
              onSubmit={(e) => { e.preventDefault(); createFolder.mutate(newFolderName) }}
            >
              <input
                autoFocus
                value={newFolderName}
                onChange={(e) => setNewFolderName(e.target.value)}
                onBlur={() => { setShowNewFolder(false); setNewFolderName('') }}
                placeholder="Folder name..."
                className="w-full bg-surface-800 border border-brand-500/50 rounded px-2 py-1 text-sm text-zinc-200 placeholder-zinc-600 focus:outline-none"
              />
            </form>
          )}

          {folders.map((folder) => (
            <button
              key={folder.id}
              onClick={() => onFolderSelect(folder.id)}
              className={`w-full flex items-center gap-2.5 px-3 py-1.5 rounded-lg text-sm transition-colors ${
                selectedFolder === folder.id ? 'bg-brand-500/15 text-brand-300' : 'text-zinc-500 hover:bg-surface-800 hover:text-zinc-200'
              }`}
            >
              <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
              </svg>
              <span className="truncate">{folder.name}</span>
            </button>
          ))}
        </div>

        {/* Settings link */}
        <div className="pt-2 border-t border-surface-800 mt-4">
          <Link
            to={`/w/${workspaceId}`}
            className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-zinc-500 hover:bg-surface-800 hover:text-zinc-200 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            Members
          </Link>
        </div>
      </nav>

      {/* User footer — Clerk UserButton handles avatar, profile and sign-out */}
      <div className="p-3 border-t border-surface-800">
        <div className="flex items-center gap-2.5 px-2 py-2">
          <UserButton
            afterSignOutUrl="/"
            appearance={{
              elements: {
                avatarBox: 'w-7 h-7',
              },
            }}
          />
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium text-zinc-300 truncate">
              {clerkUser?.fullName || user?.name}
            </p>
            <p className="text-xs text-zinc-600 truncate">
              {clerkUser?.primaryEmailAddress?.emailAddress || user?.email}
            </p>
          </div>
        </div>
      </div>
    </aside>
  )
}
