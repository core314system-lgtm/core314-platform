import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import {
  Building, MapPin, Mail, Phone, Globe, ShieldCheck, Star,
  BadgeCheck, FileText, ExternalLink, ArrowLeft,
  Loader2, AlertCircle, CheckCircle, Users,
} from 'lucide-react'

interface SubProfile {
  id: string
  company_name: string
  slug: string
  dba_name: string | null
  contact_name: string | null
  contact_email: string | null
  contact_phone: string | null
  website: string | null
  address_line1: string | null
  city: string | null
  state: string | null
  zip_code: string | null
  description: string | null
  sam_uei: string | null
  cage_code: string | null
  naics_codes: string[]
  service_categories: string[]
  trade_categories: string[]
  geographic_coverage: string[]
  small_business: boolean
  small_business_types: string[]
  verification_status: string
  profile_completeness: number
  data_source: string
  created_at: string
}

interface Certification {
  id: string
  cert_type: string
  cert_name: string
  issuing_authority: string | null
  expiration_date: string | null
  ai_verified: boolean
}

const CERT_TYPE_LABELS: Record<string, { label: string; color: string }> = {
  license: { label: 'License', color: 'bg-blue-100 text-blue-700' },
  insurance: { label: 'Insurance', color: 'bg-green-100 text-green-700' },
  certification: { label: 'Certification', color: 'bg-purple-100 text-purple-700' },
  w9: { label: 'W-9', color: 'bg-gray-100 text-gray-700' },
  capability_statement: { label: 'Capability Statement', color: 'bg-indigo-100 text-indigo-700' },
  bond: { label: 'Bond', color: 'bg-amber-100 text-amber-700' },
  other: { label: 'Other', color: 'bg-gray-100 text-gray-600' },
}

export default function SubProfilePublic() {
  const { slug } = useParams<{ slug: string }>()
  const [profile, setProfile] = useState<SubProfile | null>(null)
  const [certs, setCerts] = useState<Certification[]>([])
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)

  useEffect(() => {
    async function load() {
      if (!slug) { setNotFound(true); setLoading(false); return }

      const { data, error } = await supabase
        .from('master_subcontractors')
        .select('*')
        .eq('slug', slug)
        .single()

      if (error || !data) {
        setNotFound(true)
        setLoading(false)
        return
      }

      setProfile(data)

      // Load certifications
      const { data: certData } = await supabase
        .from('master_sub_certifications')
        .select('*')
        .eq('master_sub_id', data.id)
        .order('cert_type')

      setCerts(certData || [])

      // Track view
      await supabase.from('master_subcontractors')
        .update({ view_count: (data.view_count || 0) + 1 })
        .eq('id', data.id)

      setLoading(false)
    }
    load()
  }, [slug])

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loader2 className="animate-spin text-blue-600" size={32} />
      </div>
    )
  }

  if (notFound || !profile) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <AlertCircle size={48} className="mx-auto text-gray-300 mb-4" />
          <h1 className="text-xl font-bold text-gray-700 mb-2">Profile Not Found</h1>
          <p className="text-gray-500 mb-6">This subcontractor profile doesn&apos;t exist or has been removed.</p>
          <Link to="/" className="text-blue-600 hover:underline flex items-center gap-1 justify-center">
            <ArrowLeft size={16} /> Back to Procuvex
          </Link>
        </div>
      </div>
    )
  }

  const isVerified = profile.verification_status === 'verified'
  const isClaimed = profile.verification_status === 'claimed' || isVerified

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header bar */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link to="/" className="text-blue-600 hover:text-blue-700 flex items-center gap-2 text-sm">
            <ArrowLeft size={16} /> Procuvex
          </Link>
          <span className="text-xs text-gray-400">Procuvex Subcontractor Network</span>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-6 py-8 space-y-6">
        {/* Profile Header */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8">
          <div className="flex items-start gap-6">
            {/* Company Icon */}
            <div className="w-20 h-20 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-2xl flex items-center justify-center text-white text-2xl font-bold shrink-0">
              {profile.company_name.substring(0, 2).toUpperCase()}
            </div>

            <div className="flex-1">
              <div className="flex items-center gap-3">
                <h1 className="text-2xl font-bold text-gray-900">{profile.company_name}</h1>
                {isVerified && (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-bold bg-gradient-to-r from-green-500 to-emerald-600 text-white shadow-md">
                    <BadgeCheck size={16} /> Procuvex Verified
                  </span>
                )}
                {!isVerified && isClaimed && (
                  <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm font-medium bg-blue-100 text-blue-700">
                    <Users size={16} /> Claimed
                  </span>
                )}
              </div>
              {profile.dba_name && <p className="text-gray-500 mt-1">DBA: {profile.dba_name}</p>}

              <div className="flex flex-wrap items-center gap-4 mt-3 text-sm text-gray-600">
                {profile.city && profile.state && (
                  <span className="flex items-center gap-1.5"><MapPin size={15} className="text-gray-400" /> {profile.city}, {profile.state} {profile.zip_code || ''}</span>
                )}
                {profile.website && (
                  <a href={profile.website.startsWith('http') ? profile.website : `https://${profile.website}`}
                    target="_blank" rel="noopener noreferrer"
                    className="flex items-center gap-1.5 text-blue-600 hover:underline">
                    <Globe size={15} /> Website <ExternalLink size={12} />
                  </a>
                )}
                {profile.contact_phone && (
                  <a href={`tel:${profile.contact_phone}`} className="flex items-center gap-1.5 hover:text-blue-600">
                    <Phone size={15} className="text-gray-400" /> {profile.contact_phone}
                  </a>
                )}
                {profile.contact_email && (
                  <a href={`mailto:${profile.contact_email}`} className="flex items-center gap-1.5 hover:text-blue-600">
                    <Mail size={15} className="text-gray-400" /> {profile.contact_email}
                  </a>
                )}
              </div>

              {/* Profile completeness */}
              <div className="mt-4">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs text-gray-400">Profile Completeness</span>
                  <span className="text-xs font-medium text-gray-600">{profile.profile_completeness}%</span>
                </div>
                <div className="w-full max-w-xs h-2 bg-gray-200 rounded-full">
                  <div className="h-full rounded-full transition-all"
                    style={{
                      width: `${profile.profile_completeness}%`,
                      backgroundColor: profile.profile_completeness >= 80 ? '#16a34a' : profile.profile_completeness >= 50 ? '#2563eb' : '#9ca3af',
                    }}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column: Details */}
          <div className="lg:col-span-2 space-y-6">
            {/* Description */}
            {profile.description && (
              <div className="bg-white rounded-xl border border-gray-200 p-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-3">About</h2>
                <p className="text-gray-600 leading-relaxed">{profile.description}</p>
              </div>
            )}

            {/* Trade Categories */}
            {profile.trade_categories && profile.trade_categories.length > 0 && (
              <div className="bg-white rounded-xl border border-gray-200 p-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-3">Services & Trades</h2>
                <div className="flex flex-wrap gap-2">
                  {profile.trade_categories.map(t => (
                    <span key={t} className="px-3 py-1.5 bg-blue-50 text-blue-700 rounded-full text-sm font-medium">{t}</span>
                  ))}
                </div>
              </div>
            )}

            {/* NAICS Codes */}
            {profile.naics_codes && profile.naics_codes.length > 0 && (
              <div className="bg-white rounded-xl border border-gray-200 p-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-3">NAICS Codes</h2>
                <div className="flex flex-wrap gap-2">
                  {profile.naics_codes.map(c => (
                    <span key={c} className="px-3 py-1.5 bg-gray-100 text-gray-700 rounded-lg text-sm font-mono">{c}</span>
                  ))}
                </div>
              </div>
            )}

            {/* Certifications (verified subs only) */}
            {certs.length > 0 && (
              <div className="bg-white rounded-xl border border-gray-200 p-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-3">Certifications & Documents</h2>
                <div className="space-y-2">
                  {certs.map(cert => {
                    const typeInfo = CERT_TYPE_LABELS[cert.cert_type] || CERT_TYPE_LABELS.other
                    const isExpired = cert.expiration_date && new Date(cert.expiration_date) < new Date()
                    return (
                      <div key={cert.id} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                        <FileText size={16} className="text-gray-400 shrink-0" />
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-gray-800 text-sm">{cert.cert_name}</span>
                            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${typeInfo.color}`}>{typeInfo.label}</span>
                            {cert.ai_verified && (
                              <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700 flex items-center gap-1">
                                <CheckCircle size={10} /> AI Verified
                              </span>
                            )}
                          </div>
                          {cert.issuing_authority && <span className="text-xs text-gray-500">{cert.issuing_authority}</span>}
                        </div>
                        {cert.expiration_date && (
                          <span className={`text-xs ${isExpired ? 'text-red-600 font-medium' : 'text-gray-500'}`}>
                            {isExpired ? 'Expired' : 'Expires'}: {new Date(cert.expiration_date).toLocaleDateString()}
                          </span>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Right Column: Quick Info */}
          <div className="space-y-6">
            {/* SAM.gov Info */}
            {(profile.sam_uei || profile.cage_code) && (
              <div className="bg-white rounded-xl border border-gray-200 p-6">
                <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                  <ShieldCheck size={16} className="text-blue-500" /> Government Registration
                </h3>
                <div className="space-y-2 text-sm">
                  {profile.sam_uei && (
                    <div className="flex justify-between">
                      <span className="text-gray-500">SAM UEI</span>
                      <a href={`https://sam.gov/entity/${profile.sam_uei}`} target="_blank" rel="noopener noreferrer"
                        className="text-blue-600 hover:underline font-mono text-xs flex items-center gap-1">
                        {profile.sam_uei} <ExternalLink size={11} />
                      </a>
                    </div>
                  )}
                  {profile.cage_code && (
                    <div className="flex justify-between">
                      <span className="text-gray-500">CAGE Code</span>
                      <span className="font-mono text-xs text-gray-700">{profile.cage_code}</span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Small Business */}
            {profile.small_business && profile.small_business_types && profile.small_business_types.length > 0 && (
              <div className="bg-white rounded-xl border border-gray-200 p-6">
                <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                  <Star size={16} className="text-amber-500" /> Small Business Designations
                </h3>
                <div className="flex flex-wrap gap-2">
                  {profile.small_business_types.map(t => (
                    <span key={t} className="px-3 py-1.5 bg-amber-50 text-amber-700 rounded-full text-sm font-medium">{t}</span>
                  ))}
                </div>
              </div>
            )}

            {/* Geographic Coverage */}
            {profile.geographic_coverage && profile.geographic_coverage.length > 0 && (
              <div className="bg-white rounded-xl border border-gray-200 p-6">
                <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                  <MapPin size={16} className="text-green-500" /> Service Area
                </h3>
                <div className="flex flex-wrap gap-2">
                  {profile.geographic_coverage.map(g => (
                    <span key={g} className="px-2 py-1 bg-green-50 text-green-700 rounded text-sm">{g}</span>
                  ))}
                </div>
              </div>
            )}

            {/* CTA for unclaimed profiles */}
            {!isClaimed && (
              <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl border border-blue-200 p-6 text-center">
                <Building size={28} className="mx-auto text-blue-500 mb-3" />
                <h3 className="font-semibold text-gray-900 mb-2">Is this your company?</h3>
                <p className="text-sm text-gray-600 mb-4">
                  Claim your profile to update information, upload certifications, and get matched with prime contractors.
                </p>
                <a href={`mailto:team@procuvex.com?subject=Claim Profile: ${profile.company_name}&body=I would like to claim the Procuvex profile for ${profile.company_name} (UEI: ${profile.sam_uei || 'N/A'}). Please send me a claim link.`}
                  className="inline-block px-6 py-2.5 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors text-sm">
                  Claim This Profile
                </a>
              </div>
            )}

            {/* Data Source */}
            <div className="text-xs text-gray-400 text-center">
              Data sourced from {profile.data_source === 'sam_gov' ? 'SAM.gov' : profile.data_source} · Last updated {new Date(profile.created_at).toLocaleDateString()}
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="border-t border-gray-200 mt-12 py-6 text-center text-xs text-gray-400">
        <Link to="/" className="hover:text-gray-600">Procuvex</Link> — Subcontractor Network
      </div>
    </div>
  )
}
