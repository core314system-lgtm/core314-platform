import { Building2, Shield, Server } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardDescription } from '../ui/card';

const industries = [
  {
    icon: Building2,
    title: 'Facilities Management',
    description: 'Coordinate maintenance, track assets, and manage vendor relationships across multiple properties.',
    benefits: ['Work order automation', 'Asset lifecycle tracking', 'Vendor performance analytics'],
  },
  {
    icon: Shield,
    title: 'Government Contracting',
    description: 'Stay compliant, manage proposals, and track project delivery with military precision.',
    benefits: ['Compliance automation', 'Contract lifecycle management', 'Secure audit trails'],
  },
  {
    icon: Server,
    title: 'IT Operations',
    description: 'Monitor infrastructure, automate incident response, and optimize service delivery.',
    benefits: ['24/7 system monitoring', 'Intelligent alerting', 'Performance analytics'],
  },
];

export function Industries() {
  return (
    <section className="py-24 bg-gray-50 dark:bg-gray-900">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <h2 className="text-4xl md:text-5xl font-bold text-gray-900 dark:text-white mb-4">
            Built for Your Industry
          </h2>
          <p className="text-xl text-gray-600 dark:text-gray-400 max-w-2xl mx-auto">
            Specialized solutions for complex operations
          </p>
        </div>
        
        <div className="grid md:grid-cols-3 gap-8">
          {industries.map((industry, index) => {
            const Icon = industry.icon;
            return (
              <Card key={index} className="border-2 hover:shadow-xl transition-shadow">
                <CardHeader>
                  <div className="w-12 h-12 rounded-lg bg-core314-navy flex items-center justify-center mb-4">
                    <Icon className="h-6 w-6 text-core314-electric-blue" />
                  </div>
                  <CardTitle className="text-2xl mb-2">{industry.title}</CardTitle>
                  <CardDescription className="text-base mb-4">{industry.description}</CardDescription>
                  <ul className="space-y-2">
                    {industry.benefits.map((benefit, idx) => (
                      <li key={idx} className="flex items-center text-sm text-gray-600 dark:text-gray-400">
                        <span className="w-1.5 h-1.5 rounded-full bg-core314-electric-blue mr-2"></span>
                        {benefit}
                      </li>
                    ))}
                  </ul>
                </CardHeader>
              </Card>
            );
          })}
        </div>
      </div>
    </section>
  );
}
