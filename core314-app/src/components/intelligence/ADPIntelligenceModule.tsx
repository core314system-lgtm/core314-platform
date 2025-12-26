import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Badge } from '../ui/badge';
import { Users, Calendar, TrendingUp } from 'lucide-react';

interface PlaceholderKPIProps {
  icon: React.ReactNode;
  label: string;
  value: string;
  subtext: string;
}

function PlaceholderKPI({ icon, label, value, subtext }: PlaceholderKPIProps) {
  return (
    <div className="flex items-start gap-3 p-3 rounded-lg bg-gray-50 dark:bg-gray-800/50">
      <div className="p-2 rounded-lg bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400">
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

export function ADPIntelligenceModule() {
  return (
    <Card className="border-green-200 dark:border-green-800">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-lg">
            <div className="h-5 w-5 rounded bg-red-600 flex items-center justify-center text-white text-xs font-bold">
              ADP
            </div>
            HR Intelligence (ADP)
          </CardTitle>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="border-amber-300 text-amber-700 dark:border-amber-600 dark:text-amber-400">
              Modeled Example
            </Badge>
            <Badge variant="secondary" className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300">
              Beta
            </Badge>
          </div>
        </div>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Human resources analytics from ADP workforce data
        </p>
        <p className="text-sm text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 px-3 py-2 rounded-md">
          This is a modeled example of how HR intelligence will appear once an HR system is connected.
        </p>
      </CardHeader>
      <CardContent className="space-y-3">
        <PlaceholderKPI
          icon={<Users className="h-4 w-4" />}
          label="Headcount Trend"
          value="--"
          subtext="Placeholder - data coming soon"
        />
        <PlaceholderKPI
          icon={<Calendar className="h-4 w-4" />}
          label="Absenteeism Rate"
          value="--"
          subtext="Placeholder - data coming soon"
        />
        <PlaceholderKPI
          icon={<TrendingUp className="h-4 w-4" />}
          label="Workforce Stability"
          value="--"
          subtext="Placeholder - data coming soon"
        />
      </CardContent>
    </Card>
  );
}
