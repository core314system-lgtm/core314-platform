import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { useOrg } from '../contexts/OrgContext'
import { MessageSquare, Send, Clock, Trash2 } from 'lucide-react'

interface Comment {
  id: string
  project_id: string
  user_id: string
  content: string
  created_at: string
  user_name?: string
}

interface Props {
  projectId: string
}

export default function ProjectActivityFeed({ projectId }: Props) {
  const { user, profile } = useAuth()
  const { currentOrg } = useOrg()
  const [comments, setComments] = useState<Comment[]>([])
  const [newComment, setNewComment] = useState('')
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (currentOrg?.id) loadComments()
  }, [currentOrg?.id, projectId])

  async function loadComments() {
    setLoading(true)
    const { data } = await supabase
      .from('project_comments')
      .select('*')
      .eq('project_id', projectId)
      .order('created_at', { ascending: false })
      .limit(50)

    setComments(data || [])
    setLoading(false)
  }

  async function handleSubmit() {
    if (!newComment.trim() || !user || !currentOrg?.id) return
    setSubmitting(true)

    const userName = profile?.full_name || user.email || 'Unknown'

    await supabase.from('project_comments').insert({
      project_id: projectId,
      user_id: user.id,
      content: newComment.trim(),
      user_name: userName,
      org_id: currentOrg.id,
    })

    setNewComment('')
    setSubmitting(false)
    loadComments()
  }

  async function handleDelete(id: string) {
    await supabase.from('project_comments').delete().eq('id', id)
    loadComments()
  }

  function formatTime(dateStr: string) {
    const date = new Date(dateStr)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMin = Math.floor(diffMs / 60000)
    const diffHr = Math.floor(diffMin / 60)
    const diffDays = Math.floor(diffHr / 24)

    if (diffMin < 1) return 'just now'
    if (diffMin < 60) return `${diffMin}m ago`
    if (diffHr < 24) return `${diffHr}h ago`
    if (diffDays < 7) return `${diffDays}d ago`
    return date.toLocaleDateString()
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4">
      <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-2 mb-3">
        <MessageSquare size={16} className="text-blue-600" />
        Activity & Comments
      </h3>

      {/* Comment Input */}
      <div className="flex gap-2 mb-4">
        <input
          type="text"
          value={newComment}
          onChange={e => setNewComment(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleSubmit()}
          placeholder="Add a comment..."
          className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        />
        <button
          onClick={handleSubmit}
          disabled={submitting || !newComment.trim()}
          className="px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
        >
          <Send size={14} />
        </button>
      </div>

      {/* Comments List */}
      {loading ? (
        <p className="text-xs text-gray-400">Loading activity...</p>
      ) : comments.length === 0 ? (
        <p className="text-xs text-gray-400 text-center py-4">No comments yet. Be the first to add one.</p>
      ) : (
        <div className="space-y-3 max-h-80 overflow-y-auto">
          {comments.map(comment => (
            <div key={comment.id} className="flex gap-2 group">
              <div className="w-7 h-7 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                <span className="text-xs font-medium text-blue-700">
                  {(comment.user_name || 'U').charAt(0).toUpperCase()}
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium text-gray-900">{comment.user_name || 'Unknown'}</span>
                  <span className="text-[10px] text-gray-400 flex items-center gap-0.5">
                    <Clock size={8} />
                    {formatTime(comment.created_at)}
                  </span>
                  {comment.user_id === user?.id && (
                    <button
                      onClick={() => handleDelete(comment.id)}
                      className="opacity-0 group-hover:opacity-100 text-gray-300 hover:text-red-500 transition-opacity"
                    >
                      <Trash2 size={10} />
                    </button>
                  )}
                </div>
                <p className="text-sm text-gray-700 mt-0.5">{comment.content}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
