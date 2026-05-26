import { Link } from 'react-router-dom';
import Footer from '../components/Footer';

export default function PartnersPage() {
  return (
    <div className="min-h-screen bg-white text-slate-900">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-50">
        <div className="max-w-4xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <img src="/logo-icon.svg" alt="Core314" className="h-8 w-8" />
            <span className="text-xl font-semibold text-slate-900">
              Core<span className="text-sky-600">314</span>
            </span>
          </Link>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-3xl mx-auto px-6 py-16">
        {/* Page Title */}
        <div className="mb-12 border-b border-slate-200 pb-8">
          <h1 className="text-3xl font-semibold text-slate-900 mb-2">
            Core314 Partner Program
          </h1>
          <p className="text-lg text-slate-600">
            Ecosystem Charter
          </p>
        </div>

        {/* SECTION: PURPOSE */}
        <section className="mb-12">
          <h2 className="text-xl font-semibold text-slate-900 mb-4 uppercase tracking-wide text-sm">
            Purpose
          </h2>
          <div className="space-y-4 text-slate-700 leading-relaxed">
            <p>
              The Core314 Partner Program exists to support a small, deliberate ecosystem of trusted operators who introduce, implement, or stand behind Core314 in real client environments.
            </p>
            <p>
              This is not an affiliate program.<br />
              This is not a volume-based referral channel.<br />
              This is not designed for passive promotion.
            </p>
            <p>
              The program is designed for partners who influence operational decisions and are willing to be accountable for how Core314 is positioned and used.
            </p>
          </div>
        </section>

        {/* SECTION: WHAT CORE314 IS */}
        <section className="mb-12">
          <h2 className="text-xl font-semibold text-slate-900 mb-4 uppercase tracking-wide text-sm">
            What Core314 Is
          </h2>
          <div className="space-y-4 text-slate-700 leading-relaxed">
            <p>
              Core314 is an operational intelligence platform.
            </p>
            <p>
              It sits above the tools organizations already use — collaboration platforms, ticketing systems, engineering tools, HR systems, and operational workflows — and answers a simple but critical question for leadership:
            </p>
            <p className="italic text-slate-600">
              "Are our operations actually working the way we think they are?"
            </p>
            <p>
              Core314 aggregates signals across systems, normalizes them, and produces an explainable view of operational health. When performance degrades, Core314 explains why, grounded in real activity data.
            </p>
            <p>
              Core314 is not a dashboard.<br />
              It is not a workflow replacement.<br />
              It is not a reporting tool.
            </p>
            <p>
              It is an intelligence layer designed for executive-level clarity and long-term operational trust.
            </p>
          </div>
        </section>

        {/* SECTION: WHO THIS PROGRAM IS FOR */}
        <section className="mb-12">
          <h2 className="text-xl font-semibold text-slate-900 mb-4 uppercase tracking-wide text-sm">
            Who This Program Is For
          </h2>
          <div className="space-y-4 text-slate-700 leading-relaxed">
            <p>
              The Core314 Partner Program is designed for partners who already hold trust inside client organizations.
            </p>
            <p>
              This includes, but is not limited to:
            </p>
            <ul className="list-disc list-inside space-y-1 ml-4">
              <li>Fractional CTOs, COOs, and senior operators</li>
              <li>RevOps, DevOps, and operational consulting firms</li>
              <li>Systems integrators and MSPs with strategic client relationships</li>
              <li>Compliance, risk, and audit advisors</li>
              <li>Firms with ongoing, retained client engagements</li>
            </ul>
            <p>
              Partners are expected to introduce Core314 when it is appropriate, not to force-fit it into every conversation.
            </p>
          </div>
        </section>

        {/* SECTION: WHO THIS PROGRAM IS NOT FOR */}
        <section className="mb-12">
          <h2 className="text-xl font-semibold text-slate-900 mb-4 uppercase tracking-wide text-sm">
            Who This Program Is Not For
          </h2>
          <div className="space-y-4 text-slate-700 leading-relaxed">
            <p>
              This program is not a fit for:
            </p>
            <ul className="list-disc list-inside space-y-1 ml-4">
              <li>Traffic-based affiliates</li>
              <li>Influencers or content-only promoters</li>
              <li>Coupon, referral-link, or promo-code models</li>
              <li>One-time referrers with no ongoing client involvement</li>
              <li>Anyone seeking passive or short-term income</li>
            </ul>
            <p>
              If your primary question is about speed, volume, or commission mechanics, this program is not designed for you.
            </p>
          </div>
        </section>

        {/* SECTION: PARTNER RESPONSIBILITY */}
        <section className="mb-12">
          <h2 className="text-xl font-semibold text-slate-900 mb-4 uppercase tracking-wide text-sm">
            Partner Responsibility
          </h2>
          <div className="space-y-4 text-slate-700 leading-relaxed">
            <p>
              Partners are not resellers.
            </p>
            <p>
              Partners are expected to:
            </p>
            <ul className="list-disc list-inside space-y-1 ml-4">
              <li>Introduce Core314 honestly and accurately</li>
              <li>Position it as an intelligence layer, not a feature product</li>
              <li>Remain involved in the client relationship</li>
              <li>Respect attribution, deal registration, and governance rules</li>
              <li>Act in a way that preserves Core314's credibility with executives</li>
            </ul>
            <p>
              Participation in this program implies professional accountability, not just referral activity.
            </p>
          </div>
        </section>

        {/* SECTION: NO PROMOTION EXPECTATION */}
        <section className="mb-12">
          <h2 className="text-xl font-semibold text-slate-900 mb-4 uppercase tracking-wide text-sm">
            No Promotion Expectation
          </h2>
          <div className="space-y-4 text-slate-700 leading-relaxed">
            <p>
              Strategic Partners are not expected to market, promote, or sell Core314.
            </p>
            <p>
              Partners introduce Core314 only when it strengthens their existing client engagements and improves client outcomes.
            </p>
            <p>
              There are:
            </p>
            <ul className="list-disc list-inside space-y-1 ml-4">
              <li>No promotion quotas</li>
              <li>No distribution requirements</li>
              <li>No sales activity expectations</li>
            </ul>
            <p>
              Core314 is introduced as infrastructure that supports the partner's work, not as a product to be marketed independently.
            </p>
          </div>
        </section>

        {/* SECTION: ECONOMICS */}
        <section className="mb-12">
          <h2 className="text-xl font-semibold text-slate-900 mb-4 uppercase tracking-wide text-sm">
            Economics
          </h2>
          <div className="space-y-4 text-slate-700 leading-relaxed">
            <p>
              Approved partners earn:
            </p>
            <ul className="list-disc list-inside space-y-1 ml-4">
              <li>25% recurring revenue</li>
              <li>Paid monthly</li>
              <li>Lifetime attribution for the life of the customer</li>
              <li>Expansion revenue included</li>
              <li>No caps</li>
              <li>No clawbacks</li>
              <li>No last-click attribution games</li>
            </ul>
            <p>
              This model exists because Core314 partners are expected to be involved over time, not just at introduction.
            </p>
          </div>
        </section>

        {/* SECTION: ATTRIBUTION & GOVERNANCE */}
        <section className="mb-12">
          <h2 className="text-xl font-semibold text-slate-900 mb-4 uppercase tracking-wide text-sm">
            Attribution & Governance
          </h2>
          <div className="space-y-4 text-slate-700 leading-relaxed">
            <p>
              To protect partner trust and customer relationships:
            </p>
            <ul className="list-disc list-inside space-y-1 ml-4">
              <li>Deal registration is required</li>
              <li>One partner is attributed per account</li>
              <li>Attribution is locked for the life of the account</li>
              <li>Expansion revenue follows the same attribution</li>
              <li>Rules of Engagement are enforced consistently</li>
            </ul>
            <p>
              Core314 does not bypass partners, undercut partners, or retroactively change attribution.
            </p>
            <p>
              Governance is a feature of this program, not an afterthought.
            </p>
          </div>
        </section>

        {/* SECTION: PARTNER STRUCTURE */}
        <section className="mb-12">
          <h2 className="text-xl font-semibold text-slate-900 mb-4 uppercase tracking-wide text-sm">
            Partner Structure
          </h2>
          <div className="space-y-6 text-slate-700 leading-relaxed">
            <div>
              <p className="font-semibold text-slate-900">Registered Partner</p>
              <p>Eligible for recurring revenue, deal registration access, and enablement materials.</p>
            </div>
            <div>
              <p className="font-semibold text-slate-900">Certified Partner</p>
              <p>Earned status with deeper implementation involvement, co-marketing eligibility, and higher operational expectations.</p>
            </div>
            <div>
              <p className="font-semibold text-slate-900">Strategic Partner</p>
              <p>Invitation only. Executive alignment, portfolio-level engagement, and custom commercial structures where appropriate.</p>
            </div>
            <p>
              Tier advancement is based on behavior and alignment, not volume.
            </p>
          </div>
        </section>

        {/* SECTION: HOW THE PROGRAM WORKS */}
        <section className="mb-12">
          <h2 className="text-xl font-semibold text-slate-900 mb-4 uppercase tracking-wide text-sm">
            How the Program Works
          </h2>
          <div className="space-y-4 text-slate-700 leading-relaxed">
            <div className="space-y-3">
              <p><span className="font-semibold">1. Apply for partnership.</span><br />This program is selective and reviewed asynchronously.</p>
              <p><span className="font-semibold">2. Application review.</span><br />Fit is evaluated based on role, client relationships, and positioning alignment.</p>
              <p><span className="font-semibold">3. If approved:</span><br />Partner agreement is executed, program materials are provided, and deal registration access is granted.</p>
              <p><span className="font-semibold">4. Partner activity.</span><br />Partners introduce Core314 where it fits naturally and remain involved.</p>
              <p><span className="font-semibold">5. Revenue and reporting.</span><br />Revenue is tracked transparently and paid monthly.</p>
            </div>
            <p>
              There are no onboarding calls, no sales coaching sessions, and no hand-holding.<br />
              The program is designed to operate on clarity, not persuasion.
            </p>
          </div>
        </section>

        {/* SECTION: APPLY */}
        <section className="mb-12 border-t border-slate-200 pt-12">
          <h2 className="text-xl font-semibold text-slate-900 mb-4 uppercase tracking-wide text-sm">
            Apply
          </h2>
          <div className="space-y-4 text-slate-700 leading-relaxed">
            <p>
              If you believe this model aligns with how you work with clients, you may apply for partnership.
            </p>
            <p>
              This is an application, not a signup.
            </p>
            <div className="mt-8">
              <a
                href="mailto:partners@core314.com?subject=Partner%20Program%20Application"
                className="inline-block px-6 py-3 bg-slate-900 text-white font-medium rounded hover:bg-slate-800 transition-colors"
              >
                Apply for Partnership
              </a>
            </div>
          </div>
        </section>

        {/* SECTION: CLOSING STATEMENT */}
        <section className="mb-12 border-t border-slate-200 pt-12">
          <div className="space-y-4 text-slate-700 leading-relaxed">
            <p>
              Core314 partners are trusted operators who help organizations understand how they actually run.
            </p>
            <p>
              If that responsibility resonates with you, we welcome your application.
            </p>
            <p>
              If it does not, this program is intentionally not designed to accommodate that.
            </p>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
