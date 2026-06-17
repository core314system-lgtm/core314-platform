import { useRef } from 'react'
import { motion } from 'framer-motion'
import { Link } from 'react-router-dom'
import { Play, ArrowRight, Clock, FileText, Users, Brain, Shield, BarChart3, Kanban, Bot } from 'lucide-react'
import Header from '../components/Header'
import Footer from '../components/Footer'

const fadeUp = { hidden: { opacity: 0, y: 30 }, visible: { opacity: 1, y: 0 } }

function parseTime(t: string): number {
  const parts = t.split(':').map(Number)
  if (parts.length === 2) return parts[0] * 60 + parts[1]
  return parts[0] * 3600 + parts[1] * 60 + parts[2]
}

const chapters = [
  { time: '0:00', title: 'Introduction & Dashboard', icon: Play },
  { time: '0:38', title: 'Company Profile & Preferences', icon: FileText },
  { time: '3:12', title: 'Opportunity Discovery (SAM.gov)', icon: BarChart3 },
  { time: '4:42', title: 'Project Setup & Document Upload', icon: FileText },
  { time: '6:35', title: 'AI Analysis & Requirements', icon: Brain },
  { time: '9:03', title: 'SOW Tracker & Scope Management', icon: Kanban },
  { time: '10:10', title: 'Private Subcontractor Database', icon: Shield },
  { time: '12:05', title: 'Find Subcontractors & AI Matching', icon: Users },
  { time: '14:20', title: 'RFQ Compose & Send', icon: FileText },
  { time: '15:57', title: 'Portal Form Configuration', icon: FileText },
  { time: '16:54', title: 'Subcontractor Email Experience', icon: FileText },
  { time: '17:56', title: 'Subcontractor Portal & Quote', icon: Users },
  { time: '20:04', title: 'AI Compliance & Gap Notification', icon: Brain },
  { time: '22:30', title: 'Pricing Decision Matrix', icon: BarChart3 },
  { time: '24:13', title: 'AI Agent Hub', icon: Bot },
  { time: '26:00', title: 'Document Library', icon: FileText },
  { time: '26:50', title: 'Pipeline View', icon: Kanban },
  { time: '27:28', title: 'Analytics & Intelligence', icon: BarChart3 },
  { time: '28:42', title: 'Contracts & Task Orders', icon: FileText },
  { time: '29:12', title: 'Ask Procuvex AI Chatbot', icon: Bot },
  { time: '29:58', title: 'Getting Started Guide', icon: Play },
  { time: '30:25', title: 'Business Impact & ROI', icon: BarChart3 },
  { time: '31:43', title: 'Start Your Free Trial', icon: ArrowRight },
]

export default function DemoPage() {
  const videoRef = useRef<HTMLVideoElement>(null)

  function jumpTo(time: string) {
    const video = videoRef.current
    if (!video) return
    video.currentTime = parseTime(time)
    video.play()
    video.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <Header />

      {/* Hero + Video */}
      <section className="pt-28 pb-16 px-4">
        <div className="max-w-5xl mx-auto text-center">
          <motion.div
            initial="hidden"
            animate="visible"
            variants={fadeUp}
            transition={{ duration: 0.5 }}
            className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 text-sm font-medium mb-6"
          >
            <Clock className="h-4 w-4" />
            33-Minute Full Platform Demo
          </motion.div>

          <motion.h1
            initial="hidden"
            animate="visible"
            variants={fadeUp}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="text-4xl md:text-5xl font-bold mb-4"
          >
            See Procuvex{' '}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-indigo-400">
              In Action
            </span>
          </motion.h1>

          <motion.p
            initial="hidden"
            animate="visible"
            variants={fadeUp}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="text-lg text-slate-400 max-w-2xl mx-auto mb-10"
          >
            Watch a complete walkthrough of every feature — from uploading your first document to
            winning more contracts with AI-powered intelligence.
          </motion.p>

          <motion.div
            initial="hidden"
            animate="visible"
            variants={fadeUp}
            transition={{ duration: 0.5, delay: 0.3 }}
            className="rounded-xl overflow-hidden shadow-2xl shadow-blue-900/20 border border-slate-800"
          >
            <video
              ref={videoRef}
              controls
              preload="metadata"
              className="w-full aspect-video bg-slate-900"
            >
              <source
                src="/procuvex-demo.mp4"
                type="video/mp4"
              />
              Your browser does not support the video tag.
            </video>
          </motion.div>
        </div>
      </section>

      {/* Chapter Markers */}
      <section className="py-16 px-4 border-t border-slate-800">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-2xl font-bold text-center mb-10">Jump to Any Section</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {chapters.map((ch) => {
              const Icon = ch.icon
              return (
                <button
                  key={ch.time}
                  onClick={() => jumpTo(ch.time)}
                  className="flex items-center gap-3 px-4 py-3 rounded-lg bg-slate-900/50 border border-slate-800 hover:border-blue-500/30 hover:bg-slate-800/50 transition-colors cursor-pointer text-left"
                >
                  <Icon className="h-4 w-4 text-blue-400 flex-shrink-0" />
                  <span className="text-sm font-mono text-slate-500 flex-shrink-0">{ch.time}</span>
                  <span className="text-sm text-slate-300">{ch.title}</span>
                </button>
              )
            })}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 px-4 border-t border-slate-800">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-3xl font-bold mb-4">Ready to Win More Contracts?</h2>
          <p className="text-slate-400 mb-8">
            Start your 7-day free trial. Full platform access from day one.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              to="/pricing"
              className="inline-flex items-center gap-2 px-8 py-3.5 text-base font-bold text-white bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 rounded-xl shadow-lg shadow-blue-600/25 transition-all"
            >
              Start Free Trial
              <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              to="/product"
              className="inline-flex items-center px-8 py-3.5 text-base font-semibold text-slate-300 border border-slate-700 hover:border-slate-500 rounded-xl transition-colors"
            >
              Explore Features
            </Link>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  )
}
