import { LineChart, Line, ResponsiveContainer, YAxis } from 'recharts';
import { FusionScoreHistory } from '../../types';

interface ScoreSparklineProps {
  history: FusionScoreHistory[];
}

export function ScoreSparkline({ history }: ScoreSparklineProps) {
  if (!history || history.length === 0) {
    return (
      <div className="h-12 flex items-center justify-center text-xs text-gray-400">
        No trend data
      </div>
    );
  }

  const data = history
    .sort((a, b) => new Date(a.recorded_at).getTime() - new Date(b.recorded_at).getTime())
    .slice(-10)
    .map(h => ({
      score: h.fusion_score,
      time: new Date(h.recorded_at).getTime(),
    }));

  return (
    <div className="h-12 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 2, right: 2, bottom: 2, left: 2 }}>
          <YAxis domain={[0, 100]} hide />
          <Line
            type="monotone"
            dataKey="score"
            stroke="#3b82f6"
            strokeWidth={2}
            dot={false}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
