import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Badge } from '../ui/badge';
import { Lock, Activity, GitBranch, TrendingUp } from 'lucide-react';

/**
 * Intelligence Preview Panels - Observe Tier Only
 * 
 * Shows locked/read-only preview cards that make system learning visible
 * WITHOUT enabling AI, scoring, predictions, or changing execution logic.
 * 
 * This is a UX + copy + frontend-only component.
 * NO backend changes. NO AI calls. NO execution-mode logic touched.
 */

interface PreviewCard {
  title: string;
  statusBadge: string;
  statusIcon: string;
  body: string;
  footer: string;
  icon: React.ReactNode;
}

const previewCards: PreviewCard[] = [
  {
    title: 'Behavior Patterns',
    statusBadge: 'Observing',
    statusIcon: '🔒',
    body: 'Core314 is detecting recurring activity patterns across connected systems.',
    footer: 'Patterns activate during Analyze.',
    icon: <Activity className="h-5 w-5 text-slate-400" />,
  },
  {
    title: 'System Relationships',
    statusBadge: 'Mapping',
    statusIcon: '🔒',
    body: 'Dependencies and cross-system influence are being discovered.',
    footer: 'Relationship intelligence activates during Analyze.',
    icon: <GitBranch className="h-5 w-5 text-slate-400" />,
  },
  {
    title: 'Score Variance',
    statusBadge: 'Calibrating',
    statusIcon: '🔒',
    body: 'Score dynamics are forming but not yet computed.',
    footer: 'Dynamic scoring activates during Analyze.',
    icon: <TrendingUp className="h-5 w-5 text-slate-400" />,
  },
];

export function IntelligencePreviewPanels() {
  return (
    <Card className="border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-900/20">
      <CardHeader>
        <div className="flex items-center gap-2">
          <Lock className="h-5 w-5 text-slate-400" />
          <CardTitle className="text-lg text-slate-700 dark:text-slate-300">
            System Intelligence — Calibration In Progress
          </CardTitle>
        </div>
        <p className="text-sm text-slate-600 dark:text-slate-400 mt-2">
          Core314 is actively learning how your systems behave. Intelligence becomes available once sufficient context is accumulated.
        </p>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {previewCards.map((card) => (
            <div
              key={card.title}
              className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-4 opacity-75"
            >
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  {card.icon}
                  <h4 className="font-medium text-slate-700 dark:text-slate-300 text-sm">
                    {card.title}
                  </h4>
                </div>
                <Badge variant="secondary" className="text-xs bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400">
                  {card.statusIcon} {card.statusBadge}
                </Badge>
              </div>
              <p className="text-sm text-slate-600 dark:text-slate-400 mb-3">
                {card.body}
              </p>
              <p className="text-xs text-slate-400 dark:text-slate-500 italic">
                {card.footer}
              </p>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
