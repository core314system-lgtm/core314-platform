import { Users, Layers, BarChart3, DollarSign, Bot, Activity, Bell, FileText } from 'lucide-react';

const features = [
  { icon: Users, title: 'User Management', description: 'Role-based access control and team management' },
  { icon: Layers, title: 'Integration Hub', description: 'Connect 7+ enterprise systems seamlessly' },
  { icon: BarChart3, title: 'Metrics Dashboard', description: 'Real-time KPIs and performance tracking' },
  { icon: DollarSign, title: 'Billing Analytics', description: 'Track revenue, subscriptions, and forecasts' },
  { icon: Bot, title: 'AI Orchestration', description: 'Multi-agent automation and task execution' },
  { icon: Activity, title: 'System Health', description: '24/7 monitoring and uptime tracking' },
  { icon: Bell, title: 'Smart Notifications', description: 'Intelligent alerts for critical events' },
  { icon: FileText, title: 'Audit Trails', description: 'Comprehensive activity logging and compliance' },
];

export function KeyFeatures() {
  return (
    <section className="py-24 bg-white dark:bg-gray-950">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <h2 className="text-4xl md:text-5xl font-bold text-gray-900 dark:text-white mb-4">
            Everything You Need
          </h2>
          <p className="text-xl text-gray-600 dark:text-gray-400 max-w-2xl mx-auto">
            Comprehensive tools for modern operations management
          </p>
        </div>
        
        <div className="grid md:grid-cols-4 gap-6">
          {features.map((feature, index) => {
            const Icon = feature.icon;
            return (
              <div
                key={index}
                className="p-6 rounded-lg border-2 border-gray-200 dark:border-gray-800 hover:border-core314-electric-blue transition-colors"
              >
                <Icon className="h-8 w-8 text-core314-electric-blue mb-3" />
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                  {feature.title}
                </h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  {feature.description}
                </p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
