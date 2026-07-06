import { Link } from 'react-router-dom'
import Header from '../components/Header'
import Footer from '../components/Footer'

export default function PartnerTermsPage() {
  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <Header />
      <div className="pt-28 pb-20 px-4">
        <div className="max-w-3xl mx-auto">
          <div className="mb-8 p-4 rounded-lg bg-amber-900/30 border border-amber-700/50">
            <p className="text-amber-200 text-sm leading-relaxed">
              <strong>Notice:</strong> The Partner Referral Commission Program is not currently accepting new applications.
              These terms are retained for reference only.{' '}
              <Link to="/founding-partners" className="text-amber-300 underline hover:text-amber-100">Learn about our Founding Partners Program →</Link>
            </p>
          </div>
          <h1 className="text-3xl md:text-4xl font-bold mb-2">Partner Program Terms & Conditions</h1>
          <p className="text-slate-400 text-sm mb-10">Last updated: June 2026</p>

          <div className="prose prose-invert prose-sm max-w-none space-y-8">
            <section>
              <h2 className="text-xl font-semibold text-white border-b border-white/10 pb-2 mb-4">1. Program Overview</h2>
              <p className="text-slate-300 leading-relaxed">
                The Procuvex Partner Program ("Program") is operated by Core314 Technologies LLC ("Company," "we," "us"). The Program allows approved partners ("Partners," "you") to earn a 20% recurring commission on subscription revenue generated from customers referred to Procuvex through unique referral links. Commissions are paid for up to 12 months per referred subscriber, contingent upon the subscriber maintaining an active, paid subscription.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-white border-b border-white/10 pb-2 mb-4">2. Eligibility & Application</h2>
              <ul className="text-slate-300 space-y-2 list-disc pl-5">
                <li>Applicants must be at least 18 years old and legally authorized to enter contracts.</li>
                <li>Acceptance into the Program is at the sole discretion of Core314 Technologies LLC.</li>
                <li>Employees, officers, and directors of Core314 Technologies LLC are not eligible.</li>
                <li>Applicants may not have been previously terminated from the Program for cause.</li>
                <li>We reserve the right to request additional information before approving an application.</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-white border-b border-white/10 pb-2 mb-4">3. Referral Attribution</h2>
              <ul className="text-slate-300 space-y-2 list-disc pl-5">
                <li><strong>Attribution window:</strong> 60 days from the time a prospect clicks your referral link.</li>
                <li><strong>First-click attribution:</strong> The first Partner whose referral link a prospect clicks receives credit for the referral.</li>
                <li>Referrals must be new customers who have not previously had a Procuvex account.</li>
                <li>Direct or organic sign-ups (not originating from a referral link) do not qualify for commission.</li>
                <li>Attribution is tracked via browser cookies and referral code metadata stored on the subscription.</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-white border-b border-white/10 pb-2 mb-4">4. Commission Structure</h2>
              <ul className="text-slate-300 space-y-2 list-disc pl-5">
                <li><strong>Rate:</strong> 20% of net subscription revenue (after applicable taxes, fees, and refunds).</li>
                <li><strong>Duration:</strong> Up to 12 months per referred subscriber, beginning from the date of the subscriber's first paid invoice.</li>
                <li><strong>Trial period:</strong> No commission is earned during free trial periods. Commissions begin only after the subscriber's first paid invoice is processed.</li>
                <li><strong>Plan changes:</strong> If a referred subscriber upgrades or downgrades their plan, the commission adjusts to 20% of the new plan amount for the remaining commission period.</li>
                <li><strong>Cancellation:</strong> If a referred subscriber cancels their subscription, all future commissions for that subscriber cease immediately. No commission is paid for the month of cancellation if no payment was processed.</li>
                <li><strong>Refund clawback:</strong> If a referred subscriber receives a refund within 30 days of a payment, the corresponding commission is reversed.</li>
                <li><strong>Annual plans:</strong> For annual subscriptions, commission is calculated on the effective monthly amount (annual price / 12).</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-white border-b border-white/10 pb-2 mb-4">5. Payout Terms</h2>
              <ul className="text-slate-300 space-y-2 list-disc pl-5">
                <li><strong>Frequency:</strong> Monthly, net 30. Commissions earned in a given month are paid by the end of the following month.</li>
                <li><strong>Minimum payout:</strong> $100. If your earned commissions are below $100 in a given month, the balance carries forward to the next month.</li>
                <li><strong>Payout methods:</strong> PayPal, ACH bank transfer, or wire transfer. Partners are responsible for providing accurate payment information.</li>
                <li><strong>Tax responsibility:</strong> Partners are responsible for all applicable taxes on commission income. U.S.-based Partners earning $600 or more in a calendar year will receive a 1099-NEC form.</li>
                <li><strong>Currency:</strong> All commissions are calculated and paid in U.S. dollars (USD).</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-white border-b border-white/10 pb-2 mb-4">6. Prohibited Activities</h2>
              <p className="text-slate-300 mb-3">Partners agree not to engage in the following activities:</p>
              <ul className="text-slate-300 space-y-2 list-disc pl-5">
                <li><strong>Self-referral:</strong> Partners may not refer themselves, their own company, or any entity in which they hold a controlling interest.</li>
                <li><strong>Spam:</strong> Mass unsolicited emails, social media spam, or any communication that violates CAN-SPAM or equivalent regulations.</li>
                <li><strong>False or misleading claims:</strong> Misrepresenting Procuvex's features, pricing, capabilities, or partnership terms.</li>
                <li><strong>Trademark bidding:</strong> Bidding on "Procuvex," "Core314," or related branded keywords in paid search advertising without prior written approval.</li>
                <li><strong>Coupon/discount sites:</strong> Posting referral links on coupon aggregator sites, deal forums, or cashback sites without prior approval.</li>
                <li><strong>Fake sign-ups:</strong> Creating fraudulent accounts, using bots, or incentivizing sign-ups with rewards unrelated to Procuvex.</li>
                <li><strong>Unauthorized use of brand assets:</strong> Modifying, altering, or misrepresenting Procuvex logos, trademarks, or brand materials.</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-white border-b border-white/10 pb-2 mb-4">7. Intellectual Property</h2>
              <p className="text-slate-300 leading-relaxed">
                Partners may use Procuvex's name, logo, and approved marketing materials solely for the purpose of promoting Procuvex as part of this Program. All intellectual property rights in Procuvex materials remain the exclusive property of Core314 Technologies LLC. Partners may not modify, create derivative works from, or sublicense any Procuvex materials. Upon termination, Partners must cease all use of Procuvex's intellectual property.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-white border-b border-white/10 pb-2 mb-4">8. Termination</h2>
              <ul className="text-slate-300 space-y-2 list-disc pl-5">
                <li><strong>Voluntary termination:</strong> Either party may terminate this agreement with 30 days' written notice. Pending commissions for active subscribers will continue to be paid through the remaining commission period.</li>
                <li><strong>Termination for cause:</strong> Core314 Technologies LLC may terminate a Partner immediately and without notice for violation of these terms, fraudulent activity, or conduct that damages the Procuvex brand. In such cases, all unpaid commissions are forfeited.</li>
                <li><strong>Program discontinuation:</strong> Core314 Technologies LLC reserves the right to discontinue the Program with 60 days' notice. Commissions on existing referrals will be honored through their 12-month terms.</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-white border-b border-white/10 pb-2 mb-4">9. Limitation of Liability</h2>
              <p className="text-slate-300 leading-relaxed">
                To the maximum extent permitted by applicable law, Core314 Technologies LLC's total liability to any Partner under this Agreement shall not exceed the total commissions paid to that Partner in the 12 months preceding any claim. In no event shall Core314 Technologies LLC be liable for any indirect, incidental, consequential, special, or punitive damages, including lost profits or revenue, regardless of the cause of action.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-white border-b border-white/10 pb-2 mb-4">10. Modifications</h2>
              <p className="text-slate-300 leading-relaxed">
                Core314 Technologies LLC reserves the right to modify these terms at any time. Partners will be notified of material changes via email at least 30 days before the changes take effect. Continued participation in the Program after the effective date of changes constitutes acceptance of the modified terms.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-white border-b border-white/10 pb-2 mb-4">11. Governing Law</h2>
              <p className="text-slate-300 leading-relaxed">
                This Agreement is governed by and construed in accordance with the laws of the State of Florida, United States, without regard to conflict of law principles. Any disputes arising under this Agreement shall be resolved through binding arbitration in accordance with the rules of the American Arbitration Association.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-white border-b border-white/10 pb-2 mb-4">12. Contact</h2>
              <p className="text-slate-300 leading-relaxed">
                For questions about the Partner Program or these terms, contact us at{' '}
                <a href="mailto:team@procuvex.com" className="text-purple-400 hover:text-purple-300">team@procuvex.com</a>.
              </p>
            </section>

            <div className="border-t border-white/10 pt-6 mt-8">
              <p className="text-slate-500 text-xs">
                Core314 Technologies LLC &middot; Procuvex Partner Program Terms & Conditions &middot; Effective June 2026
              </p>
            </div>
          </div>
        </div>
      </div>
      <Footer />
    </div>
  )
}
