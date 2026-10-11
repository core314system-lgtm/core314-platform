import Header from '../components/Header';
import Footer from '../components/Footer';
import Seo from '../components/Seo';
import CtaBand from '../components/CtaBand';

const industries = [
  { name: 'Staffing & recruiting', uses: ['Candidate intake and credential tracking', 'Timesheet approval feeding payroll and invoicing', 'Client portals for open orders and placements', 'Compliance reminders for expiring documents'] },
  { name: 'Property management', uses: ['Maintenance requests with vendor dispatch and status updates', 'Lease renewal and inspection reminders', 'Owner reporting generated automatically', 'Tenant and vendor portals'] },
  { name: 'Distribution & logistics', uses: ['Orders flowing into inventory and accounting', 'Delivery and exception tracking', 'Customer order-status portals', 'Reorder alerts and supplier communications'] },
  { name: 'Professional services', uses: ['Client intake and engagement tracking', 'Document assembly from templates', 'Utilization and profitability dashboards', 'Approval workflows for proposals and invoices'] },
  { name: 'Construction & trades', uses: ['Bids, estimates and change orders', 'Subcontractor insurance and license compliance', 'Job-cost dashboards', 'Field apps for daily reports and photos'] },
  { name: 'Government contracting', uses: ['Opportunity and pipeline tracking', 'Solicitation and compliance analysis', 'Subcontractor quote collection', 'See our ProCuvex platform'] },
  { name: 'Healthcare administration & nonprofits', uses: ['Intake and referral tracking', 'Grant and program reporting', 'Volunteer or staff scheduling', 'Document-heavy workflow automation'] },
  { name: 'Manufacturing', uses: ['Work-order and quality tracking', 'Supplier and purchasing workflows', 'Production dashboards', 'Integration between ERP and shop-floor tools'] },
];

export default function IndustriesPage() {
  return (
    <div className="min-h-screen bg-white text-slate-900">
      <Seo title="Industries: Custom Software Use Cases | Core314" description="Examples of custom software and automation for staffing, property management, distribution, professional services, construction, government contracting and more." path="/industries" />
      <Header />
      <main>
        <section className="pt-28 pb-12 lg:pt-36 bg-gradient-to-b from-slate-50 to-white">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
            <h1 className="text-4xl sm:text-5xl font-bold tracking-tight">Industries we can help</h1>
            <p className="mt-6 text-lg text-slate-600 leading-relaxed">
              Every business has workflows that software can simplify. Below are typical use cases by industry. They are examples of
              what is possible, not a list of past client projects.
            </p>
          </div>
        </section>
        <section className="pb-20">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 grid md:grid-cols-2 gap-6">
            {industries.map((i) => (
              <div key={i.name} className="p-6 rounded-xl border border-slate-200">
                <h2 className="text-xl font-semibold">{i.name}</h2>
                <ul className="mt-3 space-y-2 text-slate-700 list-disc pl-5">
                  {i.uses.map((u) => <li key={u}>{u}</li>)}
                </ul>
              </div>
            ))}
          </div>
          <p className="max-w-3xl mx-auto mt-10 px-4 text-center text-slate-700">Don't see your industry? The approach is the same everywhere: understand the workflow, then build the software around it.</p>
        </section>
        <CtaBand location="industries" />
      </main>
      <Footer />
    </div>
  );
}
