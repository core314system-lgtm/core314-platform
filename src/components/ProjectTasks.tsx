import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { useOrg } from '../contexts/OrgContext'
import {
  ListTodo, Plus, Check, Clock, User, Trash2,
} from 'lucide-react'

interface Task {
  id: string
  project_id: string
  org_id: string
  title: string
  assigned_to: string | null
  status: 'todo' | 'in_progress' | 'done'
  priority: 'low' | 'medium' | 'high'
  due_date: string | null
  created_by: string
  created_at: string
}

const PRIORITY_STYLES: Record<string, { bg: string; text: string; label: string }> = {
  high: { bg: 'bg-red-100', text: 'text-red-700', label: 'High' },
  medium: { bg: 'bg-amber-100', text: 'text-amber-700', label: 'Med' },
  low: { bg: 'bg-gray-100', text: 'text-gray-600', label: 'Low' },
}

interface Props {
  projectId: string
}

export default function ProjectTasks({ projectId }: Props) {
  const { user } = useAuth()
  const { currentOrg } = useOrg()
  const [tasks, setTasks] = useState<Task[]>([])
  const [loading, setLoading] = useState(true)
  const [showAdd, setShowAdd] = useState(false)
  const [newTitle, setNewTitle] = useState('')
  const [newAssignee, setNewAssignee] = useState('')
  const [newPriority, setNewPriority] = useState<'low' | 'medium' | 'high'>('medium')
  const [newDue, setNewDue] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (currentOrg?.id) loadTasks()
  }, [currentOrg?.id, projectId])

  async function loadTasks() {
    setLoading(true)
    const { data } = await supabase
      .from('project_tasks')
      .select('*')
      .eq('project_id', projectId)
      .eq('org_id', currentOrg!.id)
      .order('priority', { ascending: true })
      .order('created_at', { ascending: false })
    setTasks(data || [])
    setLoading(false)
  }

  async function handleAdd() {
    if (!newTitle.trim() || !user || !currentOrg?.id) return
    setSaving(true)
    await supabase.from('project_tasks').insert({
      project_id: projectId,
      org_id: currentOrg.id,
      title: newTitle.trim(),
      assigned_to: newAssignee || null,
      priority: newPriority,
      due_date: newDue || null,
      status: 'todo',
      created_by: user.id,
    })
    setNewTitle('')
    setNewAssignee('')
    setNewPriority('medium')
    setNewDue('')
    setSaving(false)
    setShowAdd(false)
    loadTasks()
  }

  async function updateStatus(id: string, status: Task['status']) {
    await supabase.from('project_tasks').update({ status }).eq('id', id)
    loadTasks()
  }

  async function deleteTask(id: string) {
    await supabase.from('project_tasks').delete().eq('id', id)
    loadTasks()
  }

  const doneCount = tasks.filter(t => t.status === 'done').length

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
          <ListTodo size={16} className="text-indigo-600" />
          Tasks
          {tasks.length > 0 && (
            <span className="text-xs text-gray-400 font-normal">
              {doneCount}/{tasks.length} done
            </span>
          )}
        </h3>
        <button
          onClick={() => setShowAdd(!showAdd)}
          className="text-xs text-blue-600 hover:text-blue-700 flex items-center gap-1"
        >
          <Plus size={12} />
          Add
        </button>
      </div>

      {showAdd && (
        <div className="mb-3 p-3 bg-gray-50 rounded-lg space-y-2">
          <input
            type="text"
            value={newTitle}
            onChange={e => setNewTitle(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleAdd()}
            placeholder="Task description..."
            className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm"
          />
          <div className="grid grid-cols-3 gap-2">
            <input
              type="text"
              value={newAssignee}
              onChange={e => setNewAssignee(e.target.value)}
              placeholder="Assign to..."
              className="px-2 py-1.5 border border-gray-300 rounded text-sm"
            />
            <select
              value={newPriority}
              onChange={e => setNewPriority(e.target.value as Task['priority'])}
              className="px-2 py-1.5 border border-gray-300 rounded text-sm"
            >
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </select>
            <input
              type="date"
              value={newDue}
              onChange={e => setNewDue(e.target.value)}
              className="px-2 py-1.5 border border-gray-300 rounded text-sm"
            />
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleAdd}
              disabled={saving || !newTitle.trim()}
              className="flex-1 px-3 py-1.5 bg-blue-600 text-white rounded text-xs font-medium hover:bg-blue-700 disabled:opacity-50"
            >
              {saving ? 'Adding...' : 'Add Task'}
            </button>
            <button
              onClick={() => setShowAdd(false)}
              className="px-3 py-1.5 border border-gray-300 rounded text-xs text-gray-600 hover:bg-gray-100"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <p className="text-xs text-gray-400">Loading...</p>
      ) : tasks.length === 0 ? (
        <p className="text-xs text-gray-400">No tasks yet. Add action items for your capture team.</p>
      ) : (
        <div className="space-y-1.5">
          {tasks.map(task => {
            const priority = PRIORITY_STYLES[task.priority]
            const isOverdue = task.due_date && new Date(task.due_date) < new Date() && task.status !== 'done'
            return (
              <div key={task.id} className="flex items-center gap-2 py-1.5 px-2 rounded hover:bg-gray-50 group">
                <button
                  onClick={() => updateStatus(task.id, task.status === 'done' ? 'todo' : task.status === 'todo' ? 'in_progress' : 'done')}
                  className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${
                    task.status === 'done' ? 'bg-green-500 border-green-500 text-white' : 'border-gray-300 hover:border-blue-400'
                  }`}
                >
                  {task.status === 'done' && <Check size={10} />}
                </button>
                <div className="flex-1 min-w-0">
                  <span className={`text-sm ${task.status === 'done' ? 'line-through text-gray-400' : 'text-gray-800'}`}>
                    {task.title}
                  </span>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <span className={`px-1 py-0 rounded text-[9px] font-medium ${priority.bg} ${priority.text}`}>
                      {priority.label}
                    </span>
                    {task.assigned_to && (
                      <span className="text-[10px] text-gray-400 flex items-center gap-0.5">
                        <User size={8} /> {task.assigned_to}
                      </span>
                    )}
                    {task.due_date && (
                      <span className={`text-[10px] flex items-center gap-0.5 ${isOverdue ? 'text-red-500 font-medium' : 'text-gray-400'}`}>
                        <Clock size={8} /> {new Date(task.due_date).toLocaleDateString()}
                      </span>
                    )}
                  </div>
                </div>
                <button
                  onClick={() => deleteTask(task.id)}
                  className="opacity-0 group-hover:opacity-100 p-1 text-gray-300 hover:text-red-500 transition-opacity"
                >
                  <Trash2 size={10} />
                </button>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
