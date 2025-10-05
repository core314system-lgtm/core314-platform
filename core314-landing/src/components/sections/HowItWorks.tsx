import { Database, Cpu, BarChart3, Bell } from 'lucide-react';

const steps = [
  {
    icon: Database,
    title: 'Connect Your Systems',
    description: 'Integrate with Slack, Teams, QuickBase, Costpoint, ADP, and more in minutes.',
  },
  {
    icon: Cpu,
    title: 'AI Analyzes Everything',
    description: 'Our AI agents continuously monitor, analyze, and learn from your operations.',
  },
  {
    icon: BarChart3,
    title: 'Get Actionable Insights',
    description: 'Real-time dashboards show you exactly what matters, when it matters.',
  },
  {
    icon: Bell,
    title: 'Automate & Control',
    description: 'Set up intelligent alerts and automate routine tasks to save time.',
  },
];

export function HowItWorks() {
  return (
    <section id="how-it-works" className="py-24 bg-gray-50 dark:bg-gray-900">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <h2 className="text-4xl md:text-5xl font-bold text-gray-900 dark:text-white mb-4">
            How It Works
          </h2>
          <p className="text-xl text-gray-600 dark:text-gray-400 max-w-2xl mx-auto">
            From chaos to control in four simple steps
          </p>
        </div>
        
        <div className="grid md:grid-cols-4 gap-8">
          {steps.map((step, index) => {
            const Icon = step.icon;
            return (
              <div key={index} className="relative">
                <div className="text-center">
                  <div className="w-16 h-16 rounded-full bg-core314-electric-blue flex items-center justify-center mx-auto mb-4">
                    <Icon className="h-8 w-8 text-white" />
                  </div>
                  <div className="text-sm font-semibold text-core314-electric-blue mb-2">
                    Step {index + 1}
                  </div>
                  <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
                    {step.title}
                  </h3>
                  <p className="text-gray-600 dark:text-gray-400">
                    {step.description}
                  </p>
                </div>
                
                {index < steps.length - 1 && (
                  <div className="hidden md:block absolute top-8 left-full w-full h-0.5 bg-gradient-to-r from-core314-electric-blue to-transparent -translate-x-1/2"></div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
