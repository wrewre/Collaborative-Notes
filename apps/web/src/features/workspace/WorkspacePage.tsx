import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useUser } from '@clerk/clerk-react'
import { api } from '../../lib/api'
import { Note, Folder, Workspace } from '@collab-notes/types'
import Sidebar from './Sidebar'
import NoteList from './NoteList'

export default function WorkspacePage() {
  const { workspaceId } = useParams<{ workspaceId: string }>()
  const navigate = useNavigate()
  const { user: clerkUser } = useUser()
  const qc = useQueryClient()
  const [selectedFolder, setSelectedFolder] = useState<string | null>(null)
  const [search, setSearch] = useState('')

  // Fetch all workspaces — used for sidebar list and the "select" redirect
  const { data: workspaces } = useQuery({
    queryKey: ['workspaces'],
    queryFn: () => api.get<(Workspace & { role: string })[]>('/workspaces'),
    enabled: !!clerkUser,
  })

  // If workspaceId is 'select', navigate to the first workspace (or create one)
  useEffect(() => {
    if (workspaceId !== 'select') return
    if (!workspaces) return

    if (workspaces.length > 0) {
      navigate(`/w/${workspaces[0].id}`, { replace: true })
    } else {
      // No workspaces yet — auto-create a personal one
      const name = clerkUser?.firstName
        ? `${clerkUser.firstName}'s Workspace`
        : 'My Workspace'
      const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')

      api.post<Workspace>('/workspaces', { name, slug })
        .then((ws) => navigate(`/w/${ws.id}`, { replace: true }))
        .catch(() => {
          // Slug collision — add random suffix
          const fallbackSlug = `${slug}-${Math.random().toString(36).slice(2, 7)}`
          api.post<Workspace>('/workspaces', { name, slug: fallbackSlug })
            .then((ws) => navigate(`/w/${ws.id}`, { replace: true }))
        })
    }
  }, [workspaces, workspaceId, navigate, clerkUser])

  const { data: workspace } = useQuery({
    queryKey: ['workspace', workspaceId],
    queryFn: () => api.get<Workspace & { role: string; members: unknown[] }>(`/workspaces/${workspaceId}`),
    enabled: !!workspaceId && workspaceId !== 'select',
  })

  const { data: notes, isLoading: notesLoading } = useQuery({
    queryKey: ['notes', workspaceId, selectedFolder, search],
    queryFn: () => {
      const params = new URLSearchParams()
      if (selectedFolder) params.set('folderId', selectedFolder)
      if (search) params.set('search', search)
      return api.get<{ items: Note[] }>(`/workspaces/${workspaceId}/notes?${params}`)
    },
    enabled: !!workspaceId && workspaceId !== 'select',
  })

  const { data: folders } = useQuery({
    queryKey: ['folders', workspaceId],
    queryFn: () => api.get<Folder[]>(`/workspaces/${workspaceId}/folders`),
    enabled: !!workspaceId && workspaceId !== 'select',
  })

  const createNote = useMutation({
    mutationFn: () =>
      api.post<Note>(`/workspaces/${workspaceId}/notes`, {
        title: 'Untitled',
        folderId: selectedFolder || undefined,
      }),
    onSuccess: (note) => {
      qc.invalidateQueries({ queryKey: ['notes', workspaceId] })
      navigate(`/w/${workspaceId}/notes/${note.id}`)
    },
  })

  if (workspaceId === 'select') {
    return (
      <div className="min-h-screen bg-surface-950 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-zinc-400 text-sm">Setting up your workspace...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-screen bg-surface-950 overflow-hidden">
      <Sidebar
        workspace={workspace}
        workspaces={workspaces || []}
        folders={folders || []}
        selectedFolder={selectedFolder}
        onFolderSelect={setSelectedFolder}
        user={null}
        workspaceId={workspaceId!}
      />
      <main className="flex-1 flex flex-col min-w-0">
        <NoteList
          notes={notes?.items || []}
          loading={notesLoading}
          search={search}
          onSearchChange={setSearch}
          onCreateNote={() => createNote.mutate()}
          workspaceId={workspaceId!}
          selectedFolder={selectedFolder}
        />
      </main>
    </div>
  )
}
