import { motion } from 'framer-motion'
import { Link } from 'react-router-dom'
import {
  Code2, Lock, Zap, Shield, ArrowRight, Copy, Check,
  Globe, Key, FileText,
} from 'lucide-react'
import { useState } from 'react'
import Header from '../components/Header'
import Footer from '../components/Footer'

const fadeUp = { hidden: { opacity: 0, y: 24 }, visible: { opacity: 1, y: 0 } }
const stagger = { visible: { transition: { staggerChildren: 0.08 } } }

interface Endpoint {
  method: 'GET' | 'POST' | 'PUT' | 'DELETE'
  path: string
  description: string
  auth: boolean
  category: string
}

const endpoints: Endpoint[] = [
  // Project Management
  { method: 'GET', path: '/rest/v1/task_orders', description: 'List all projects in your organization', auth: true, category: 'Projects' },
  { method: 'POST', path: '/rest/v1/task_orders', description: 'Create a new capture/proposal project', auth: true, category: 'Projects' },
  { method: 'GET', path: '/rest/v1/task_orders?id=eq.{id}', description: 'Get a specific project by ID', auth: true, category: 'Projects' },
  { method: 'PUT', path: '/rest/v1/task_orders?id=eq.{id}', description: 'Update project details', auth: true, category: 'Projects' },
  { method: 'DELETE', path: '/rest/v1/task_orders?id=eq.{id}', description: 'Delete a project', auth: true, category: 'Projects' },

  // Subcontractors
  { method: 'GET', path: '/rest/v1/subcontractors', description: 'List subcontractors in your database', auth: true, category: 'Subcontractors' },
  { method: 'POST', path: '/rest/v1/subcontractors', description: 'Add a subcontractor to your database', auth: true, category: 'Subcontractors' },
  { method: 'GET', path: '/rest/v1/subcontractors?id=eq.{id}', description: 'Get subcontractor details', auth: true, category: 'Subcontractors' },

  // Contacts
  { method: 'GET', path: '/rest/v1/contacts', description: 'List all contacts in your organization', auth: true, category: 'Contacts' },
  { method: 'POST', path: '/rest/v1/contacts', description: 'Create a new contact', auth: true, category: 'Contacts' },
  { method: 'GET', path: '/rest/v1/project_contacts?project_id=eq.{id}', description: 'Get contacts for a project', auth: true, category: 'Contacts' },

  // Capture Gates
  { method: 'GET', path: '/rest/v1/capture_gates?task_order_id=eq.{id}', description: 'Get capture gates for a project', auth: true, category: 'Capture Management' },
  { method: 'PUT', path: '/rest/v1/capture_gates?id=eq.{id}', description: 'Update gate status and decision', auth: true, category: 'Capture Management' },

  // Past Performance
  { method: 'GET', path: '/rest/v1/past_performance', description: 'List past performance citations', auth: true, category: 'Past Performance' },
  { method: 'POST', path: '/rest/v1/past_performance', description: 'Add a past performance citation', auth: true, category: 'Past Performance' },

  // Contract Vehicles
  { method: 'GET', path: '/rest/v1/contract_vehicles', description: 'List contract vehicles', auth: true, category: 'Contract Vehicles' },
  { method: 'POST', path: '/rest/v1/contract_vehicles', description: 'Add a contract vehicle', auth: true, category: 'Contract Vehicles' },

  // AI Functions
  { method: 'POST', path: '/.netlify/functions/analyze-document', description: 'AI analysis of uploaded RFP/SOW documents', auth: true, category: 'AI Analysis' },
  { method: 'POST', path: '/.netlify/functions/ai-proxy', description: 'General AI proxy for all AI-powered features', auth: true, category: 'AI Analysis' },
]

const METHOD_COLORS: Record<string, string> = {
  GET: 'bg-green-100 text-green-700',
  POST: 'bg-blue-100 text-blue-700',
  PUT: 'bg-amber-100 text-amber-700',
  DELETE: 'bg-red-100 text-red-700',
}

function CodeBlock({ code }: { code: string }) {
  const [copied, setCopied] = useState(false)

  function handleCopy() {
    navigator.clipboard.writeText(code)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="relative bg-slate-900 rounded-xl p-4 text-sm font-mono overflow-x-auto">
      <button
        onClick={handleCopy}
        className="absolute top-2 right-2 p-1.5 bg-slate-700 hover:bg-slate-600 rounded text-slate-300"
      >
        {copied ? <Check size={12} /> : <Copy size={12} />}
      </button>
      <pre className="text-slate-300 whitespace-pre-wrap">{code}</pre>
    </div>
  )
}

export default function ApiDocsPage() {
  const categories = [...new Set(endpoints.map(e => e.category))]

  return (
    <div className="min-h-screen bg-white">
      <Header />

      {/* Hero */}
      <section className="pt-28 pb-16 bg-gradient-to-b from-slate-900 to-slate-800 text-white">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <motion.div initial="hidden" animate="visible" variants={stagger}>
            <motion.div variants={fadeUp} className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-500/20 text-emerald-300 text-xs font-semibold mb-6">
              <Code2 className="w-3.5 h-3.5" />
              API Documentation
            </motion.div>
            <motion.h1 variants={fadeUp} className="text-3xl sm:text-4xl lg:text-5xl font-extrabold leading-tight mb-6">
              Build on{' '}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-blue-400">
                Procuvex
              </span>
            </motion.h1>
            <motion.p variants={fadeUp} className="text-lg text-slate-300 max-w-2xl mx-auto">
              Procuvex exposes a full REST API powered by Supabase PostgREST. Authenticate with JWT tokens 
              and interact with projects, subcontractors, contacts, and AI features programmatically.
            </motion.p>
          </motion.div>
        </div>
      </section>

      {/* Authentication */}
      <section className="py-16">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={stagger}>
            <motion.h2 variants={fadeUp} className="text-2xl font-bold text-slate-900 mb-6">
              Authentication
            </motion.h2>

            <motion.div variants={fadeUp} className="space-y-6">
              <div className="bg-white rounded-xl border border-slate-200 p-6">
                <div className="flex items-center gap-2 mb-3">
                  <Key size={18} className="text-amber-500" />
                  <h3 className="font-bold text-slate-900">JWT Authentication</h3>
                </div>
                <p className="text-sm text-slate-600 mb-4">
                  All API requests require a valid JWT access token. Obtain one by authenticating through 
                  the Supabase Auth endpoint.
                </p>
                <CodeBlock code={`# Authenticate and get access token
curl -X POST 'https://your-project.supabase.co/auth/v1/token?grant_type=password' \\
  -H 'apikey: YOUR_ANON_KEY' \\
  -H 'Content-Type: application/json' \\
  -d '{"email": "user@example.com", "password": "your-password"}'

# Use the access_token in subsequent requests
curl 'https://your-project.supabase.co/rest/v1/task_orders' \\
  -H 'apikey: YOUR_ANON_KEY' \\
  -H 'Authorization: Bearer ACCESS_TOKEN'`} />
              </div>

              <div className="grid sm:grid-cols-3 gap-4">
                <div className="bg-slate-50 rounded-xl border border-slate-200 p-4">
                  <Shield size={18} className="text-blue-500 mb-2" />
                  <h4 className="font-bold text-sm text-slate-900 mb-1">Row-Level Security</h4>
                  <p className="text-xs text-slate-600">
                    All queries are automatically scoped to your organization. You can only access data belonging to your org.
                  </p>
                </div>
                <div className="bg-slate-50 rounded-xl border border-slate-200 p-4">
                  <Zap size={18} className="text-amber-500 mb-2" />
                  <h4 className="font-bold text-sm text-slate-900 mb-1">Rate Limiting</h4>
                  <p className="text-xs text-slate-600">
                    Enterprise: 100 AI calls/hour, 1000 API calls/min. Growth: 50 AI calls/hour, 500 API calls/min.
                  </p>
                </div>
                <div className="bg-slate-50 rounded-xl border border-slate-200 p-4">
                  <Globe size={18} className="text-green-500 mb-2" />
                  <h4 className="font-bold text-sm text-slate-900 mb-1">REST + Realtime</h4>
                  <p className="text-xs text-slate-600">
                    Full CRUD via REST. Subscribe to real-time changes via Supabase Realtime channels.
                  </p>
                </div>
              </div>
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* Endpoints */}
      <section className="py-16 bg-slate-50">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={stagger}>
            <motion.h2 variants={fadeUp} className="text-2xl font-bold text-slate-900 mb-6">
              Endpoints
            </motion.h2>

            {categories.map(cat => (
              <motion.div key={cat} variants={fadeUp} className="mb-8">
                <h3 className="text-lg font-bold text-slate-800 mb-3 flex items-center gap-2">
                  <FileText size={16} className="text-blue-500" />
                  {cat}
                </h3>
                <div className="space-y-2">
                  {endpoints.filter(e => e.category === cat).map((ep, i) => (
                    <div key={i} className="bg-white rounded-lg border border-slate-200 px-4 py-3 flex items-center gap-3">
                      <span className={`px-2 py-0.5 rounded text-xs font-bold ${METHOD_COLORS[ep.method]}`}>
                        {ep.method}
                      </span>
                      <code className="text-sm text-slate-800 font-mono flex-1">{ep.path}</code>
                      <span className="text-xs text-slate-500 hidden sm:inline">{ep.description}</span>
                      {ep.auth && <Lock size={12} className="text-slate-400" />}
                    </div>
                  ))}
                </div>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* Examples */}
      <section className="py-16">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={stagger}>
            <motion.h2 variants={fadeUp} className="text-2xl font-bold text-slate-900 mb-6">
              Examples
            </motion.h2>

            <motion.div variants={fadeUp} className="space-y-6">
              <div>
                <h3 className="font-bold text-slate-800 mb-2">List all projects</h3>
                <CodeBlock code={`curl 'https://your-project.supabase.co/rest/v1/task_orders?select=id,title,status,due_date' \\
  -H 'apikey: YOUR_ANON_KEY' \\
  -H 'Authorization: Bearer ACCESS_TOKEN'`} />
              </div>

              <div>
                <h3 className="font-bold text-slate-800 mb-2">Create a new project</h3>
                <CodeBlock code={`curl -X POST 'https://your-project.supabase.co/rest/v1/task_orders' \\
  -H 'apikey: YOUR_ANON_KEY' \\
  -H 'Authorization: Bearer ACCESS_TOKEN' \\
  -H 'Content-Type: application/json' \\
  -d '{
    "title": "IDIQ Task Order — Fort Bragg",
    "solicitation_number": "W9124D-25-R-0042",
    "status": "in_progress",
    "due_date": "2025-06-15",
    "estimated_value": "47500000",
    "naics_code": "561210"
  }'`} />
              </div>

              <div>
                <h3 className="font-bold text-slate-800 mb-2">Get capture gates for a project</h3>
                <CodeBlock code={`curl 'https://your-project.supabase.co/rest/v1/capture_gates?task_order_id=eq.PROJECT_ID&order=gate_number' \\
  -H 'apikey: YOUR_ANON_KEY' \\
  -H 'Authorization: Bearer ACCESS_TOKEN'`} />
              </div>
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-16 bg-slate-900 text-white">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={stagger}>
            <motion.h2 variants={fadeUp} className="text-2xl sm:text-3xl font-bold mb-4">
              Ready to Build?
            </motion.h2>
            <motion.p variants={fadeUp} className="text-slate-400 max-w-lg mx-auto mb-8">
              Enterprise customers get full API access with dedicated support for custom integrations.
            </motion.p>
            <motion.div variants={fadeUp}>
              <Link
                to="/contact"
                className="inline-flex items-center gap-2 px-6 py-3 text-sm font-bold text-white bg-gradient-to-r from-blue-600 to-indigo-600 rounded-xl shadow-lg"
              >
                Contact Us for API Access
                <ArrowRight className="w-4 h-4" />
              </Link>
            </motion.div>
          </motion.div>
        </div>
      </section>

      <Footer />
    </div>
  )
}
