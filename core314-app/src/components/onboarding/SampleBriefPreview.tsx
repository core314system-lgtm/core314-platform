import { Link } from 'react-router-dom';
import { Button } from '../ui/button';
import { Sparkles, Zap, TrendingUp, Shield, ArrowRight, Lock } from 'lucide-react';

/**
 * SampleBriefPreview
 *
 * Shows a redacted/blurred sample Operational Brief to pre-activation users
 * so they can see what they're working toward before connecting integrations.
 *
 * Displayed on the /brief page when hasGeneratedBrief === false.
 */
export function SampleBriefPreview({ hasConnectedIntegration }: { hasConnectedIntegration: boolean }) {
  return (
    <div className="space-y-6">
      {/* Intro Banner */}
      <div className="rounded-2xl border border-sky-500/30 bg-gradient-to-br from-sky-900/20 to-indigo-900/20 p-6">
        <div className="flex items-start gap-4">
          <div className="flex-shrink-0 w-12 h-12 bg-sky-500/20 rounded-xl flex items-center justify-center">
            <Sparkles className="h-6 w-6 text-sky-400" />
          </div>
          <div className="flex-1">
            <h2 className="text-xl font-semibold text-white mb-2">
              See What Your Operational Brief Will Look Like
            </h2>
            <p className="text-sm text-slate-300 leading-relaxed mb-4">
              {hasConnectedIntegration
                ? "You've connected an integration — now generate your first brief to see real insights from your data."
                : "Connect your first integration to unlock AI-powered operational intelligence. Below is a preview of what Core314 generates from your data."
              }
            </p>
            <Link to={hasConnectedIntegration ? '/brief' : '/integration-manager'}>
              <Button className="bg-sky-600 hover:bg-sky-700 text-white">
                {hasConnectedIntegration ? (
                  <>
                    <Sparkles className="h-4 w-4 mr-2" />
                    Generate Your First Brief
                  </>
                ) : (
                  <>
                    <Zap className="h-4 w-4 mr-2" />
                    Connect Your First Integration
                    <ArrowRight className="h-4 w-4 ml-2" />
                  </>
                )}
              </Button>
            </Link>
          </div>
        </div>
      </div>

      {/* Sample Brief (blurred/redacted) */}
      <div className="relative rounded-2xl bg-slate-900 border border-slate-700/50 overflow-hidden">
        {/* Blur overlay */}
        <div className="absolute inset-0 z-10 backdrop-blur-[2px] bg-slate-900/30 flex items-center justify-center">
          <div className="text-center p-8 max-w-md">
            <div className="w-16 h-16 mx-auto mb-4 bg-sky-500/20 rounded-2xl flex items-center justify-center">
              <Lock className="h-8 w-8 text-sky-400" />
            </div>
            <h3 className="text-lg font-semibold text-white mb-2">
              {hasConnectedIntegration
                ? 'Generate your brief to unlock real insights'
                : 'Connect an integration to unlock your brief'
              }
            </h3>
            <p className="text-sm text-slate-400 mb-4">
              This is a sample brief showing the kind of intelligence Core314 generates.
              Your actual brief will contain real insights from your connected systems.
            </p>
            <Link to={hasConnectedIntegration ? '/brief' : '/integration-manager'}>
              <Button className="bg-sky-600 hover:bg-sky-700 text-white">
                {hasConnectedIntegration ? 'Generate Brief' : 'Connect Integration'}
                <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            </Link>
          </div>
        </div>

        {/* Sample content (visible but blurred behind overlay) */}
        <div className="p-8 select-none" aria-hidden="true">
          {/* Sample Header */}
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-xl font-bold text-white">Weekly Operational Intelligence Brief</h2>
              <p className="text-sm text-slate-400 mt-1">Generated April 2026</p>
            </div>
            <div className="flex items-center gap-3">
              <div className="text-right">
                <div className="text-3xl font-bold text-amber-400">68</div>
                <div className="text-xs text-slate-400">Health Score</div>
              </div>
            </div>
          </div>

          {/* Sample Health Score Card */}
          <div className="rounded-xl bg-slate-800/60 border border-slate-700/50 p-5 mb-4">
            <div className="flex items-center gap-2 mb-3">
              <Shield className="h-5 w-5 text-amber-400" />
              <h3 className="text-sm font-semibold text-slate-200">Operational Health</h3>
            </div>
            <p className="text-sm text-slate-300 leading-relaxed">
              Operations are functioning at moderate capacity with several areas requiring attention.
              Revenue pipeline shows early signs of slowdown with 3 deals stalled beyond expected close dates.
              Customer support response times have improved 15% week-over-week.
            </p>
          </div>

          {/* Sample Signals */}
          <div className="rounded-xl bg-slate-800/60 border border-slate-700/50 p-5 mb-4">
            <div className="flex items-center gap-2 mb-3">
              <Zap className="h-5 w-5 text-sky-400" />
              <h3 className="text-sm font-semibold text-slate-200">Detected Signals</h3>
            </div>
            <ul className="space-y-2 text-sm text-slate-300">
              <li className="flex items-start gap-2">
                <span className="mt-1.5 w-2 h-2 rounded-full bg-red-400 flex-shrink-0" />
                Revenue pipeline velocity has decreased 22% — 3 opportunities stalled beyond expected close
              </li>
              <li className="flex items-start gap-2">
                <span className="mt-1.5 w-2 h-2 rounded-full bg-amber-400 flex-shrink-0" />
                2 invoices totaling $18,400 are 15+ days past due with no follow-up recorded
              </li>
              <li className="flex items-start gap-2">
                <span className="mt-1.5 w-2 h-2 rounded-full bg-amber-400 flex-shrink-0" />
                Sprint completion rate dropped to 67% — 4 tasks reassigned mid-sprint
              </li>
              <li className="flex items-start gap-2">
                <span className="mt-1.5 w-2 h-2 rounded-full bg-green-400 flex-shrink-0" />
                Customer support first-response time improved to 2.3h average (was 4.1h)
              </li>
            </ul>
          </div>

          {/* Sample Recommendations */}
          <div className="rounded-xl bg-slate-800/60 border border-slate-700/50 p-5">
            <div className="flex items-center gap-2 mb-3">
              <TrendingUp className="h-5 w-5 text-emerald-400" />
              <h3 className="text-sm font-semibold text-slate-200">Recommended Actions</h3>
            </div>
            <ul className="space-y-2 text-sm text-slate-300">
              <li className="flex items-start gap-2">
                <span className="text-emerald-400 font-bold flex-shrink-0">1.</span>
                Schedule pipeline review with sales leadership — focus on the 3 stalled opportunities
              </li>
              <li className="flex items-start gap-2">
                <span className="text-emerald-400 font-bold flex-shrink-0">2.</span>
                Escalate overdue invoices to collections — $18.4K at risk of aging past 30 days
              </li>
              <li className="flex items-start gap-2">
                <span className="text-emerald-400 font-bold flex-shrink-0">3.</span>
                Review sprint planning process — high reassignment rate suggests scope issues
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
