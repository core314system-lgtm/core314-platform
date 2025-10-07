import { Landmark, Truck, Settings, Briefcase, HardHat } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardDescription } from '../ui/card';

const industries = [
  {
    icon: Landmark,
    emoji: '🏛️',
    title: 'Government & Infrastructure',
    description: 'Automate compliance, unify reporting, and maintain full oversight across complex programs and contracts.',
  },
  {
    icon: Truck,
    emoji: '🚚',
    title: 'Logistics & Field Services',
    description: 'Coordinate dispatch, monitor KPIs, and generate insights automatically from real-time communications and workflows.',
  },
  {
    icon: Settings,
    emoji: '⚙️',
    title: 'Manufacturing & Industrial',
    description: 'Track production metrics, downtime, and maintenance alerts — all in one centralized dashboard.',
  },
  {
    icon: Briefcase,
    emoji: '💼',
    title: 'Professional Services & Consulting',
    description: 'Eliminate manual reporting and let Core314 summarize projects, meetings, and deliverables automatically.',
  },
  {
    icon: HardHat,
    emoji: '🏗️',
    title: 'Construction & Engineering',
    description: 'Manage teams, tasks, and safety tracking while integrating seamlessly with your existing project tools.',
  },
];

export function Industries() {
  return (
    <section className="py-24 bg-gray-50 dark:bg-gray-900">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <h2 className="text-4xl md:text-5xl font-bold text-gray-900 dark:text-white mb-4">
            Powering Operations Across Every Industry
          </h2>
          <p className="text-xl text-gray-600 dark:text-gray-400 max-w-3xl mx-auto">
            Core314 adapts to your workflows — not the other way around. From field operations to digital command centers, our AI-powered control platform connects your tools, automates routine work, and provides real-time visibility into performance.
          </p>
        </div>
        
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8 mb-12">
          {industries.map((industry, index) => (
            <Card key={index} className="border-2 hover:shadow-xl transition-shadow">
              <CardHeader>
                <div className="w-16 h-16 rounded-lg bg-core314-navy flex items-center justify-center mb-4">
                  <span className="text-3xl">{industry.emoji}</span>
                </div>
                <CardTitle className="text-2xl mb-3">{industry.title}</CardTitle>
                <CardDescription className="text-base leading-relaxed">{industry.description}</CardDescription>
              </CardHeader>
            </Card>
          ))}
        </div>
        
        <p className="text-center text-lg text-gray-700 dark:text-gray-300 max-w-3xl mx-auto font-medium">
          No matter your industry, Core314 acts as your AI-powered operations brain — helping your team work smarter, faster, and more connected.
        </p>
      </div>
    </section>
  );
}
