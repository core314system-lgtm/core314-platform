export interface AutomationMapEntry {
  description: string;
  action: string;
  aiPrompt: string;
}

export const AUTOMATION_MAP: Record<string, AutomationMapEntry> = {
  integration_connected: {
    description: "Confirm integration connection and post success message",
    action: "sendSlackMessage",
    aiPrompt: "Summarize the new connection and notify the admin channel."
  },
  low_performance_score: {
    description: "Notify manager when score drops below threshold",
    action: "sendTeamsAlert",
    aiPrompt: "Draft an improvement action summary."
  },
  new_invoice: {
    description: "Process new QuickBooks invoice",
    action: "createSupabaseEntry",
    aiPrompt: "Summarize invoice details and categorize by project."
  },
  high_variance_detected: {
    description: "Alert when integration shows unusual variance",
    action: "sendSlackMessage",
    aiPrompt: "Explain the variance spike and recommend investigation."
  },
  optimization_opportunity: {
    description: "Notify when optimization recommendations are available",
    action: "sendTeamsAlert",
    aiPrompt: "Summarize optimization opportunities and potential impact."
  },
  governance_violation: {
    description: "Alert when governance policy is violated",
    action: "sendSlackMessage",
    aiPrompt: "Explain the governance violation and required action."
  },
  payment_received: {
    description: "Confirm payment receipt from QuickBooks",
    action: "sendSlackMessage",
    aiPrompt: "Summarize payment details and update financial dashboard."
  },
  simulation_complete: {
    description: "Notify when predictive simulation finishes",
    action: "sendTeamsAlert",
    aiPrompt: "Summarize simulation results and key insights."
  }
};
