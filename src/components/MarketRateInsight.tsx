import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { TrendingUp, TrendingDown, Minus, BarChart3 } from 'lucide-react'

interface MarketRate {
  category: string
  avg_rate: number
  min_rate: number
  max_rate: number
  sample_size: number
  region?: string
}

interface Props {
  category: string
  currentQuote?: number
  region?: string
}

export default function MarketRateInsight({ category, currentQuote, region }: Props) {
  const [rate, setRate] = useState<MarketRate | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadMarketRate()
  }, [category, region])

  async function loadMarketRate() {
    try {
      // Query historical quotes for this service category
      const { data: quotes } = await supabase
        .from('sow_subcontractors')
        .select('quote_amount, sow_items!inner(service_category, task_orders!inner(location_state))')
        .not('quote_amount', 'is', null)
        .gt('quote_amount', 0)

      if (!quotes || quotes.length === 0) {
        setLoading(false)
        return
      }

      // Filter by category (approximate match)
      const catLower = category.toLowerCase()
      const relevant = quotes.filter((q: any) => {
        const sowCat = (q.sow_items?.service_category || '').toLowerCase()
        return sowCat.includes(catLower) || catLower.includes(sowCat)
      })

      if (relevant.length === 0) {
        setLoading(false)
        return
      }

      const amounts = relevant.map((q: any) => Number(q.quote_amount)).filter(a => a > 0)
      if (amounts.length === 0) {
        setLoading(false)
        return
      }

      const sum = amounts.reduce((a: number, b: number) => a + b, 0)
      setRate({
        category,
        avg_rate: Math.round(sum / amounts.length),
        min_rate: Math.min(...amounts),
        max_rate: Math.max(...amounts),
        sample_size: amounts.length,
        region,
      })
    } catch {
      // Non-critical
    } finally {
      setLoading(false)
    }
  }

  if (loading || !rate) return null

  const comparison = currentQuote && rate.avg_rate > 0
    ? Math.round(((currentQuote - rate.avg_rate) / rate.avg_rate) * 100)
    : null

  return (
    <div className="bg-gradient-to-r from-indigo-50 to-blue-50 rounded-lg p-3 border border-indigo-100">
      <div className="flex items-center gap-1.5 mb-1">
        <BarChart3 size={12} className="text-indigo-600" />
        <span className="text-xs font-medium text-indigo-700">Market Rate Intelligence</span>
        <span className="text-xs text-gray-400">({rate.sample_size} quotes)</span>
      </div>
      <div className="flex items-center gap-4">
        <div>
          <span className="text-xs text-gray-500">Avg:</span>
          <span className="text-sm font-bold text-gray-900 ml-1">${rate.avg_rate.toLocaleString()}</span>
        </div>
        <div>
          <span className="text-xs text-gray-500">Range:</span>
          <span className="text-sm text-gray-700 ml-1">${rate.min_rate.toLocaleString()} — ${rate.max_rate.toLocaleString()}</span>
        </div>
        {comparison !== null && (
          <div className={`flex items-center gap-0.5 text-xs font-medium ${
            comparison > 10 ? 'text-red-600' : comparison < -10 ? 'text-green-600' : 'text-gray-600'
          }`}>
            {comparison > 0 ? <TrendingUp size={12} /> : comparison < 0 ? <TrendingDown size={12} /> : <Minus size={12} />}
            {comparison > 0 ? '+' : ''}{comparison}% vs market
          </div>
        )}
      </div>
    </div>
  )
}
