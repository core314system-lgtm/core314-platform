import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { Settings, Plus, Trash2, GripVertical, Save, Loader2, CheckCircle, RotateCcw } from 'lucide-react'

interface TemplateField {
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
  { value: 'textarea', label: 'Text Area' },
  { value: 'number', label: 'Number' },
  { value: 'currency', label: 'Currency ($)' },
  { value: 'email', label: 'Email' },
  { value: 'phone', label: 'Phone' },
  { value: 'date', label: 'Date' },
  { value: 'dropdown', label: 'Dropdown' },
  { value: 'checkbox', label: 'Checkbox' },
  { value: 'file', label: 'File Upload' },
]

const DEFAULT_FIELDS: TemplateField[] = [
  { id: 'df-1', field_name: 'total_amount', field_label: 'Total Quote Amount', field_type: 'currency', is_required: true, help_text: '', placeholder: 'Total all-in price', options: null, display_order: 0, is_default_field: true, default_field_key: 'total_amount' },
  { id: 'df-2', field_name: 'monthly_amount', field_label: 'Monthly Amount', field_type: 'currency', is_required: false, help_text: '', placeholder: '', options: null, display_order: 1, is_default_field: true, default_field_key: 'monthly_amount' },
  { id: 'df-3', field_name: 'labor_cost', field_label: 'Labor Cost', field_type: 'currency', is_required: false, help_text: '', placeholder: '', options: null, display_order: 2, is_default_field: true, default_field_key: 'labor_cost' },
  { id: 'df-4', field_name: 'materials_cost', field_label: 'Materials Cost', field_type: 'currency', is_required: false, help_text: '', placeholder: '', options: null, display_order: 3, is_default_field: true, default_field_key: 'materials_cost' },
  { id: 'df-5', field_name: 'equipment_cost', field_label: 'Equipment Cost', field_type: 'currency', is_required: false, help_text: '', placeholder: '', options: null, display_order: 4, is_default_field: true, default_field_key: 'equipment_cost' },
  { id: 'df-6', field_name: 'scope_inclusions', field_label: 'Scope Inclusions', field_type: 'textarea', is_required: true, help_text: 'Detail your specific understanding of the scope of work. Vague responses will be rejected.', placeholder: 'List the specific services, tasks, deliverables, staffing, equipment, and schedules your pricing covers...', options: null, display_order: 5, is_default_field: true, default_field_key: 'scope_inclusions' },
  { id: 'df-7', field_name: 'scope_exclusions', field_label: 'Scope Exclusions', field_type: 'textarea', is_required: false, help_text: '', placeholder: 'List any exclusions', options: null, display_order: 6, is_default_field: true, default_field_key: 'scope_exclusions' },
  { id: 'df-8', field_name: 'assumptions', field_label: 'Assumptions', field_type: 'textarea', is_required: false, help_text: '', placeholder: '', options: null, display_order: 7, is_default_field: true, default_field_key: 'assumptions' },
  { id: 'df-9', field_name: 'timeline', field_label: 'Proposed Timeline', field_type: 'text', is_required: false, help_text: '', placeholder: '', options: null, display_order: 8, is_default_field: true, default_field_key: 'timeline' },
  { id: 'df-10', field_name: 'payment_terms', field_label: 'Payment Terms', field_type: 'text', is_required: false, help_text: '', placeholder: 'e.g., Net 30', options: null, display_order: 9, is_default_field: true, default_field_key: 'payment_terms' },
  { id: 'df-11', field_name: 'validity_period', field_label: 'Quote Valid For', field_type: 'text', is_required: false, help_text: '', placeholder: 'e.g., 90 days', options: null, display_order: 10, is_default_field: true, default_field_key: 'validity_period' },
]

export default function OrgDefaultTemplate() {
  const { profile } = useAuth()
  const [fields, setFields] = useState<TemplateField[]>(DEFAULT_FIELDS)
  const [templateName, setTemplateName] = useState('Organization Default Quote Form')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [editingField, setEditingField] = useState<string | null>(null)

  useEffect(() => {
    async function loadOrgTemplate() {
      if (!profile?.current_org_id) { setLoading(false); return }

      const { data: template } = await supabase
        .from('org_default_templates')
        .select('*')
        .eq('org_id', profile.current_org_id)
        .eq('template_type', 'quote_form')
        .single()

      if (template?.fields) {
        setTemplateName(template.name || 'Organization Default Quote Form')
        setFields(template.fields as TemplateField[])
      }

      setLoading(false)
    }
    loadOrgTemplate()
  }, [profile?.current_org_id])

  function addCustomField() {
    const newField: TemplateField = {
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

  function updateField(id: string, updates: Partial<TemplateField>) {
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
    if (!profile?.current_org_id) return
    setSaving(true)
    setSaved(false)

    try {
      // Upsert org default template
      const cleanFields = fields.map((f, i) => ({
        ...f,
        display_order: i,
        isNew: undefined,
      }))

      const { error } = await supabase
        .from('org_default_templates')
        .upsert({
          org_id: profile.current_org_id,
          template_type: 'quote_form',
          name: templateName,
          fields: cleanFields,
          updated_at: new Date().toISOString(),
          updated_by: profile.id,
        }, { onConflict: 'org_id,template_type' })

      if (error) {
        // Table may not exist yet — try insert instead
        await supabase.from('org_default_templates').insert({
          org_id: profile.current_org_id,
          template_type: 'quote_form',
          name: templateName,
          fields: cleanFields,
          updated_by: profile.id,
        })
      }

      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    } catch (err) {
      console.error('Failed to save org template:', err)
    } finally {
      setSaving(false)
    }
  }

  function resetToDefaults() {
    setFields(DEFAULT_FIELDS)
    setTemplateName('Organization Default Quote Form')
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <Settings className="w-5 h-5 text-blue-600" />
            Organization Default Portal Template
          </h2>
          <p className="text-sm text-gray-500 mt-1">
            Configure the default fields that appear on every new subcontractor portal. Individual projects can override these.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={resetToDefaults}
            className="flex items-center gap-1.5 px-3 py-2 text-sm text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            <RotateCcw className="w-4 h-4" /> Reset
          </button>
          <button
            onClick={saveTemplate}
            disabled={saving}
            className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : saved ? <CheckCircle className="w-4 h-4" /> : <Save className="w-4 h-4" />}
            {saved ? 'Saved!' : 'Save Template'}
          </button>
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Template Name</label>
        <input
          type="text"
          value={templateName}
          onChange={e => setTemplateName(e.target.value)}
          className="w-full max-w-md border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        />
      </div>

      <div className="space-y-2">
        {fields.map((field, index) => (
          <div key={field.id} className="border border-gray-200 rounded-lg p-4 bg-white">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <GripVertical className="w-4 h-4 text-gray-400 cursor-grab" />
                <div className="flex items-center gap-2">
                  <button onClick={() => moveField(index, 'up')} disabled={index === 0} className="text-gray-400 hover:text-gray-600 disabled:opacity-30 text-xs">▲</button>
                  <button onClick={() => moveField(index, 'down')} disabled={index === fields.length - 1} className="text-gray-400 hover:text-gray-600 disabled:opacity-30 text-xs">▼</button>
                </div>
                <div>
                  <span className="font-medium text-sm text-gray-900">{field.field_label}</span>
                  <span className="text-xs text-gray-400 ml-2">{field.field_type}{field.is_required ? ' • Required' : ''}</span>
                  {field.is_default_field && <span className="text-xs bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded ml-2">Default</span>}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setEditingField(editingField === field.id ? null : field.id)}
                  className="text-xs text-blue-600 hover:text-blue-800"
                >
                  {editingField === field.id ? 'Done' : 'Edit'}
                </button>
                {!field.is_default_field && (
                  <button onClick={() => removeField(field.id)} className="text-gray-400 hover:text-red-500">
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>

            {editingField === field.id && (
              <div className="mt-4 pt-4 border-t border-gray-100 grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Label</label>
                  <input
                    type="text"
                    value={field.field_label}
                    onChange={e => updateField(field.id, { field_label: e.target.value })}
                    className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Type</label>
                  <select
                    value={field.field_type}
                    onChange={e => updateField(field.id, { field_type: e.target.value })}
                    className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm"
                  >
                    {FIELD_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Placeholder</label>
                  <input
                    type="text"
                    value={field.placeholder}
                    onChange={e => updateField(field.id, { placeholder: e.target.value })}
                    className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Help Text</label>
                  <input
                    type="text"
                    value={field.help_text}
                    onChange={e => updateField(field.id, { help_text: e.target.value })}
                    className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={field.is_required}
                    onChange={e => updateField(field.id, { is_required: e.target.checked })}
                    className="rounded text-blue-600"
                  />
                  <label className="text-sm text-gray-700">Required</label>
                </div>
                {field.field_type === 'dropdown' && (
                  <div className="col-span-2">
                    <label className="block text-xs font-medium text-gray-600 mb-1">Options (comma-separated)</label>
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
      </div>

      <button
        onClick={addCustomField}
        className="flex items-center gap-2 text-sm text-blue-600 hover:text-blue-800 font-medium"
      >
        <Plus className="w-4 h-4" /> Add Custom Field
      </button>

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-sm text-blue-800">
        <strong>How it works:</strong> These fields are the default starting point when creating a new subcontractor portal form.
        Project-level form builders can override or extend these defaults for specific projects. Default fields (marked blue) are standard
        financial fields that map to the quote database. Custom fields are stored as JSON.
      </div>
    </div>
  )
}
