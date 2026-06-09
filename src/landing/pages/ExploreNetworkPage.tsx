import { motion, useInView } from 'framer-motion'
import { useState, useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import {
  Search, Users, Building2, Shield, Zap, Wrench, HardHat,
  ArrowRight, Globe, Star, TrendingUp,
  MapPin, BarChart3, Target, Brain, FileCheck,
  Thermometer, Droplets, Flame, Sparkles, TreePine, Bug,
  Wifi, Cpu, Layers, Truck, Award,
} from 'lucide-react'
import Header from '../components/Header'
import Footer from '../components/Footer'
import { supabase } from '../../lib/supabase'

const fadeUp = { hidden: { opacity: 0, y: 24 }, visible: { opacity: 1, y: 0 } }
const stagger = { visible: { transition: { staggerChildren: 0.06 } } }

// Icon mapping for trade categories
const TRADE_ICONS: Record<string, any> = {
  hvac: Thermometer, electrical: Zap, plumbing: Droplets,
  fire_safety: Flame, janitorial: Sparkles, landscaping: TreePine,
  pest_control: Bug, roofing: HardHat, security: Shield,
  general_construction: Building2, it_telecom: Wifi, building_automation: Cpu,
  mechanical: Wrench, engineering: Target, flooring: Layers,
  consulting: Star, environmental: Globe, staffing: Users,
  dock_equipment: Truck,
}

// --- Animated Counter ---
function AnimatedCounter({ end, duration = 2000, suffix = '' }: { end: number; duration?: number; suffix?: string }) {
  const [count, setCount] = useState(0)
  const ref = useRef<HTMLSpanElement>(null)
  const isInView = useInView(ref, { once: true })

  useEffect(() => {
    if (!isInView) return
    let start = 0
    const increment = end / (duration / 16)
    const timer = setInterval(() => {
      start += increment
      if (start >= end) { setCount(end); clearInterval(timer) }
      else { setCount(Math.floor(start)) }
    }, 16)
    return () => clearInterval(timer)
  }, [isInView, end, duration])

  return <span ref={ref}>{count.toLocaleString()}{suffix}</span>
}

interface CategoryStat {
  id: string
  name: string
  count: number
}

interface StateStat {
  state: string
  count: number
}

export default function ExploreNetworkPage() {
  const [stats, setStats] = useState({ total: 0, contactable: 0, small_business: 0, verified: 0, states_covered: 50, trade_categories: 45 })
  const [categories, setCategories] = useState<CategoryStat[]>([])
  const [states, setStates] = useState<StateStat[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<CategoryStat[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchData() {
      try {
        // Fetch stats with category detail
        const { count: totalCount } = await supabase
          .from('master_subcontractors')
          .select('*', { count: 'exact', head: true })

        const { count: withEmail } = await supabase
          .from('master_subcontractors')
          .select('*', { count: 'exact', head: true })
          .not('contact_email', 'is', null)

        const { count: smallBiz } = await supabase
          .from('master_subcontractors')
          .select('*', { count: 'exact', head: true })
          .eq('small_business', true)

        const { count: verifiedCount } = await supabase
          .from('master_subcontractors')
          .select('*', { count: 'exact', head: true })
          .in('verification_status', ['verified', 'claimed'])

        setStats({
          total: totalCount || 0,
          contactable: withEmail || 0,
          small_business: smallBiz || 0,
          verified: verifiedCount || 0,
          states_covered: 50,
          trade_categories: 45,
        })

        // Get category counts — query by stored category names for accuracy
        const CATEGORY_NAMES_MAP: Record<string, string> = {
          hvac: 'HVAC', electrical: 'Electrical', plumbing: 'Plumbing',
          fire_safety: 'Fire & Life Safety', elevator: 'Elevator & Escalator',
          janitorial: 'Janitorial & Custodial', landscaping: 'Landscaping & Grounds',
          snow_removal: 'Snow & Ice Removal', pest_control: 'Pest Control',
          roofing: 'Roofing', painting: 'Painting & Coatings', flooring: 'Flooring',
          security: 'Security Systems', general_construction: 'General Construction',
          demolition: 'Demolition', concrete: 'Concrete & Masonry',
          structural_steel: 'Structural Steel', environmental: 'Environmental Services',
          waste_management: 'Waste Management', it_telecom: 'IT & Telecommunications',
          building_automation: 'Building Automation', generator: 'Emergency Power',
          dock_equipment: 'Dock & Loading Equipment', glass_glazing: 'Glass & Glazing',
          insulation: 'Insulation', drywall: 'Drywall & Framing',
          mechanical: 'Mechanical Services', welding: 'Welding & Metal Work',
          paving: 'Paving & Asphalt', fencing: 'Fencing', signage: 'Signage',
          food_services: 'Food Services', moving_logistics: 'Moving & Logistics',
          furniture: 'Furniture & Installation', engineering: 'Engineering Services',
          architectural: 'Architectural Services', surveying: 'Surveying & Geotechnical',
          abatement: 'Abatement', waterproofing: 'Waterproofing',
          fire_protection: 'Fire Protection', testing_inspection: 'Testing & Inspection',
          staffing: 'Staffing & Labor', consulting: 'Consulting', training: 'Training',
        }

        const categoryCountPromises = Object.entries(CATEGORY_NAMES_MAP).map(async ([id, name]) => {
          const { count } = await supabase
            .from('master_subcontractors')
            .select('*', { count: 'exact', head: true })
            .contains('trade_categories', [name])
          return { id, count: count || 0 }
        })

        const categoryResults = await Promise.all(categoryCountPromises)
        const categoryCounts: Record<string, number> = {}
        categoryResults.forEach(r => {
          if (r.count > 0) categoryCounts[r.id] = r.count
        })

        const sortedCategories = Object.entries(categoryCounts)
          .map(([id, count]) => ({ id, name: CATEGORY_NAMES_MAP[id] || id, count }))
          .sort((a, b) => b.count - a.count)

        setCategories(sortedCategories)

        // Get state counts using individual queries for accuracy
        const US_STATES = [
          'AL','AK','AZ','AR','CA','CO','CT','DE','FL','GA',
          'HI','ID','IL','IN','IA','KS','KY','LA','ME','MD',
          'MA','MI','MN','MS','MO','MT','NE','NV','NH','NJ',
          'NM','NY','NC','ND','OH','OK','OR','PA','RI','SC',
          'SD','TN','TX','UT','VT','VA','WA','WV','WI','WY','DC',
        ]

        const stateCountPromises = US_STATES.map(async (st) => {
          const { count } = await supabase
            .from('master_subcontractors')
            .select('*', { count: 'exact', head: true })
            .ilike('state', st)
          return { state: st, count: count || 0 }
        })

        const stateResults = await Promise.all(stateCountPromises)
        const sortedStates = stateResults
          .filter(s => s.count > 0)
          .sort((a, b) => b.count - a.count)

        setStates(sortedStates)
      } catch (err) {
        console.error('Failed to fetch network stats:', err)
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [])

  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults([])
      return
    }
    const q = searchQuery.toLowerCase()
    const filtered = categories.filter(c =>
      c.name.toLowerCase().includes(q) || c.id.includes(q)
    )
    setSearchResults(filtered)
  }, [searchQuery, categories])

  const topCategories = categories.slice(0, 12)
  const topStates = states.slice(0, 10)

  return (
    <div className="min-h-screen bg-white">
      <Header />

      {/* Hero Section */}
      <section className="relative bg-gradient-to-br from-slate-900 via-blue-900 to-indigo-900 pt-32 pb-24 overflow-hidden">
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-20 left-10 w-72 h-72 bg-blue-500 rounded-full blur-3xl" />
          <div className="absolute bottom-10 right-20 w-96 h-96 bg-indigo-500 rounded-full blur-3xl" />
        </div>

        <div className="relative max-w-7xl mx-auto px-4 text-center">
          <motion.div initial="hidden" animate="visible" variants={stagger}>
            <motion.p variants={fadeUp} className="text-blue-300 font-medium text-lg mb-4">
              The Procuvex Subcontractor Network
            </motion.p>
            <motion.h1 variants={fadeUp} className="text-5xl md:text-7xl font-bold text-white mb-6">
              <AnimatedCounter end={stats.total} suffix="+" /> Subcontractors
            </motion.h1>
            <motion.p variants={fadeUp} className="text-xl md:text-2xl text-blue-100 max-w-3xl mx-auto mb-12">
              The largest searchable database of government-registered subcontractors.
              AI-matched to your SOW requirements in seconds.
            </motion.p>

            {/* Stats Row */}
            <motion.div variants={fadeUp} className="grid grid-cols-2 md:grid-cols-4 gap-8 max-w-4xl mx-auto">
              <div className="text-center">
                <div className="text-3xl md:text-4xl font-bold text-white">
                  <AnimatedCounter end={stats.small_business} suffix="+" />
                </div>
                <div className="text-sm text-blue-200 mt-1">Small Businesses</div>
              </div>
              <div className="text-center">
                <div className="text-3xl md:text-4xl font-bold text-white">
                  <AnimatedCounter end={stats.contactable} suffix="+" />
                </div>
                <div className="text-sm text-blue-200 mt-1">With Direct Contact</div>
              </div>
              <div className="text-center">
                <div className="text-3xl md:text-4xl font-bold text-white">
                  <AnimatedCounter end={50} />
                </div>
                <div className="text-sm text-blue-200 mt-1">States Covered</div>
              </div>
              <div className="text-center">
                <div className="text-3xl md:text-4xl font-bold text-white">
                  <AnimatedCounter end={45} suffix="+" />
                </div>
                <div className="text-sm text-blue-200 mt-1">Trade Categories</div>
              </div>
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* Category Search */}
      <section className="py-20 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4">
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={stagger} className="text-center mb-12">
            <motion.h2 variants={fadeUp} className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
              Explore by Trade Category
            </motion.h2>
            <motion.p variants={fadeUp} className="text-lg text-gray-600 max-w-2xl mx-auto mb-8">
              Search our network to see how many qualified subcontractors are ready in each trade.
              Sign up to connect instantly.
            </motion.p>

            {/* Search Bar */}
            <motion.div variants={fadeUp} className="max-w-xl mx-auto relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Search trades... (e.g., Electrical, HVAC, IT)"
                className="w-full pl-12 pr-4 py-4 rounded-xl border-2 border-gray-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 text-lg outline-none transition-all"
              />
            </motion.div>

            {/* Search Results */}
            {searchResults.length > 0 && (
              <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="max-w-xl mx-auto mt-4 space-y-2">
                {searchResults.map(cat => {
                  const Icon = TRADE_ICONS[cat.id] || Building2
                  return (
                    <div key={cat.id} className="flex items-center justify-between p-4 bg-white rounded-xl border border-gray-200 hover:border-blue-300 hover:shadow-md transition-all">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-blue-50 rounded-lg">
                          <Icon size={20} className="text-blue-600" />
                        </div>
                        <span className="font-semibold text-gray-900">{cat.name}</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-2xl font-bold text-blue-600">{cat.count.toLocaleString()}</span>
                        <span className="text-sm text-gray-500">available</span>
                      </div>
                    </div>
                  )
                })}
              </motion.div>
            )}
          </motion.div>

          {/* Top Categories Grid */}
          {!searchQuery && (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {loading ? (
                <div className="col-span-full text-center py-12 text-gray-500">Loading network data...</div>
              ) : (
                topCategories.map(cat => {
                  const Icon = TRADE_ICONS[cat.id] || Building2
                  return (
                    <motion.div
                      key={cat.id}
                      initial={{ opacity: 0, y: 16 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.3 }}
                      className="relative p-6 bg-white rounded-2xl border border-gray-100 hover:border-blue-200 hover:shadow-lg transition-all group cursor-default"
                    >
                      <div className="flex items-start justify-between mb-3">
                        <div className="p-2.5 bg-blue-50 rounded-xl group-hover:bg-blue-100 transition-colors">
                          <Icon size={22} className="text-blue-600" />
                        </div>
                        <span className="text-2xl font-bold text-blue-600">{cat.count.toLocaleString()}</span>
                      </div>
                      <h3 className="font-semibold text-gray-900 text-sm">{cat.name}</h3>
                      <p className="text-xs text-gray-500 mt-1">subcontractors available</p>
                    </motion.div>
                  )
                })
              )}
            </div>
          )}

          {!searchQuery && categories.length > 12 && (
            <div className="text-center mt-8">
              <p className="text-gray-500">
                + {categories.length - 12} more trade categories available.{' '}
                <Link to="/login" className="text-blue-600 font-medium hover:underline">
                  Sign up to search all →
                </Link>
              </p>
            </div>
          )}
        </div>
      </section>

      {/* Coverage by State */}
      <section className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4">
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={stagger}>
            <motion.h2 variants={fadeUp} className="text-3xl md:text-4xl font-bold text-gray-900 text-center mb-4">
              Nationwide Coverage
            </motion.h2>
            <motion.p variants={fadeUp} className="text-lg text-gray-600 text-center max-w-2xl mx-auto mb-12">
              Subcontractors across all 50 states — find qualified teams wherever your project is.
            </motion.p>

            <motion.div variants={fadeUp} className="grid grid-cols-2 md:grid-cols-5 gap-3 max-w-4xl mx-auto">
              {topStates.map(s => (
                <div key={s.state} className="flex items-center justify-between p-3 bg-gray-50 rounded-xl border border-gray-100">
                  <div className="flex items-center gap-2">
                    <MapPin size={14} className="text-blue-500" />
                    <span className="font-medium text-gray-900 text-sm">{s.state}</span>
                  </div>
                  <span className="text-sm font-bold text-blue-600">{s.count.toLocaleString()}</span>
                </div>
              ))}
            </motion.div>
            {states.length > 10 && (
              <p className="text-center text-gray-500 mt-6 text-sm">
                Showing top 10 states. {states.length} states with active subcontractors.
              </p>
            )}
          </motion.div>
        </div>
      </section>

      {/* How It Works — For Primes */}
      <section className="py-20 bg-gradient-to-b from-gray-50 to-white">
        <div className="max-w-7xl mx-auto px-4">
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={stagger}>
            <motion.div variants={fadeUp} className="text-center mb-16">
              <span className="inline-block px-4 py-1.5 bg-blue-100 text-blue-700 rounded-full text-sm font-medium mb-4">
                For Prime Contractors & Enterprises
              </span>
              <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
                Match Subcontractors to Your SOW — In Seconds
              </h2>
              <p className="text-lg text-gray-600 max-w-2xl mx-auto">
                Stop spending weeks finding qualified subs. Upload your scope of work and let AI do the matching.
              </p>
            </motion.div>

            <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
              {[
                {
                  step: '1',
                  icon: FileCheck,
                  title: 'Upload Your SOW',
                  desc: 'Drop your scope of work document. AI extracts required trades, certifications, location, and SBA requirements automatically.',
                },
                {
                  step: '2',
                  icon: Brain,
                  title: 'AI Matches Qualified Subs',
                  desc: `Instantly matched against ${stats.total.toLocaleString()}+ subcontractors by trade, location, certification, and availability. Ranked by qualification score.`,
                },
                {
                  step: '3',
                  icon: Zap,
                  title: 'Connect & Send RFQs',
                  desc: 'One-click outreach to your top matches. Track responses, compare quotes, and build your team — all from one platform.',
                },
              ].map(item => (
                <motion.div key={item.step} variants={fadeUp} className="relative p-8 bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-lg transition-all">
                  <div className="absolute -top-4 -left-4 w-10 h-10 bg-blue-600 rounded-full flex items-center justify-center text-white font-bold text-lg shadow-lg">
                    {item.step}
                  </div>
                  <div className="p-3 bg-blue-50 rounded-xl inline-block mb-4">
                    <item.icon size={28} className="text-blue-600" />
                  </div>
                  <h3 className="text-xl font-bold text-gray-900 mb-2">{item.title}</h3>
                  <p className="text-gray-600 leading-relaxed">{item.desc}</p>
                </motion.div>
              ))}
            </div>
          </motion.div>
        </div>
      </section>

      {/* Comparison Table */}
      <section className="py-20 bg-white">
        <div className="max-w-5xl mx-auto px-4">
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={stagger}>
            <motion.h2 variants={fadeUp} className="text-3xl md:text-4xl font-bold text-gray-900 text-center mb-4">
              Traditional Procurement vs. Procuvex
            </motion.h2>
            <motion.p variants={fadeUp} className="text-lg text-gray-600 text-center max-w-2xl mx-auto mb-12">
              See why enterprise contractors are switching to AI-powered subcontractor matching.
            </motion.p>

            <motion.div variants={fadeUp} className="overflow-hidden rounded-2xl border border-gray-200 shadow-sm">
              <table className="w-full">
                <thead>
                  <tr className="bg-gray-50">
                    <th className="text-left p-5 text-gray-600 font-medium">Task</th>
                    <th className="text-center p-5 text-gray-600 font-medium">Traditional</th>
                    <th className="text-center p-5 text-blue-700 font-bold bg-blue-50">Procuvex</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    { task: 'Find qualified subcontractors', old: '2–4 weeks', new: '60 seconds' },
                    { task: 'Verify SBA certifications', old: 'Manual SAM.gov lookup', new: 'Auto-verified' },
                    { task: 'Send RFQs to matched subs', old: 'Individual emails', new: 'Batch with tracking' },
                    { task: 'Small business compliance', old: 'Spreadsheet tracking', new: 'Automated reporting' },
                    { task: 'Track sub responses', old: 'Email chains', new: 'Real-time dashboard' },
                    { task: 'Database size', old: 'Your contacts only', new: `${stats.total.toLocaleString()}+ verified subs` },
                  ].map((row, i) => (
                    <tr key={i} className="border-t border-gray-100">
                      <td className="p-5 font-medium text-gray-900">{row.task}</td>
                      <td className="p-5 text-center text-gray-500">{row.old}</td>
                      <td className="p-5 text-center font-semibold text-blue-700 bg-blue-50/50">{row.new}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* For Subcontractors — Get Found */}
      <section className="py-20 bg-gradient-to-br from-indigo-900 via-blue-900 to-slate-900">
        <div className="max-w-7xl mx-auto px-4">
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={stagger}>
            <motion.div variants={fadeUp} className="text-center mb-16">
              <span className="inline-block px-4 py-1.5 bg-white/10 text-blue-200 rounded-full text-sm font-medium mb-4 border border-white/20">
                For Subcontractors
              </span>
              <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
                Get Found by Prime Contractors — For Free
              </h2>
              <p className="text-xl text-blue-100 max-w-2xl mx-auto">
                Enterprise primes are actively searching for subcontractors in your trade.
                Claim your profile to appear in their results.
              </p>
            </motion.div>

            <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto mb-12">
              {[
                {
                  icon: Globe,
                  title: 'Visible to Enterprise Primes',
                  desc: 'Your profile is searchable by registered prime contractors looking to build teams for government and commercial projects.',
                },
                {
                  icon: Zap,
                  title: 'Automatic Opportunity Matching',
                  desc: 'Get notified instantly when a new opportunity matches your trade, location, and certifications. No hunting for RFPs.',
                },
                {
                  icon: Shield,
                  title: 'Verified = Priority Placement',
                  desc: 'Verified subcontractors appear first in search results, get trust badges, and receive 3x more connection requests.',
                },
              ].map((item, i) => (
                <motion.div key={i} variants={fadeUp} className="p-8 bg-white/5 backdrop-blur-sm rounded-2xl border border-white/10 hover:border-white/20 transition-all">
                  <div className="p-3 bg-blue-500/20 rounded-xl inline-block mb-4">
                    <item.icon size={28} className="text-blue-300" />
                  </div>
                  <h3 className="text-xl font-bold text-white mb-2">{item.title}</h3>
                  <p className="text-blue-200 leading-relaxed">{item.desc}</p>
                </motion.div>
              ))}
            </div>

            <motion.div variants={fadeUp} className="text-center">
              <p className="text-blue-200 mb-6 text-lg">
                Your data comes from SAM.gov, GSA eLibrary, and SBA databases — public records you've already submitted.
                We just make you findable.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Link
                  to="/for-subcontractors"
                  className="inline-flex items-center gap-2 px-8 py-4 bg-white text-blue-900 rounded-xl font-bold text-lg hover:bg-blue-50 transition-all shadow-xl"
                >
                  Claim Your Profile <ArrowRight size={20} />
                </Link>
                <Link
                  to="/login"
                  className="inline-flex items-center gap-2 px-8 py-4 bg-transparent text-white border-2 border-white/30 rounded-xl font-bold text-lg hover:bg-white/10 transition-all"
                >
                  Sign In
                </Link>
              </div>
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* What Makes Us Different */}
      <section className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4">
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={stagger}>
            <motion.h2 variants={fadeUp} className="text-3xl md:text-4xl font-bold text-gray-900 text-center mb-4">
              Why Procuvex Is Different
            </motion.h2>
            <motion.p variants={fadeUp} className="text-lg text-gray-600 text-center max-w-2xl mx-auto mb-12">
              Not just a directory — a living, scored network that gets smarter with every interaction.
            </motion.p>

            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
              {[
                { icon: Award, title: 'Government-Verified Data', desc: 'Every sub sourced from SAM.gov, GSA eLibrary, and SBA databases. Not self-reported.' },
                { icon: Brain, title: 'AI SOW Matching', desc: 'Upload a scope of work — AI extracts requirements and matches to qualified subs automatically.' },
                { icon: BarChart3, title: 'Live Data Quality Scoring', desc: 'See profile completeness, contactability, and verification status before you reach out.' },
                { icon: TrendingUp, title: 'Response Intelligence', desc: 'Track which subs respond, how fast, and their win rate. Find subs who actually engage.' },
              ].map((item, i) => (
                <motion.div key={i} variants={fadeUp} className="p-6 bg-gray-50 rounded-2xl border border-gray-100 hover:border-blue-200 hover:shadow-md transition-all">
                  <div className="p-2.5 bg-blue-100 rounded-xl inline-block mb-4">
                    <item.icon size={24} className="text-blue-600" />
                  </div>
                  <h3 className="font-bold text-gray-900 mb-2">{item.title}</h3>
                  <p className="text-sm text-gray-600 leading-relaxed">{item.desc}</p>
                </motion.div>
              ))}
            </div>
          </motion.div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 bg-gradient-to-r from-blue-600 to-indigo-600">
        <div className="max-w-4xl mx-auto px-4 text-center">
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={stagger}>
            <motion.h2 variants={fadeUp} className="text-3xl md:text-4xl font-bold text-white mb-4">
              Ready to Build Your Team?
            </motion.h2>
            <motion.p variants={fadeUp} className="text-xl text-blue-100 mb-8">
              Join the primes who've already matched with {stats.total.toLocaleString()}+ subcontractors.
            </motion.p>
            <motion.div variants={fadeUp} className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link
                to="/pricing"
                className="inline-flex items-center gap-2 px-8 py-4 bg-white text-blue-700 rounded-xl font-bold text-lg hover:bg-blue-50 transition-all shadow-xl"
              >
                Start Free Trial <ArrowRight size={20} />
              </Link>
              <Link
                to="/contact"
                className="inline-flex items-center gap-2 px-8 py-4 bg-transparent text-white border-2 border-white/30 rounded-xl font-bold text-lg hover:bg-white/10 transition-all"
              >
                Request Demo
              </Link>
            </motion.div>
          </motion.div>
        </div>
      </section>

      <Footer />
    </div>
  )
}
