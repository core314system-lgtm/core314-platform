import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Badge } from '../ui/badge';
import { Video, Users, BarChart3 } from 'lucide-react';

interface PlaceholderKPIProps {
  icon: React.ReactNode;
  label: string;
  value: string;
  subtext: string;
}

function PlaceholderKPI({ icon, label, value, subtext }: PlaceholderKPIProps) {
  return (
    <div className="flex items-start gap-3 p-3 rounded-lg bg-gray-50 dark:bg-gray-800/50">
      <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400">
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs text-gray-500 dark:text-gray-400">{label}</p>
        <p className="text-lg font-semibold text-gray-900 dark:text-white">{value}</p>
        <p className="text-xs text-gray-400 dark:text-gray-500">{subtext}</p>
      </div>
    </div>
  );
}

export function TeamsIntelligenceModule() {
  return (
    <Card className="border-blue-200 dark:border-blue-800">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-lg">
            <img 
              src="https://cdn.worldvectorlogo.com/logos/microsoft-teams-1.svg" 
              alt="Microsoft Teams" 
              className="h-5 w-5"
            />
            Microsoft Teams Intelligence
          </CardTitle>
          <Badge variant="secondary" className="bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">
            Beta
          </Badge>
        </div>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Collaboration analytics from your Teams workspace
        </p>
      </CardHeader>
      <CardContent className="space-y-3">
        <PlaceholderKPI
          icon={<Video className="h-4 w-4" />}
          label="Meetings per User"
          value="--"
          subtext="Placeholder - data coming soon"
        />
        <PlaceholderKPI
          icon={<BarChart3 className="h-4 w-4" />}
          label="Meeting Load"
          value="--"
          subtext="Placeholder - data coming soon"
        />
        <PlaceholderKPI
          icon={<Users className="h-4 w-4" />}
          label="Collaboration Balance"
          value="--"
          subtext="Placeholder - data coming soon"
        />
        <div className="pt-2 border-t border-gray-100 dark:border-gray-800">
          <p className="text-xs text-gray-400 dark:text-gray-500 text-center">
            Real-time analytics will be available in a future release
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
