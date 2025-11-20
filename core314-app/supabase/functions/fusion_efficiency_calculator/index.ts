
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface FusionMetricInput {
  integration_name: string;
  success_count: number;
  failure_count: number;
  avg_response_time_ms: number;
  data_quality_score: number; // 0-100
  uptime_percentage: number; // 0-100
}

interface FusionMetricOutput {
  integration_name: string;
  fusion_score: number;
  efficiency_index: number;
  trend_7d: number;
  stability_confidence: number;
  last_anomaly_at: string | null;
}

/**
 * Calculate Fusion Score (0-100)
 * Weighted average of success rate, data quality, and uptime
 */
function calculateFusionScore(input: FusionMetricInput): number {
  const totalRequests = input.success_count + input.failure_count;
  const successRate = totalRequests > 0 ? (input.success_count / totalRequests) * 100 : 0;
  
  const fusionScore = (
    successRate * 0.4 +
    input.data_quality_score * 0.3 +
    input.uptime_percentage * 0.3
  );
  
  return Math.round(fusionScore * 100) / 100; // Round to 2 decimals
}

/**
 * Calculate Efficiency Index
 * Measures throughput efficiency considering response time and success rate
 */
function calculateEfficiencyIndex(input: FusionMetricInput): number {
  const totalRequests = input.success_count + input.failure_count;
  const successRate = totalRequests > 0 ? input.success_count / totalRequests : 0;
  
  const baselineResponseTime = 1000; // 1 second baseline
  const efficiencyRatio = totalRequests > 0
    ? (successRate * baselineResponseTime) / Math.max(input.avg_response_time_ms, 1)
    : 0;
  
  const efficiencyIndex = Math.min(efficiencyRatio * 100, 100);
  
  return Math.round(efficiencyIndex * 100) / 100;
}

/**
 * Calculate Stability Confidence (0-100)
 * Based on consistency of performance and absence of anomalies
 */
function calculateStabilityConfidence(
  input: FusionMetricInput,
  historicalData: any[]
): number {
  const totalRequests = input.success_count + input.failure_count;
  const successRate = totalRequests > 0 ? input.success_count / totalRequests : 0;
  
  let confidence = successRate * 100;
  
  if (input.avg_response_time_ms > 2000) {
    confidence *= 0.9;
  }
  
  if (input.uptime_percentage < 95) {
    confidence *= 0.85;
  }
  
  if (historicalData.length > 0) {
    const recentScores = historicalData.slice(-7).map((d: any) => d.fusion_score);
    const avgScore = recentScores.reduce((a: number, b: number) => a + b, 0) / recentScores.length;
    const variance = recentScores.reduce((sum: number, score: number) => 
      sum + Math.pow(score - avgScore, 2), 0) / recentScores.length;
    const stdDev = Math.sqrt(variance);
    
    if (stdDev > 15) {
      confidence *= 0.8;
    }
  }
  
  return Math.round(Math.min(confidence, 100) * 100) / 100;
}

/**
 * Calculate 7-day trend
 * Positive = improving, Negative = declining
 */
function calculate7DayTrend(historicalData: any[]): number {
  if (historicalData.length < 2) return 0;
  
  const recent7Days = historicalData.slice(-7);
  if (recent7Days.length < 2) return 0;
  
  const oldestScore = recent7Days[0].fusion_score;
  const newestScore = recent7Days[recent7Days.length - 1].fusion_score;
  
  const trend = ((newestScore - oldestScore) / oldestScore) * 100;
  return Math.round(trend * 100) / 100;
}

/**
 * Detect anomalies based on recent performance
 */
function detectAnomaly(input: FusionMetricInput, historicalData: any[]): string | null {
  const totalRequests = input.success_count + input.failure_count;
  const successRate = totalRequests > 0 ? input.success_count / totalRequests : 0;
  
  if (successRate < 0.5) return new Date().toISOString(); // <50% success rate
  if (input.avg_response_time_ms > 5000) return new Date().toISOString(); // >5s response time
  if (input.uptime_percentage < 90) return new Date().toISOString(); // <90% uptime
  
  if (historicalData.length > 0) {
    const recentScores = historicalData.slice(-3).map((d: any) => d.fusion_score);
    const avgRecentScore = recentScores.reduce((a: number, b: number) => a + b, 0) / recentScores.length;
    const currentScore = calculateFusionScore(input);
    
    if (currentScore < avgRecentScore * 0.7) { // 30% drop
      return new Date().toISOString();
    }
  }
  
  return null;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      {
        global: {
          headers: { Authorization: req.headers.get("Authorization")! },
        },
      }
    );

    const {
      data: { user },
      error: userError,
    } = await supabaseClient.auth.getUser();

    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { metrics } = await req.json() as { metrics: FusionMetricInput[] };

    if (!metrics || !Array.isArray(metrics)) {
      return new Response(
        JSON.stringify({ error: "Invalid input: metrics array required" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const results: FusionMetricOutput[] = [];

    for (const metric of metrics) {
      const { data: historicalData } = await supabaseClient
        .from("fusion_efficiency_metrics")
        .select("fusion_score, created_at")
        .eq("user_id", user.id)
        .eq("integration_name", metric.integration_name)
        .order("created_at", { ascending: false })
        .limit(30);

      const fusionScore = calculateFusionScore(metric);
      const efficiencyIndex = calculateEfficiencyIndex(metric);
      const stabilityConfidence = calculateStabilityConfidence(
        metric,
        historicalData || []
      );
      const trend7d = calculate7DayTrend(historicalData || []);
      const lastAnomalyAt = detectAnomaly(metric, historicalData || []);

      const output: FusionMetricOutput = {
        integration_name: metric.integration_name,
        fusion_score: fusionScore,
        efficiency_index: efficiencyIndex,
        trend_7d: trend7d,
        stability_confidence: stabilityConfidence,
        last_anomaly_at: lastAnomalyAt,
      };

      const { error: upsertError } = await supabaseClient
        .from("fusion_efficiency_metrics")
        .upsert(
          {
            user_id: user.id,
            ...output,
          },
          {
            onConflict: "user_id,integration_name",
          }
        );

      if (upsertError) {
        console.error("Upsert error:", upsertError);
      }

      results.push(output);
    }

    return new Response(
      JSON.stringify({
        success: true,
        metrics: results,
        calculated_at: new Date().toISOString(),
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
