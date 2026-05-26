import React from 'react';
import { Progress } from '../ui/progress';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '../ui/tooltip';
import { Info } from 'lucide-react';

interface UsageProgressBarProps {
  used: number;
  limit: number;
  label: string;
  showTooltip?: boolean;
  tooltipContent?: string;
}

export const UsageProgressBar: React.FC<UsageProgressBarProps> = ({
  used,
  limit,
  label,
  showTooltip = true,
  tooltipContent,
}) => {
  const isUnlimited = limit === -1;
  const percentage = isUnlimited ? 0 : Math.min((used / limit) * 100, 100);
  const isNearLimit = percentage >= 80;
  const isAtLimit = percentage >= 100;

  const getProgressColor = () => {
    if (isAtLimit) return 'bg-red-600';
    if (isNearLimit) return 'bg-amber-600';
    return 'bg-primary';
  };

  const getStatusText = () => {
    if (isUnlimited) return `${used} used (Unlimited)`;
    return `${used} / ${limit} used`;
  };

  const getStatusColor = () => {
    if (isAtLimit) return 'text-red-600';
    if (isNearLimit) return 'text-amber-600';
    return 'text-muted-foreground';
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">{label}</span>
          {showTooltip && tooltipContent && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger>
                  <Info className="h-4 w-4 text-muted-foreground" />
                </TooltipTrigger>
                <TooltipContent>
                  <p className="max-w-xs">{tooltipContent}</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
        </div>
        <span className={`text-sm ${getStatusColor()}`}>
          {getStatusText()}
        </span>
      </div>
      {!isUnlimited && (
        <Progress value={percentage} className={getProgressColor()} />
      )}
      {isAtLimit && (
        <p className="text-xs text-red-600">
          You've reached your limit. Upgrade your plan to add more {label.toLowerCase()}.
        </p>
      )}
      {isNearLimit && !isAtLimit && (
        <p className="text-xs text-amber-600">
          You're approaching your limit. Consider upgrading your plan.
        </p>
      )}
    </div>
  );
};
