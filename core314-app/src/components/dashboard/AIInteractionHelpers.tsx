import { useState } from 'react';
import { ChevronDown, ChevronUp, HelpCircle, Lightbulb, AlertCircle } from 'lucide-react';
import { Button } from '../ui/button';

/**
 * AI Interaction Discipline Components
 * 
 * These components help users ask better questions to Core314 AI.
 * Frontend-only, no backend changes, no AI prompt changes.
 */

// ============================================
// HOW TO ASK CORE314 - Expandable Guidance
// ============================================

interface HowToAskGuidanceProps {
  integrationName?: string;
}

export function HowToAskGuidance({ integrationName }: HowToAskGuidanceProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <div className="mb-3">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-300 transition-colors"
      >
        <HelpCircle className="h-3.5 w-3.5" />
        <span>How to ask Core314</span>
        {isExpanded ? (
          <ChevronUp className="h-3 w-3" />
        ) : (
          <ChevronDown className="h-3 w-3" />
        )}
      </button>

      {isExpanded && (
        <div className="mt-3 p-3 rounded-lg bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 text-xs space-y-3">
          {/* System-level questions */}
          <div>
            <p className="font-medium text-slate-700 dark:text-slate-300 mb-1.5 flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-blue-500"></span>
              System-level questions
            </p>
            <ul className="space-y-1 text-slate-600 dark:text-slate-400 pl-3">
              <li>"Which integration is contributing the least to my system efficiency?"</li>
              <li>"Why did my Global Fusion Score change this week?"</li>
            </ul>
          </div>

          {/* Integration-level questions */}
          <div>
            <p className="font-medium text-slate-700 dark:text-slate-300 mb-1.5 flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-purple-500"></span>
              Integration-level questions
            </p>
            <ul className="space-y-1 text-slate-600 dark:text-slate-400 pl-3">
              <li>"What efficiency signals is {integrationName || 'Slack'} contributing?"</li>
              <li>"Why is {integrationName || 'Microsoft Teams'} classified as observing?"</li>
            </ul>
          </div>

          {/* Optimization questions */}
          <div>
            <p className="font-medium text-slate-700 dark:text-slate-300 mb-1.5 flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
              Optimization questions
            </p>
            <ul className="space-y-1 text-slate-600 dark:text-slate-400 pl-3">
              <li>"Where is my system showing friction?"</li>
              <li>"What should I improve first to raise system confidence?"</li>
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================
// PROMPT SUGGESTION CHIPS
// ============================================

interface PromptChip {
  label: string;
  prompt: string;
}

// Global dashboard prompts (system-wide)
export const GLOBAL_PROMPT_CHIPS: PromptChip[] = [
  { label: 'Score change', prompt: 'Why did my Global Fusion Score change this week?' },
  { label: 'Lowest contributor', prompt: 'Which integration is contributing the least to my system efficiency?' },
  { label: 'System friction', prompt: 'Where is my system showing friction?' },
  { label: 'Improve confidence', prompt: 'What should I improve first to raise system confidence?' },
  { label: 'Integration comparison', prompt: 'How do my integrations compare in terms of efficiency?' },
];

// Integration-scoped prompts (per-integration)
export function getIntegrationPromptChips(integrationName: string): PromptChip[] {
  return [
    { label: 'Efficiency signals', prompt: `What efficiency signals is ${integrationName} contributing?` },
    { label: 'Current status', prompt: `Why is ${integrationName} classified as it is?` },
    { label: 'Score impact', prompt: `How is ${integrationName} affecting my Global Fusion Score?` },
    { label: 'Recent changes', prompt: `What changed recently in ${integrationName}?` },
  ];
}

interface PromptChipsProps {
  chips: PromptChip[];
  onChipClick: (prompt: string) => void;
  disabled?: boolean;
}

export function PromptChips({ chips, onChipClick, disabled }: PromptChipsProps) {
  return (
    <div className="flex flex-wrap gap-1.5 mb-3">
      <Lightbulb className="h-3.5 w-3.5 text-amber-500 mt-1" />
      {chips.map((chip, index) => (
        <button
          key={index}
          onClick={() => onChipClick(chip.prompt)}
          disabled={disabled}
          className="px-2 py-1 text-xs rounded-full bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {chip.label}
        </button>
      ))}
    </div>
  );
}

// ============================================
// VAGUE QUERY DETECTION (Soft Guardrail)
// ============================================

const VAGUE_QUERY_PATTERNS = [
  /^help(\s+me)?$/i,
  /^what('s| is) wrong\??$/i,
  /^analyze( this)?$/i,
  /^tell me$/i,
  /^what do you (think|see)\??$/i,
  /^anything\??$/i,
  /^something$/i,
  /^idk$/i,
  /^what$/i,
  /^why$/i,
  /^how$/i,
  /^explain$/i,
  /^show me$/i,
  /^fix( it)?$/i,
];

export function isVagueQuery(query: string): boolean {
  const trimmed = query.trim();
  
  // Check if query is too short (less than 10 characters and not a specific keyword)
  if (trimmed.length < 10) {
    return VAGUE_QUERY_PATTERNS.some(pattern => pattern.test(trimmed));
  }
  
  // Check against vague patterns
  return VAGUE_QUERY_PATTERNS.some(pattern => pattern.test(trimmed));
}

interface VagueQueryWarningProps {
  onDismiss: () => void;
}

export function VagueQueryWarning({ onDismiss }: VagueQueryWarningProps) {
  return (
    <div className="mb-3 p-3 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 flex items-start gap-2">
      <AlertCircle className="h-4 w-4 text-amber-600 flex-shrink-0 mt-0.5" />
      <div className="flex-1">
        <p className="text-sm text-amber-800 dark:text-amber-200">
          Core314 works best with system-focused questions. Try selecting an integration or asking about system efficiency.
        </p>
      </div>
      <button
        onClick={onDismiss}
        className="text-xs text-amber-600 hover:text-amber-800 dark:text-amber-400 dark:hover:text-amber-200"
      >
        Dismiss
      </button>
    </div>
  );
}

// ============================================
// CONTEXT LABEL (Visual Confirmation)
// ============================================

interface ContextLabelProps {
  integrationName?: string;
}

export function ContextLabel({ integrationName }: ContextLabelProps) {
  return (
    <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 mb-2">
      <span className="w-1.5 h-1.5 rounded-full bg-blue-500"></span>
      <span>System Context: {integrationName || 'All Integrations'}</span>
    </div>
  );
}
