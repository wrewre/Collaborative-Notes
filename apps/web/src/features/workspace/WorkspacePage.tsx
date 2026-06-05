import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../../lib/api'
import { useAuthStore } from '../auth/auth.store'
import { Note, Folder, Workspace } from '@collab-notes/types'
import Sidebar from './Sidebar'
import NoteList from './NoteList'

export default function WorkspacePage() {
  const { workspaceId } = useParams<{ workspaceId: string }>()
  const navigate = useNavigate()
  const user = useAuthStore((s) => s.user)
  const qc = useQueryClient()
  const [selectedFolder, setSelectedFolder] = useState<string | null>(null)
  const [search, setSearch] = useState('')

  // If workspaceId is 'select', redirect to first workspace
  const { data: workspaces } = useQuery({
    queryKey: ['workspaces'],
    queryFn: () => api.get<(Workspace & { role: string })[]>('/workspaces'),
    enabled: workspaceId === 'select',
  })

  useEffect(() => {
    if (workspaceId === 'select' && workspaces?.length) {
      navigate(`/w/${workspaces[0].id}`, { replace: true })
    }
  }, [workspaces, workspaceId, navigate])

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
        <div className="text-zinc-400 animate-pulse">Loading workspace...</div>
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
        user={user}
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
