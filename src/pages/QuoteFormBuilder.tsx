import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { ArrowLeft, Plus, Trash2, GripVertical, Save, Eye, RotateCcw, Loader2 } from 'lucide-react'

interface FormField {
  id: string
  field_name: string
  field_label: string
  field_type: string
  is_required: boolean
  help_text: string
  placeholder: string
  options: string[] | null
  display_order: number
  is_default_field: boolean
  default_field_key: string | null
  isNew?: boolean
}

const FIELD_TYPES = [
  { value: 'text', label: 'Text' },
  { value: 'number', label: 'Number' },
  { value: 'currency', label: 'Currency ($)' },
  { value: 'textarea', label: 'Long Text' },
  { value: 'select', label: 'Dropdown' },
  { value: 'file', label: 'File Upload' },
  { value: 'date', label: 'Date' },
  { value: 'checkbox', label: 'Checkbox' },
  { value: 'email', label: 'Email' },
  { value: 'phone', label: 'Phone' },
]

const DEFAULT_FIELDS: FormField[] = [
  { id: 'df-1', field_name: 'total_amount', field_label: 'Total Amount ($)', field_type: 'currency', is_required: true, help_text: 'Total annual contract value', placeholder: '', options: null, display_order: 0, is_default_field: true, default_field_key: 'total_amount' },
  { id: 'df-2', field_name: 'monthly_amount', field_label: 'Monthly Amount ($)', field_type: 'currency', is_required: false, help_text: 'Monthly recurring cost', placeholder: '', options: null, display_order: 1, is_default_field: true, default_field_key: 'monthly_amount' },
  { id: 'df-3', field_name: 'labor_cost', field_label: 'Labor Cost ($)', field_type: 'currency', is_required: false, help_text: 'Total labor component', placeholder: '', options: null, display_order: 2, is_default_field: true, default_field_key: 'labor_cost' },
  { id: 'df-4', field_name: 'materials_cost', field_label: 'Materials Cost ($)', field_type: 'currency', is_required: false, help_text: 'Total materials component', placeholder: '', options: null, display_order: 3, is_default_field: true, default_field_key: 'materials_cost' },
  { id: 'df-5', field_name: 'equipment_cost', field_label: 'Equipment Cost ($)', field_type: 'currency', is_required: false, help_text: 'Total equipment component', placeholder: '', options: null, display_order: 4, is_default_field: true, default_field_key: 'equipment_cost' },
  { id: 'df-6', field_name: 'overhead_markup', field_label: 'Overhead/Markup (%)', field_type: 'number', is_required: false, help_text: 'Overhead percentage', placeholder: '', options: null, display_order: 5, is_default_field: true, default_field_key: 'overhead_markup' },
  { id: 'df-7', field_name: 'scope_inclusions', field_label: 'Scope Inclusions', field_type: 'textarea', is_required: true, help_text: 'Detail your specific understanding of the scope of work. Vague responses will be rejected.', placeholder: 'List the specific services, tasks, deliverables, staffing, equipment, and schedules your pricing covers...', options: null, display_order: 6, is_default_field: true, default_field_key: 'scope_inclusions' },
  { id: 'df-8', field_name: 'scope_exclusions', field_label: 'Scope Exclusions', field_type: 'textarea', is_required: false, help_text: 'What is not included', placeholder: '', options: null, display_order: 7, is_default_field: true, default_field_key: 'scope_exclusions' },
  { id: 'df-9', field_name: 'assumptions', field_label: 'Assumptions', field_type: 'textarea', is_required: false, help_text: 'Key assumptions your pricing is based on', placeholder: '', options: null, display_order: 8, is_default_field: true, default_field_key: 'assumptions' },
  { id: 'df-10', field_name: 'timeline', field_label: 'Timeline / Mobilization', field_type: 'text', is_required: false, help_text: 'How quickly you can mobilize', placeholder: '', options: null, display_order: 9, is_default_field: true, default_field_key: 'timeline' },
  { id: 'df-11', field_name: 'payment_terms', field_label: 'Payment Terms', field_type: 'text', is_required: false, help_text: 'e.g., Net 30, Net 45', placeholder: '', options: null, display_order: 10, is_default_field: true, default_field_key: 'payment_terms' },
  { id: 'df-12', field_name: 'validity_period', field_label: 'Quote Validity Period', field_type: 'text', is_required: false, help_text: 'How long this quote is valid', placeholder: '', options: null, display_order: 11, is_default_field: true, default_field_key: 'validity_period' },
]

export default function QuoteFormBuilder() {
  const { id: taskOrderId, sowId } = useParams<{ id: string; sowId?: string }>()
  const [fields, setFields] = useState<FormField[]>([...DEFAULT_FIELDS])
  const [templateName, setTemplateName] = useState('Standard Quote Form')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [loading, setLoading] = useState(true)
  const [taskOrderTitle, setTaskOrderTitle] = useState('')
  const [sowName, setSowName] = useState('')
  const [showPreview, setShowPreview] = useState(false)
  const [editingField, setEditingField] = useState<string | null>(null)

  useEffect(() => {
    loadExistingTemplate()
  }, [taskOrderId, sowId])

  async function loadExistingTemplate() {
    if (!taskOrderId) return

    const { data: to } = await supabase.from('task_orders').select('title').eq('id', taskOrderId).single()
    if (to) setTaskOrderTitle(to.title)

    if (sowId) {
      const { data: sow } = await supabase.from('sow_items').select('sow_name').eq('id', sowId).single()
      if (sow) setSowName(sow.sow_name)
    }

    // Check for existing template
    let query = supabase.from('quote_form_templates').select('*, quote_form_fields(*)').eq('task_order_id', taskOrderId)
    if (sowId) {
      query = query.eq('sow_item_id', sowId)
    } else {
      query = query.is('sow_item_id', null)
    }

    const { data: template } = await query.single()

    if (template) {
      setTemplateName(template.name)
      const loadedFields = (template.quote_form_fields || [])
        .sort((a: any, b: any) => a.display_order - b.display_order)
        .map((f: any) => ({
          ...f,
          options: f.options || null,
        }))
      setFields(loadedFields)
    }

    setLoading(false)
  }

  function addCustomField() {
    const newField: FormField = {
      id: `new-${Date.now()}`,
      field_name: `custom_${Date.now()}`,
      field_label: 'New Custom Field',
      field_type: 'text',
      is_required: false,
      help_text: '',
      placeholder: '',
      options: null,
      display_order: fields.length,
      is_default_field: false,
      default_field_key: null,
      isNew: true,
    }
    setFields([...fields, newField])
    setEditingField(newField.id)
  }

  function removeField(id: string) {
    setFields(fields.filter(f => f.id !== id))
  }

  function updateField(id: string, updates: Partial<FormField>) {
    setFields(fields.map(f => f.id === id ? { ...f, ...updates } : f))
  }

  function moveField(index: number, direction: 'up' | 'down') {
    const newFields = [...fields]
    const target = direction === 'up' ? index - 1 : index + 1
    if (target < 0 || target >= newFields.length) return
    ;[newFields[index], newFields[target]] = [newFields[target], newFields[index]]
    newFields.forEach((f, i) => f.display_order = i)
    setFields(newFields)
  }

  async function saveTemplate() {
    if (!taskOrderId) return
    setSaving(true)
    setSaved(false)

    try {
      // Delete existing template for this scope
      let delQuery = supabase.from('quote_form_templates').delete().eq('task_order_id', taskOrderId)
      if (sowId) {
        delQuery = delQuery.eq('sow_item_id', sowId)
      } else {
        delQuery = delQuery.is('sow_item_id', null)
      }
      await delQuery

      // Create new template
      const { data: template, error: tErr } = await supabase.from('quote_form_templates').insert({
        name: templateName,
        task_order_id: taskOrderId,
        sow_item_id: sowId || null,
      }).select().single()

      if (tErr || !template) throw new Error(tErr?.message || 'Failed to create template')

      // Insert fields
      const fieldRecords = fields.map((f, i) => ({
        template_id: template.id,
        field_name: f.field_name,
        field_label: f.field_label,
        field_type: f.field_type,
        is_required: f.is_required,
        help_text: f.help_text || null,
        placeholder: f.placeholder || null,
        options: f.options,
        display_order: i,
        is_default_field: f.is_default_field,
        default_field_key: f.default_field_key,
      }))

      const { error: fErr } = await supabase.from('quote_form_fields').insert(fieldRecords)
      if (fErr) throw new Error(fErr.message)

      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    } catch (err: any) {
      alert('Failed to save: ' + err.message)
    } finally {
      setSaving(false)
    }
  }

  function resetToDefaults() {
    if (!confirm('Reset all fields to defaults? Custom fields will be removed.')) return
    setFields([...DEFAULT_FIELDS])
    setTemplateName('Standard Quote Form')
  }

  if (loading) return <div className="p-8 text-gray-500">Loading...</div>

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <Link to={`/projects/${taskOrderId}/sow-tracker`} className="flex items-center gap-2 text-blue-600 hover:text-blue-800 text-sm mb-4">
        <ArrowLeft className="w-4 h-4" /> Back to SOW Bid Management
      </Link>

      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Quote Form Builder</h1>
          <p className="text-sm text-gray-500">
            {taskOrderTitle}{sowName ? ` — ${sowName}` : ' — All SOWs (Default)'}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={() => setShowPreview(!showPreview)} className="flex items-center gap-2 px-3 py-2 border border-gray-300 rounded-lg text-sm hover:bg-gray-50">
            <Eye className="w-4 h-4" /> {showPreview ? 'Edit' : 'Preview'}
          </button>
          <button onClick={resetToDefaults} className="flex items-center gap-2 px-3 py-2 border border-gray-300 rounded-lg text-sm hover:bg-gray-50">
            <RotateCcw className="w-4 h-4" /> Reset
          </button>
          <button onClick={saveTemplate} disabled={saving} className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            {saved ? 'Saved!' : 'Save Template'}
          </button>
        </div>
      </div>

      {/* Template Name */}
      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-700 mb-1">Template Name</label>
        <input
          type="text"
          value={templateName}
          onChange={e => setTemplateName(e.target.value)}
          className="w-full max-w-md border border-gray-300 rounded-lg px-3 py-2 text-sm"
        />
      </div>

      {showPreview ? (
        /* Preview Mode */
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="text-lg font-bold text-gray-900 mb-1">Preview: {templateName}</h2>
          <p className="text-sm text-gray-500 mb-6">This is what subcontractors will see in the portal.</p>
          <div className="space-y-4">
            {fields.map(field => (
              <div key={field.id}>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {field.field_label} {field.is_required && <span className="text-red-500">*</span>}
                </label>
                {field.help_text && <p className="text-xs text-gray-400 mb-1">{field.help_text}</p>}
                {field.field_type === 'textarea' ? (
                  <textarea disabled rows={3} placeholder={field.placeholder || ''} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-gray-50" />
                ) : field.field_type === 'select' ? (
                  <select disabled className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-gray-50">
                    <option>Select...</option>
                    {(field.options || []).map(o => <option key={o}>{o}</option>)}
                  </select>
                ) : field.field_type === 'checkbox' ? (
                  <label className="flex items-center gap-2"><input type="checkbox" disabled className="rounded" /><span className="text-sm text-gray-600">{field.placeholder || 'Yes'}</span></label>
                ) : (
                  <input type="text" disabled placeholder={field.placeholder || ''} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-gray-50" />
                )}
              </div>
            ))}
          </div>
        </div>
      ) : (
        /* Edit Mode */
        <div className="space-y-3">
          {fields.map((field, index) => (
            <div key={field.id} className={`bg-white rounded-lg border ${editingField === field.id ? 'border-blue-400 ring-2 ring-blue-100' : 'border-gray-200'} p-4`}>
              <div className="flex items-center gap-3">
                <div className="flex flex-col gap-1">
                  <button onClick={() => moveField(index, 'up')} disabled={index === 0} className="text-gray-400 hover:text-gray-600 disabled:opacity-30"><GripVertical className="w-4 h-4" /></button>
                </div>
                <div className="flex-1 grid grid-cols-1 md:grid-cols-4 gap-3">
                  <div className="md:col-span-2">
                    <input
                      type="text"
                      value={field.field_label}
                      onChange={e => updateField(field.id, { field_label: e.target.value })}
                      className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm font-medium"
                      placeholder="Field label"
                    />
                  </div>
                  <select
                    value={field.field_type}
                    onChange={e => updateField(field.id, { field_type: e.target.value })}
                    className="border border-gray-300 rounded px-2 py-1.5 text-sm"
                  >
                    {FIELD_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                  </select>
                  <div className="flex items-center gap-3">
                    <label className="flex items-center gap-1.5 text-sm">
                      <input
                        type="checkbox"
                        checked={field.is_required}
                        onChange={e => updateField(field.id, { is_required: e.target.checked })}
                        className="rounded border-gray-300 text-blue-600"
                      />
                      Required
                    </label>
                    <button onClick={() => setEditingField(editingField === field.id ? null : field.id)} className="text-gray-400 hover:text-blue-600 text-xs">
                      {editingField === field.id ? 'Close' : 'Edit'}
                    </button>
                    {!field.is_default_field && (
                      <button onClick={() => removeField(field.id)} className="text-gray-400 hover:text-red-600">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* Expanded edit section */}
              {editingField === field.id && (
                <div className="mt-3 pt-3 border-t border-gray-200 grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Help Text</label>
                    <input
                      type="text"
                      value={field.help_text}
                      onChange={e => updateField(field.id, { help_text: e.target.value })}
                      className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm"
                      placeholder="Instructions for the subcontractor"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Placeholder</label>
                    <input
                      type="text"
                      value={field.placeholder}
                      onChange={e => updateField(field.id, { placeholder: e.target.value })}
                      className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm"
                      placeholder="Placeholder text"
                    />
                  </div>
                  {field.field_type === 'select' && (
                    <div className="md:col-span-2">
                      <label className="block text-xs text-gray-500 mb-1">Options (comma-separated)</label>
                      <input
                        type="text"
                        value={(field.options || []).join(', ')}
                        onChange={e => updateField(field.id, { options: e.target.value.split(',').map(s => s.trim()).filter(Boolean) })}
                        className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm"
                        placeholder="Option 1, Option 2, Option 3"
                      />
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}

          <button
            onClick={addCustomField}
            className="w-full flex items-center justify-center gap-2 py-3 border-2 border-dashed border-gray-300 rounded-lg text-sm text-gray-500 hover:border-blue-400 hover:text-blue-600 transition-colors"
          >
            <Plus className="w-4 h-4" /> Add Custom Field
          </button>
        </div>
      )}
    </div>
  )
}
