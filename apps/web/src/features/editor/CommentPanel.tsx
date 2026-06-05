import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../../lib/api'
import { Comment, User } from '@collab-notes/types'
import { formatDistanceToNow } from 'date-fns'

interface CommentPanelProps {
  noteId: string
  workspaceId: string
  user: User | null
}

export default function CommentPanel({ noteId, user }: CommentPanelProps) {
  const qc = useQueryClient()
  const [newComment, setNewComment] = useState('')
  const [replyTo, setReplyTo] = useState<string | null>(null)
  const [replyText, setReplyText] = useState('')

  const { data: comments } = useQuery({
    queryKey: ['comments', noteId],
    queryFn: () => api.get<Comment[]>(`/comments?noteId=${noteId}`),
  })

  const addComment = useMutation({
    mutationFn: (body: string) => api.post('/comments', { noteId, body }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['comments', noteId] })
      setNewComment('')
    },
  })

  const addReply = useMutation({
    mutationFn: ({ parentId, body }: { parentId: string; body: string }) =>
      api.post('/comments', { noteId, parentId, body }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['comments', noteId] })
      setReplyTo(null)
      setReplyText('')
    },
  })

  const resolveComment = useMutation({
    mutationFn: (id: string) => api.patch(`/comments/${id}`, { resolved: true }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['comments', noteId] }),
  })

  const deleteComment = useMutation({
    mutationFn: (id: string) => api.delete(`/comments/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['comments', noteId] }),
  })

  return (
    <aside className="w-80 border-l border-surface-800 bg-surface-900 flex flex-col h-full animate-slide-in">
      <div className="flex items-center justify-between px-4 py-3 border-b border-surface-800">
        <h2 className="font-semibold text-sm text-zinc-200">Comments</h2>
        <span className="text-xs text-zinc-500">{comments?.length || 0}</span>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {(comments || []).map((comment) => (
          <div
            key={comment.id}
            className={`glass rounded-xl p-3 space-y-2 ${comment.resolved ? 'opacity-50' : ''}`}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-2">
                <div
                  className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0"
                  style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)' }}
                >
                  {comment.user?.name?.charAt(0) || '?'}
                </div>
                <div>
                  <p className="text-xs font-medium text-zinc-300">{comment.user?.name}</p>
                  <p className="text-xs text-zinc-600">
                    {formatDistanceToNow(new Date(comment.createdAt), { addSuffix: true })}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-1">
                {!comment.resolved && (
                  <button
                    onClick={() => resolveComment.mutate(comment.id)}
                    className="text-zinc-600 hover:text-emerald-400 transition-colors"
                    title="Resolve"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  </button>
                )}
                {comment.userId === user?.id && (
                  <button
                    onClick={() => deleteComment.mutate(comment.id)}
                    className="text-zinc-600 hover:text-red-400 transition-colors"
                    title="Delete"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                )}
              </div>
            </div>

            <p className="text-sm text-zinc-300 leading-relaxed">{comment.body}</p>

            {/* Replies */}
            {(comment as Comment & { replies?: Comment[] }).replies?.map((reply) => (
              <div key={reply.id} className="ml-4 pl-3 border-l border-surface-700">
                <div className="flex items-center gap-1.5 mb-1">
                  <span className="text-xs font-medium text-zinc-400">{reply.user?.name}</span>
                  <span className="text-xs text-zinc-600">
                    {formatDistanceToNow(new Date(reply.createdAt), { addSuffix: true })}
                  </span>
                </div>
                <p className="text-xs text-zinc-400">{reply.body}</p>
              </div>
            ))}

            {/* Reply input */}
            {replyTo === comment.id ? (
              <div className="ml-4 space-y-1">
                <input
                  autoFocus
                  value={replyText}
                  onChange={(e) => setReplyText(e.target.value)}
                  placeholder="Write a reply..."
                  className="w-full bg-surface-800 rounded px-2 py-1 text-xs text-zinc-300 placeholder-zinc-600 focus:outline-none border border-surface-700 focus:border-brand-500/50"
                />
                <div className="flex gap-1">
                  <button
                    onClick={() => addReply.mutate({ parentId: comment.id, body: replyText })}
                    disabled={!replyText.trim()}
                    className="text-xs bg-brand-600 text-white px-2 py-0.5 rounded hover:bg-brand-500 disabled:opacity-50 transition-colors"
                  >
                    Reply
                  </button>
                  <button
                    onClick={() => setReplyTo(null)}
                    className="text-xs text-zinc-600 px-2 py-0.5 hover:text-zinc-400 transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <button
                onClick={() => setReplyTo(comment.id)}
                className="text-xs text-zinc-600 hover:text-brand-400 transition-colors ml-1"
              >
                Reply
              </button>
            )}
          </div>
        ))}

        {(!comments || comments.length === 0) && (
          <p className="text-sm text-zinc-600 text-center py-8">No comments yet</p>
        )}
      </div>

      {/* New comment input */}
      <div className="p-4 border-t border-surface-800">
        <textarea
          value={newComment}
          onChange={(e) => setNewComment(e.target.value)}
          placeholder="Add a comment..."
          rows={2}
          className="w-full bg-surface-800 border border-surface-700 rounded-lg px-3 py-2 text-sm text-zinc-300 placeholder-zinc-600 focus:outline-none focus:ring-1 focus:ring-brand-500/50 focus:border-brand-500/50 resize-none transition-all"
        />
        <button
          onClick={() => addComment.mutate(newComment)}
          disabled={!newComment.trim()}
          className="mt-2 w-full gradient-brand text-white text-sm font-medium py-1.5 rounded-lg hover:opacity-90 disabled:opacity-50 transition-all"
        >
          Comment
        </button>
      </div>
    </aside>
  )
}
