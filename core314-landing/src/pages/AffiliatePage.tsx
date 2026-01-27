import { Link } from 'react-router-dom';
import Footer from '../components/Footer';

export default function AffiliatePage() {
  return (
    <div className="min-h-screen bg-slate-950 text-white">
      {/* Header */}
      <header className="bg-slate-950/80 backdrop-blur-sm border-b border-slate-800 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <img src="/logo-icon.svg" alt="Core314" className="h-8 w-8" />
            <span className="text-xl font-semibold text-white">
              Core<span className="text-sky-400">314</span>
            </span>
          </Link>
          <span
            className="px-4 py-2 bg-sky-500/50 text-white/70 font-medium rounded-lg text-sm cursor-not-allowed"
          >
            Apply Now
          </span>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-slate-950 via-slate-900 to-sky-950" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-sky-900/20 via-transparent to-transparent" />
        <div className="relative max-w-5xl mx-auto px-6 py-24 md:py-32 text-center">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-sky-500/10 border border-sky-500/30 rounded-full text-sky-400 text-sm font-medium mb-8">
            <span className="w-2 h-2 bg-sky-400 rounded-full animate-pulse" />
            Early Affiliate Program &bull; Limited Enrollment
          </div>
          
          <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-white leading-tight mb-6">
            Earn 25% Recurring Revenue —<br />
            <span className="text-sky-400">For the Lifetime of Every Customer You Refer</span>
          </h1>
          
          <p className="text-xl md:text-2xl text-slate-300 max-w-3xl mx-auto mb-10 leading-relaxed">
            Introduce serious teams to Core314's operational intelligence platform and earn ongoing revenue as they scale.
          </p>
          
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <div className="flex flex-col items-center">
              <span
                className="px-8 py-4 bg-sky-500/50 text-white/70 font-semibold rounded-lg text-lg cursor-not-allowed"
              >
                Join the Affiliate Program
              </span>
              <span className="text-slate-500 text-sm mt-3">Affiliate enrollment opens soon.</span>
            </div>
            <a
              href="#how-it-works"
              className="px-6 py-4 text-slate-300 hover:text-white font-medium transition-colors"
            >
              See how it works &darr;
            </a>
          </div>
        </div>
      </section>

      {/* Why This Is a Rare Opportunity */}
      <section className="bg-slate-900 border-y border-slate-800">
        <div className="max-w-5xl mx-auto px-6 py-20">
          <h2 className="text-3xl md:text-4xl font-bold text-white text-center mb-4">
            Why This Is a Rare Opportunity
          </h2>
          <p className="text-slate-400 text-center max-w-2xl mx-auto mb-6">
            This is the same revenue model early affiliates used to build meaningful recurring income with top SaaS platforms.
          </p>
          <p className="text-slate-500 text-center text-sm max-w-2xl mx-auto mb-12">
            Affiliate tracking and payouts are handled through our secure affiliate platform, providing transparent attribution and automated payments.
          </p>
          
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-6 hover:border-sky-500/50 transition-colors">
              <div className="text-3xl font-bold text-sky-400 mb-2">25%</div>
              <div className="text-white font-medium mb-1">Recurring Commission</div>
              <div className="text-slate-400 text-sm">Paid monthly, every month</div>
            </div>
            <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-6 hover:border-sky-500/50 transition-colors">
              <div className="text-3xl font-bold text-sky-400 mb-2">Lifetime</div>
              <div className="text-white font-medium mb-1">Attribution</div>
              <div className="text-slate-400 text-sm">Not one-time payouts</div>
            </div>
            <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-6 hover:border-sky-500/50 transition-colors">
              <div className="text-3xl font-bold text-sky-400 mb-2">No Caps</div>
              <div className="text-white font-medium mb-1">No Quotas</div>
              <div className="text-slate-400 text-sm">No territory limits</div>
            </div>
            <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-6 hover:border-sky-500/50 transition-colors">
              <div className="text-3xl font-bold text-sky-400 mb-2">Long-term</div>
              <div className="text-white font-medium mb-1">Alignment</div>
              <div className="text-slate-400 text-sm">Built for growth, not churn</div>
            </div>
          </div>
        </div>
      </section>

      {/* Real-World Earning Scenarios */}
      <section className="bg-slate-950">
        <div className="max-w-6xl mx-auto px-6 py-20">
          <h2 className="text-3xl md:text-4xl font-bold text-white text-center mb-4">
            What 25% Recurring Revenue Looks Like in the Real World
          </h2>
          <p className="text-slate-400 text-center max-w-3xl mx-auto mb-12">
            These examples are based on Core314's current pricing. Affiliates earn 25% recurring revenue every month for as long as referred customers remain active.
          </p>
          
          <div className="grid md:grid-cols-3 gap-8">
            {/* Scenario 1 */}
            <div className="bg-gradient-to-b from-slate-800/80 to-slate-900/80 border border-slate-700 rounded-2xl p-8 hover:border-sky-500/50 transition-all hover:-translate-y-1">
              <div className="text-sky-400 text-sm font-semibold uppercase tracking-wider mb-2">Scenario 1</div>
              <h3 className="text-xl font-bold text-white mb-2">Independent Consultant</h3>
              <p className="text-slate-400 text-sm mb-6">Referring a small number of trusted clients.</p>
              
              <div className="bg-slate-900/50 rounded-lg p-4 mb-6">
                <div className="text-slate-300 text-sm">5 companies on Analyze ($999/month)</div>
              </div>
              
              <div className="border-t border-slate-700 pt-6">
                <div className="text-sky-400 text-3xl font-bold mb-1">$1,248.75</div>
                <div className="text-slate-300 text-sm mb-2">per month</div>
                <div className="text-white font-semibold">$14,985 per year</div>
              </div>
              
              <p className="text-slate-500 text-xs mt-4">Recurring for the lifetime of the customers.</p>
            </div>

            {/* Scenario 2 */}
            <div className="bg-gradient-to-b from-slate-800/80 to-slate-900/80 border border-slate-700 rounded-2xl p-8 hover:border-sky-500/50 transition-all hover:-translate-y-1 md:scale-105 md:border-sky-500/30">
              <div className="text-sky-400 text-sm font-semibold uppercase tracking-wider mb-2">Scenario 2</div>
              <h3 className="text-xl font-bold text-white mb-2">Fractional Executive or Advisor</h3>
              <p className="text-slate-400 text-sm mb-6">Leveraging an existing professional network.</p>
              
              <div className="bg-slate-900/50 rounded-lg p-4 mb-6 space-y-2">
                <div className="text-slate-300 text-sm">12 companies on Analyze</div>
                <div className="text-slate-300 text-sm">6 companies on Observe</div>
              </div>
              
              <div className="border-t border-slate-700 pt-6">
                <div className="text-sky-400 text-3xl font-bold mb-1">~$3,595</div>
                <div className="text-slate-300 text-sm mb-2">per month</div>
                <div className="text-white font-semibold">~$43,140 per year</div>
              </div>
              
              <p className="text-slate-500 text-xs mt-4">Grows automatically as clients expand.</p>
            </div>

            {/* Scenario 3 */}
            <div className="bg-gradient-to-b from-slate-800/80 to-slate-900/80 border border-slate-700 rounded-2xl p-8 hover:border-sky-500/50 transition-all hover:-translate-y-1">
              <div className="text-sky-400 text-sm font-semibold uppercase tracking-wider mb-2">Scenario 3</div>
              <h3 className="text-xl font-bold text-white mb-2">Educator, Operator, or Community Leader</h3>
              <p className="text-slate-400 text-sm mb-6">Sharing Core314 with a broader audience.</p>
              
              <div className="bg-slate-900/50 rounded-lg p-4 mb-6">
                <div className="text-slate-300 text-sm">25 companies on Analyze</div>
              </div>
              
              <div className="border-t border-slate-700 pt-6">
                <div className="text-sky-400 text-3xl font-bold mb-1">~$6,244</div>
                <div className="text-slate-300 text-sm mb-2">per month</div>
                <div className="text-white font-semibold">~$74,925 per year</div>
              </div>
              
              <p className="text-slate-500 text-xs mt-4">Without fulfillment, delivery, or support responsibilities.</p>
            </div>
          </div>
          
          <p className="text-slate-500 text-xs text-center mt-8 max-w-2xl mx-auto">
            Examples shown are illustrative only and do not guarantee earnings. Actual results depend on referrals and customer retention.
          </p>
        </div>
      </section>

      {/* How You Get Paid */}
      <section className="bg-slate-900 border-y border-slate-800">
        <div className="max-w-4xl mx-auto px-6 py-20">
          <h2 className="text-3xl md:text-4xl font-bold text-white text-center mb-6">
            How You Get Paid
          </h2>
          <p className="text-slate-300 text-center max-w-2xl mx-auto mb-10 text-lg">
            Core314's Affiliate Program is powered by professional affiliate tracking and payout infrastructure.
          </p>
          
          <p className="text-slate-400 text-center max-w-2xl mx-auto mb-8">
            Once approved, affiliates earn 25% recurring revenue on every active customer they refer to Core314.
          </p>
          
          <div className="grid md:grid-cols-2 gap-6 max-w-3xl mx-auto mb-10">
            <div className="flex items-start gap-3">
              <div className="w-6 h-6 bg-sky-500/20 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                <svg className="w-3.5 h-3.5 text-sky-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <p className="text-slate-300">Referrals are tracked automatically through our affiliate platform</p>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-6 h-6 bg-sky-500/20 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                <svg className="w-3.5 h-3.5 text-sky-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <p className="text-slate-300">Earnings are calculated monthly based on active subscriptions</p>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-6 h-6 bg-sky-500/20 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                <svg className="w-3.5 h-3.5 text-sky-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <p className="text-slate-300">Commissions are paid out automatically via Stripe</p>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-6 h-6 bg-sky-500/20 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                <svg className="w-3.5 h-3.5 text-sky-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <p className="text-slate-300">Affiliates have access to a dashboard showing referrals, subscriptions, and earnings</p>
            </div>
          </div>
          
          <p className="text-slate-400 text-center max-w-2xl mx-auto">
            As long as your referred customers remain active, you continue earning recurring revenue.
          </p>
        </div>
      </section>

      {/* How It Works */}
      <section id="how-it-works" className="bg-slate-950">
        <div className="max-w-5xl mx-auto px-6 py-20">
          <h2 className="text-3xl md:text-4xl font-bold text-white text-center mb-12">
            How It Works
          </h2>
          
          <div className="grid md:grid-cols-3 gap-8">
            <div className="text-center">
              <div className="w-16 h-16 bg-sky-500/10 border border-sky-500/30 rounded-2xl flex items-center justify-center mx-auto mb-6">
                <svg className="w-8 h-8 text-sky-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div className="text-sky-400 text-sm font-semibold mb-2">Step 1</div>
              <h3 className="text-xl font-bold text-white mb-3">Get Approved</h3>
              <p className="text-slate-400">
                We accept affiliates who understand operators, teams, and real business problems.
              </p>
            </div>
            
            <div className="text-center">
              <div className="w-16 h-16 bg-sky-500/10 border border-sky-500/30 rounded-2xl flex items-center justify-center mx-auto mb-6">
                <svg className="w-8 h-8 text-sky-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
              </div>
              <div className="text-sky-400 text-sm font-semibold mb-2">Step 2</div>
              <h3 className="text-xl font-bold text-white mb-3">Refer Qualified Teams</h3>
              <p className="text-slate-400">
                Share Core314 with leaders who need clarity across their tools and operations.
              </p>
            </div>
            
            <div className="text-center">
              <div className="w-16 h-16 bg-sky-500/10 border border-sky-500/30 rounded-2xl flex items-center justify-center mx-auto mb-6">
                <svg className="w-8 h-8 text-sky-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div className="text-sky-400 text-sm font-semibold mb-2">Step 3</div>
              <h3 className="text-xl font-bold text-white mb-3">Earn Ongoing Revenue</h3>
              <p className="text-slate-400">
                You earn 25% recurring revenue for as long as your referred customers remain active.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Who This Program Is For */}
      <section className="bg-slate-950">
        <div className="max-w-5xl mx-auto px-6 py-20">
          <h2 className="text-3xl md:text-4xl font-bold text-white text-center mb-12">
            Who This Program Is For
          </h2>
          
          <div className="flex flex-wrap justify-center gap-4 mb-8">
            <div className="px-5 py-3 bg-slate-800/50 border border-slate-700 rounded-full text-slate-300 hover:border-sky-500/50 hover:text-white transition-colors">
              Consultants & Advisors
            </div>
            <div className="px-5 py-3 bg-slate-800/50 border border-slate-700 rounded-full text-slate-300 hover:border-sky-500/50 hover:text-white transition-colors">
              Fractional Executives (CTO, COO, Ops)
            </div>
            <div className="px-5 py-3 bg-slate-800/50 border border-slate-700 rounded-full text-slate-300 hover:border-sky-500/50 hover:text-white transition-colors">
              Operators with Strong Peer Networks
            </div>
            <div className="px-5 py-3 bg-slate-800/50 border border-slate-700 rounded-full text-slate-300 hover:border-sky-500/50 hover:text-white transition-colors">
              SaaS Educators & B2B Creators
            </div>
            <div className="px-5 py-3 bg-slate-800/50 border border-slate-700 rounded-full text-slate-300 hover:border-sky-500/50 hover:text-white transition-colors">
              Integration & Transformation Specialists
            </div>
          </div>
          
          <p className="text-slate-400 text-center text-lg">
            If people trust your recommendations, this program was built for you.
          </p>
        </div>
      </section>

      {/* Why Core314 Converts */}
      <section className="bg-slate-900 border-y border-slate-800">
        <div className="max-w-5xl mx-auto px-6 py-20">
          <h2 className="text-3xl md:text-4xl font-bold text-white text-center mb-4">
            Why Core314 Converts
          </h2>
          <p className="text-slate-400 text-center max-w-2xl mx-auto mb-12">
            Your recurring revenue depends on customer retention. Here's why Core314 customers stay.
          </p>
          
          <div className="grid md:grid-cols-2 gap-6">
            <div className="flex items-start gap-4 p-6 bg-slate-800/30 rounded-xl">
              <div className="w-10 h-10 bg-sky-500/10 border border-sky-500/30 rounded-lg flex items-center justify-center flex-shrink-0">
                <svg className="w-5 h-5 text-sky-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
              <div>
                <h3 className="text-white font-semibold mb-1">Mission-Critical Intelligence</h3>
                <p className="text-slate-400 text-sm">Operational visibility that leadership depends on daily.</p>
              </div>
            </div>
            
            <div className="flex items-start gap-4 p-6 bg-slate-800/30 rounded-xl">
              <div className="w-10 h-10 bg-sky-500/10 border border-sky-500/30 rounded-lg flex items-center justify-center flex-shrink-0">
                <svg className="w-5 h-5 text-sky-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z" />
                </svg>
              </div>
              <div>
                <h3 className="text-white font-semibold mb-1">Sticky Multi-Integration Platform</h3>
                <p className="text-slate-400 text-sm">Connects across the entire tool stack, creating deep dependency.</p>
              </div>
            </div>
            
            <div className="flex items-start gap-4 p-6 bg-slate-800/30 rounded-xl">
              <div className="w-10 h-10 bg-sky-500/10 border border-sky-500/30 rounded-lg flex items-center justify-center flex-shrink-0">
                <svg className="w-5 h-5 text-sky-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
              </div>
              <div>
                <h3 className="text-white font-semibold mb-1">High Retention by Design</h3>
                <p className="text-slate-400 text-sm">Built for long-term value, not short-term trials.</p>
              </div>
            </div>
            
            <div className="flex items-start gap-4 p-6 bg-slate-800/30 rounded-xl">
              <div className="w-10 h-10 bg-sky-500/10 border border-sky-500/30 rounded-lg flex items-center justify-center flex-shrink-0">
                <svg className="w-5 h-5 text-sky-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                </svg>
              </div>
              <div>
                <h3 className="text-white font-semibold mb-1">Built for Scaling Teams</h3>
                <p className="text-slate-400 text-sm">Grows with organizations as they expand operations.</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Boundaries & Compliance */}
      <section className="bg-slate-950">
        <div className="max-w-3xl mx-auto px-6 py-16">
          <h2 className="text-xl font-semibold text-slate-400 text-center mb-8">
            Program Boundaries
          </h2>
          
          <div className="space-y-3 text-slate-500 text-sm">
            <p>&bull; This is not a strategic partnership. Affiliates operate independently.</p>
            <p>&bull; Affiliates may not represent Core314 contractually or bind Core314 to any agreement.</p>
            <p>&bull; Use of Core314 trademarks requires prior written approval.</p>
            <p>&bull; No income guarantees beyond stated commission terms. Earnings depend on referrals and customer retention.</p>
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="bg-gradient-to-b from-slate-900 to-slate-950 border-t border-slate-800">
        <div className="max-w-4xl mx-auto px-6 py-24 text-center">
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-6">
            Join Early. Earn Recurring Revenue.<br />
            <span className="text-sky-400">Grow With Core314.</span>
          </h2>
          
          <span
            className="inline-block px-10 py-5 bg-sky-500/50 text-white/70 font-semibold rounded-lg text-lg cursor-not-allowed"
          >
            Apply to Join the Affiliate Program
          </span>
          <p className="text-slate-500 text-sm mt-4">Affiliate enrollment opens soon.</p>
        </div>
      </section>

      <Footer />
    </div>
  );
}
