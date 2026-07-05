import { useState } from 'react'
import {
  Calendar, DollarSign, AlertTriangle, TrendingUp,
  ChevronLeft, ChevronRight,
} from 'lucide-react'
import FeatureGuidance from '../components/FeatureGuidance'

interface FYEvent {
  month: number
  label: string
  description: string
  type: 'budget' | 'spending' | 'cr' | 'opportunity'
}

const FY_EVENTS: FYEvent[] = [
  { month: 10, label: 'FY Start (Oct 1)', description: 'New fiscal year begins. Agencies execute new budgets. Peak procurement activity for pre-awarded contracts.', type: 'budget' },
  { month: 10, label: 'Q1 Spending Surge', description: 'Agencies rush to obligate carryover and new-year funds. High volume of task order releases.', type: 'spending' },
  { month: 11, label: 'Continuing Resolution Risk', description: 'If no appropriations bill passed, agencies operate under CR with prior-year funding levels. New starts may be delayed.', type: 'cr' },
  { month: 12, label: 'Q1 Closeout', description: 'End of Q1. Agencies report quarterly obligation rates. Good time to check agency spending dashboards.', type: 'budget' },
  { month: 1, label: 'President\'s Budget Prep', description: 'OMB finalizes the President\'s Budget Request for next FY. Signals upcoming priorities.', type: 'budget' },
  { month: 2, label: 'President\'s Budget Release', description: 'Typically released first Monday in February. Review for program funding changes that affect your pipeline.', type: 'budget' },
  { month: 3, label: 'Q2 Closeout', description: 'Mid-year review. Agencies assess obligation rates. Under-executing programs may accelerate spending.', type: 'budget' },
  { month: 4, label: 'Congressional Hearings', description: 'Appropriations subcommittees hold hearings. Watch for programmatic changes that could affect your contracts.', type: 'budget' },
  { month: 5, label: 'Pre-Award Season Ramp', description: 'Agencies begin pre-award activities for end-of-year spending. RFPs increase.', type: 'opportunity' },
  { month: 6, label: 'Q3 Closeout / Year-End Push', description: 'Agencies have 3 months to obligate remaining funds. Major increase in sole-source and small-dollar procurements.', type: 'spending' },
  { month: 7, label: 'Peak RFP Season', description: 'Highest volume of RFP releases. Agencies trying to award before September 30.', type: 'opportunity' },
  { month: 8, label: 'Year-End Spending Frenzy', description: 'Use-it-or-lose-it spending peaks. Task orders, modifications, and new awards accelerate dramatically.', type: 'spending' },
  { month: 9, label: 'FY End (Sep 30)', description: 'Fiscal year ends. All remaining funds must be obligated. Expect large volume of last-minute awards and modifications.', type: 'spending' },
  { month: 9, label: 'Q4 Closeout', description: 'Agencies finalize obligations. Contract actions slow dramatically in early October as new FY begins.', type: 'budget' },
]

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const QUARTER_MONTHS: Record<string, number[]> = {
  'Q1 (Oct–Dec)': [10, 11, 12],
  'Q2 (Jan–Mar)': [1, 2, 3],
  'Q3 (Apr–Jun)': [4, 5, 6],
  'Q4 (Jul–Sep)': [7, 8, 9],
}

const SPENDING_INTENSITY: Record<number, number> = {
  10: 70, 11: 40, 12: 35, 1: 30, 2: 30, 3: 35,
  4: 40, 5: 50, 6: 60, 7: 75, 8: 90, 9: 100,
}

const TYPE_STYLES: Record<string, { bg: string; text: string; icon: typeof DollarSign }> = {
  budget: { bg: 'bg-blue-100', text: 'text-blue-700', icon: DollarSign },
  spending: { bg: 'bg-green-100', text: 'text-green-700', icon: TrendingUp },
  cr: { bg: 'bg-red-100', text: 'text-red-700', icon: AlertTriangle },
  opportunity: { bg: 'bg-purple-100', text: 'text-purple-700', icon: Calendar },
}

export default function FiscalCalendar() {
  const now = new Date()
  const currentMonth = now.getMonth() + 1
  const [selectedFY, setSelectedFY] = useState(() => currentMonth >= 10 ? now.getFullYear() + 1 : now.getFullYear())

  const fyStart = `October 1, ${selectedFY - 1}`
  const fyEnd = `September 30, ${selectedFY}`

  // Arrange months in fiscal year order: Oct, Nov, Dec, Jan, Feb, ...
  const fyMonths = [10, 11, 12, 1, 2, 3, 4, 5, 6, 7, 8, 9]

  return (
    <div className="max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Calendar className="text-blue-600" size={28} />
            Government Fiscal Year Calendar
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">Federal spending cycles, budget milestones, and procurement timing</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setSelectedFY(y => y - 1)} className="p-2 hover:bg-gray-100 rounded-lg">
            <ChevronLeft size={16} />
          </button>
          <span className="text-lg font-bold text-gray-900 min-w-[80px] text-center">FY{selectedFY}</span>
          <button onClick={() => setSelectedFY(y => y + 1)} className="p-2 hover:bg-gray-100 rounded-lg">
            <ChevronRight size={16} />
          </button>
        </div>
      </div>

      <FeatureGuidance
        title="Government Fiscal Year Calendar"
        description="The federal government's fiscal year runs October 1 – September 30. Understanding the budget cycle helps you time BD activities, anticipate spending surges, and prepare for continuing resolution impacts."
        storageKey="fiscal_calendar"
        accentColor="blue"
        steps={[
          { title: 'Review the annual cycle', description: 'Understand when agencies receive budgets, when spending peaks, and when RFP volume increases.' },
          { title: 'Plan your BD calendar', description: 'Align your capture activities with agency spending patterns. Start capture early for Q4 awards.' },
          { title: 'Watch for CR impacts', description: 'Continuing Resolutions can freeze new starts and delay procurements. Plan contingencies.' },
        ]}
      />

      <div className="text-xs text-gray-500 mb-4 text-center">{fyStart} — {fyEnd}</div>

      {/* Spending Intensity Bar */}
      <div className="bg-white border border-gray-200 rounded-xl p-5 mb-6">
        <h3 className="text-sm font-semibold text-gray-700 mb-3">Federal Spending Intensity by Month</h3>
        <div className="flex items-end gap-1 h-32">
          {fyMonths.map(m => {
            const intensity = SPENDING_INTENSITY[m]
            const isCurrent = m === currentMonth
            return (
              <div key={m} className="flex-1 flex flex-col items-center gap-1">
                <div
                  className={`w-full rounded-t ${isCurrent ? 'bg-blue-500' : intensity >= 80 ? 'bg-green-500' : intensity >= 50 ? 'bg-green-400' : 'bg-green-200'}`}
                  style={{ height: `${intensity}%` }}
                />
                <span className={`text-[10px] ${isCurrent ? 'font-bold text-blue-600' : 'text-gray-500'}`}>
                  {MONTH_NAMES[m - 1]}
                </span>
              </div>
            )
          })}
        </div>
        <p className="text-[10px] text-gray-400 mt-2 text-center">
          Peak spending occurs July–September (Q4) as agencies obligate remaining funds before fiscal year end.
        </p>
      </div>

      {/* Quarterly Events */}
      <div className="space-y-6">
        {Object.entries(QUARTER_MONTHS).map(([quarter, months]) => (
          <div key={quarter} className="bg-white border border-gray-200 rounded-xl overflow-hidden">
            <div className="px-5 py-3 bg-gray-50 border-b border-gray-200">
              <h3 className="font-semibold text-gray-900 text-sm">{quarter}</h3>
            </div>
            <div className="divide-y divide-gray-100">
              {FY_EVENTS
                .filter(e => months.includes(e.month))
                .map((event, i) => {
                  const style = TYPE_STYLES[event.type]
                  const EventIcon = style.icon
                  return (
                    <div key={i} className="px-5 py-3 flex items-start gap-3">
                      <div className={`p-1.5 rounded-lg ${style.bg} flex-shrink-0`}>
                        <EventIcon size={14} className={style.text} />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-medium text-gray-900">{event.label}</p>
                          <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${style.bg} ${style.text}`}>
                            {event.type === 'cr' ? 'CR Risk' : event.type.charAt(0).toUpperCase() + event.type.slice(1)}
                          </span>
                        </div>
                        <p className="text-xs text-gray-600 mt-0.5">{event.description}</p>
                      </div>
                    </div>
                  )
                })}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
