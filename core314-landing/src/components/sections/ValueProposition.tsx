import { Eye, Brain, Shield } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardDescription } from '../ui/card';

const values = [
  {
    icon: Eye,
    title: 'Unified Visibility',
    description: 'See all your operations in one place. Connect Slack, Teams, QuickBase, ADP, and more to get a complete view of your business.',
  },
  {
    icon: Brain,
    title: 'AI-Driven Intelligence',
    description: 'Let AI analyze patterns, predict issues, and recommend actions. Get insights that would take hours to discover manually.',
  },
  {
    icon: Shield,
    title: 'Total Control',
    description: 'Manage users, track changes, and maintain compliance with comprehensive audit trails and role-based access control.',
  },
];

export function ValueProposition() {
  return (
    <section className="py-24 bg-white dark:bg-gray-950">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <h2 className="text-4xl md:text-5xl font-bold text-gray-900 dark:text-white mb-4">
            Why Core314?
          </h2>
          <p className="text-xl text-gray-600 dark:text-gray-400 max-w-2xl mx-auto">
            Transform scattered data into unified intelligence
          </p>
        </div>
        
        <div className="grid md:grid-cols-3 gap-8">
          {values.map((value, index) => {
            const Icon = value.icon;
            return (
              <Card key={index} className="border-2 hover:border-core314-electric-blue transition-colors">
                <CardHeader>
                  <div className="w-12 h-12 rounded-lg bg-core314-electric-blue/10 flex items-center justify-center mb-4">
                    <Icon className="h-6 w-6 text-core314-electric-blue" />
                  </div>
                  <CardTitle className="text-2xl mb-2">{value.title}</CardTitle>
                  <CardDescription className="text-base">{value.description}</CardDescription>
                </CardHeader>
              </Card>
            );
          })}
        </div>
      </div>
    </section>
  );
}
