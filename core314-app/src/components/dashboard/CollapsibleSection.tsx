import { useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '../ui/collapsible';

interface CollapsibleSectionProps {
  title: string;
  icon?: React.ReactNode;
  defaultOpen?: boolean;
  children: React.ReactNode;
  className?: string;
  headerActions?: React.ReactNode;
}

/**
 * CollapsibleSection - A reusable collapsible card section for the dashboard.
 * 
 * PRODUCT-CORRECTIVE UI REFACTOR:
 * - Reduces dashboard busyness via progressive disclosure
 * - Sections below the fold are collapsed by default
 * - NO DATA IS REMOVED - only visibility changes
 * - Expand/collapse affordances replace long inline explanations
 * 
 * Usage:
 * - defaultOpen={false} for sections below the fold
 * - defaultOpen={true} for primary focal elements above the fold
 */
export function CollapsibleSection({
  title,
  icon,
  defaultOpen = false,
  children,
  className = '',
  headerActions,
}: CollapsibleSectionProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen} className={className}>
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CollapsibleTrigger className="flex items-center gap-2 hover:text-blue-600 dark:hover:text-blue-400 transition-colors cursor-pointer">
              {isOpen ? (
                <ChevronDown className="h-4 w-4 text-gray-500" />
              ) : (
                <ChevronRight className="h-4 w-4 text-gray-500" />
              )}
              <CardTitle className="flex items-center gap-2 text-base">
                {icon}
                {title}
              </CardTitle>
            </CollapsibleTrigger>
            {headerActions && (
              <div className="flex items-center gap-2">
                {headerActions}
              </div>
            )}
          </div>
        </CardHeader>
        <CollapsibleContent>
          <CardContent className="pt-0">
            {children}
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}
