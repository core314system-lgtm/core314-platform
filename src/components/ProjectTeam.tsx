import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { Users, X, UserPlus } from 'lucide-react'

interface Assignment {
  id: string
  task_order_id: string
  user_id: string
  role: string
  assigned_at: string
  user_name?: string
  user_email?: string
}

interface ProjectTeamProps {
  taskOrderId: string
}

const ASSIGNMENT_ROLES = [
  { value: 'lead', label: 'Lead' },
  { value: 'contributor', label: 'Contributor' },
  { value: 'reviewer', label: 'Reviewer' },
  { value: 'observer', label: 'Observer' },
]

export default function ProjectTeam({ taskOrderId }: ProjectTeamProps) {
  const { user } = useAuth()
  const [assignments, setAssignments] = useState<Assignment[]>([])
  const [orgMembers, setOrgMembers] = useState<Array<{ id: string; full_name: string | null; email: string }>>([])
  const [showAdd, setShowAdd] = useState(false)
  const [selectedUserId, setSelectedUserId] = useState('')
  const [selectedRole, setSelectedRole] = useState('contributor')
  const [supported, setSupported] = useState(true)

  useEffect(() => {
    loadAssignments()
    loadOrgMembers()
  }, [taskOrderId])

  async function loadAssignments() {
    const { data, error } = await supabase
      .from('project_assignments')
      .select('*')
      .eq('task_order_id', taskOrderId)

    if (error) {
      setSupported(false)
      return
    }

    // Load user profiles for the assignments
    if (data && data.length > 0) {
      const userIds = data.map(a => a.user_id)
      const { data: profiles } = await supabase
        .from('user_profiles')
        .select('id, full_name, email')
        .in('id', userIds)

      const profileMap = new Map((profiles || []).map(p => [p.id, p]))

      setAssignments(data.map(a => ({
        ...a,
        user_name: profileMap.get(a.user_id)?.full_name || undefined,
        user_email: profileMap.get(a.user_id)?.email || undefined,
      })))
    } else {
      setAssignments([])
    }
  }

  async function loadOrgMembers() {
    const { data: members } = await supabase
      .from('organization_members')
      .select('user_id')

    if (members && members.length > 0) {
      const userIds = members.map(m => m.user_id)
      const { data: profiles } = await supabase
        .from('user_profiles')
        .select('id, full_name, email')
        .in('id', userIds)

      setOrgMembers(profiles || [])
    }
  }

  async function handleAdd() {
    if (!selectedUserId) return

    const { error } = await supabase.from('project_assignments').insert({
      task_order_id: taskOrderId,
      user_id: selectedUserId,
      role: selectedRole,
      assigned_by: user?.id,
    })

    if (error) return

    await loadAssignments()
    setShowAdd(false)
    setSelectedUserId('')
    setSelectedRole('contributor')
  }

  async function handleRemove(assignmentId: string) {
    await supabase.from('project_assignments').delete().eq('id', assignmentId)
    setAssignments(prev => prev.filter(a => a.id !== assignmentId))
  }

  async function handleRoleChange(assignmentId: string, newRole: string) {
    await supabase.from('project_assignments').update({ role: newRole }).eq('id', assignmentId)
    setAssignments(prev => prev.map(a => a.id === assignmentId ? { ...a, role: newRole } : a))
  }

  if (!supported) return null

  // Members not yet assigned
  const unassignedMembers = orgMembers.filter(m => !assignments.some(a => a.user_id === m.id))

  const roleColor: Record<string, string> = {
    lead: 'bg-blue-100 text-blue-700',
    contributor: 'bg-green-100 text-green-700',
    reviewer: 'bg-yellow-100 text-yellow-700',
    observer: 'bg-gray-100 text-gray-600',
  }

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
          <Users size={16} />
          Project Team ({assignments.length})
        </h3>
        {unassignedMembers.length > 0 && (
          <button
            onClick={() => setShowAdd(!showAdd)}
            className="text-xs text-blue-600 hover:text-blue-700 flex items-center gap-1"
          >
            <UserPlus size={14} /> Assign
          </button>
        )}
      </div>

      {/* Add member form */}
      {showAdd && (
        <div className="mb-3 p-3 bg-gray-50 rounded-lg space-y-2">
          <select
            value={selectedUserId}
            onChange={e => setSelectedUserId(e.target.value)}
            className="w-full text-sm border border-gray-300 rounded-lg px-3 py-1.5"
          >
            <option value="">Select team member...</option>
            {unassignedMembers.map(m => (
              <option key={m.id} value={m.id}>{m.full_name || m.email}</option>
            ))}
          </select>
          <div className="flex items-center gap-2">
            <select
              value={selectedRole}
              onChange={e => setSelectedRole(e.target.value)}
              className="text-sm border border-gray-300 rounded-lg px-3 py-1.5"
            >
              {ASSIGNMENT_ROLES.map(r => (
                <option key={r.value} value={r.value}>{r.label}</option>
              ))}
            </select>
            <button
              onClick={handleAdd}
              disabled={!selectedUserId}
              className="text-sm bg-blue-600 text-white px-3 py-1.5 rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              Add
            </button>
            <button
              onClick={() => setShowAdd(false)}
              className="text-sm text-gray-500 hover:text-gray-700 px-2 py-1.5"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Assignments list */}
      {assignments.length === 0 ? (
        <p className="text-xs text-gray-400">No team members assigned yet.</p>
      ) : (
        <div className="space-y-2">
          {assignments.map(a => (
            <div key={a.id} className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-2">
                <span className="font-medium text-gray-700">{a.user_name || a.user_email || 'Unknown'}</span>
                <select
                  value={a.role}
                  onChange={e => handleRoleChange(a.id, e.target.value)}
                  className={`text-xs px-2 py-0.5 rounded-full border-0 cursor-pointer ${roleColor[a.role] || roleColor.observer}`}
                >
                  {ASSIGNMENT_ROLES.map(r => (
                    <option key={r.value} value={r.value}>{r.label}</option>
                  ))}
                </select>
              </div>
              <button
                onClick={() => handleRemove(a.id)}
                className="text-gray-400 hover:text-red-500"
                title="Remove from project"
              >
                <X size={14} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
