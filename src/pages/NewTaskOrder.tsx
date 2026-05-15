import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { ArrowLeft, Upload, FileText, Info } from 'lucide-react'
import { Link } from 'react-router-dom'

const US_STATES = [
  'AL','AK','AZ','AR','CA','CO','CT','DE','FL','GA','HI','ID','IL','IN','IA','KS','KY',
  'LA','ME','MD','MA','MI','MN','MS','MO','MT','NE','NV','NH','NJ','NM','NY','NC','ND',
  'OH','OK','OR','PA','RI','SC','SD','TN','TX','UT','VT','VA','WA','WV','WI','WY','DC'
]

export default function NewTaskOrder() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState({
    title: '',
    solicitation_number: '',
    task_order_number: '',
    site_name: '',
    location_city: '',
    location_state: '',
    due_date: '',
    notes: '',
  })

  function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) {
    setForm(prev => ({ ...prev, [e.target.name]: e.target.value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)

    const { data, error } = await supabase
      .from('task_orders')
      .insert({
        ...form,
        due_date: form.due_date || null,
        status: 'draft',
        created_by: user?.id,
      })
      .select()
      .single()

    if (error) {
      alert('Error registering task order: ' + error.message)
      setLoading(false)
      return
    }

    navigate(`/task-orders/${data.id}`)
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Link to="/task-orders" className="text-gray-500 hover:text-gray-700">
          <ArrowLeft size={20} />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Register Incoming Task Order</h1>
          <p className="text-sm text-gray-500">Enter the details from the RFQ package you received</p>
        </div>
      </div>

      {/* Workflow Info */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 flex gap-3">
        <Info className="text-blue-600 shrink-0 mt-0.5" size={20} />
        <div className="text-sm text-blue-800">
          <p className="font-medium mb-1">How this works:</p>
          <ol className="list-decimal list-inside space-y-1 text-blue-700">
            <li>Register the task order details below</li>
            <li>Upload all RFQ documents (SOW, pricing sheets, exhibits, amendments, etc.)</li>
            <li>Run AI analysis to extract requirements, risks, and compliance items</li>
            <li>Generate compliance matrices, subcontractor RFQs, and bid summaries</li>
          </ol>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 space-y-5">
        <div className="flex items-center gap-2 text-gray-700 mb-2">
          <FileText size={18} />
          <span className="font-medium">RFQ / Task Order Details</span>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Task Order Title *</label>
          <input
            type="text"
            name="title"
            value={form.title}
            onChange={handleChange}
            placeholder="e.g., Atlanta P&DC IFSM Task Order"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            required
          />
          <p className="text-xs text-gray-400 mt-1">A descriptive name to identify this task order</p>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Solicitation Number</label>
            <input
              type="text"
              name="solicitation_number"
              value={form.solicitation_number}
              onChange={handleChange}
              placeholder="From the RFQ cover page"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Task Order Number</label>
            <input
              type="text"
              name="task_order_number"
              value={form.task_order_number}
              onChange={handleChange}
              placeholder="If assigned"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Site / Facility Name</label>
          <input
            type="text"
            name="site_name"
            value={form.site_name}
            onChange={handleChange}
            placeholder="e.g., Atlanta Processing & Distribution Center"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">City</label>
            <input
              type="text"
              name="location_city"
              value={form.location_city}
              onChange={handleChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">State</label>
            <select
              name="location_state"
              value={form.location_state}
              onChange={handleChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="">Select state</option>
              {US_STATES.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Bid Due Date</label>
          <input
            type="date"
            name="due_date"
            value={form.due_date}
            onChange={handleChange}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
          <p className="text-xs text-gray-400 mt-1">When is the bid response due?</p>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Initial Notes</label>
          <textarea
            name="notes"
            value={form.notes}
            onChange={handleChange}
            rows={3}
            placeholder="Any initial observations about this RFQ..."
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>

        <div className="flex gap-3 pt-2">
          <button
            type="submit"
            disabled={loading}
            className="bg-blue-600 text-white px-6 py-2.5 rounded-lg font-medium hover:bg-blue-700 transition-colors disabled:opacity-50 flex items-center gap-2"
          >
            <Upload size={18} />
            {loading ? 'Registering...' : 'Register & Upload Documents'}
          </button>
          <Link
            to="/task-orders"
            className="px-6 py-2.5 rounded-lg font-medium text-gray-700 border border-gray-300 hover:bg-gray-50"
          >
            Cancel
          </Link>
        </div>
      </form>
    </div>
  )
}
