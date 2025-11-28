import { serve } from "https://deno.land/std/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js";

interface CategorizeRequest {
  feedback_id: string;
}

interface OpenAIResponse {
  choices: {
    message: {
      content: string;
    };
  }[];
}

interface AICategorizationResult {
  category: string;
  summary: string;
  sentiment: string;
}

serve(async (req) => {
  try {
    if (req.method === 'OPTIONS') {
      return new Response(null, {
        status: 200,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'POST, OPTIONS',
          'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
        },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Authorization required" }), { 
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Invalid token" }), { 
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (profileError || profile?.role !== 'admin') {
      return new Response(JSON.stringify({ error: "Admin access required" }), { 
        status: 403,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const { feedback_id }: CategorizeRequest = await req.json();
    if (!feedback_id) {
      return new Response(JSON.stringify({ error: "Missing feedback_id" }), { 
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const { data: feedback, error: fetchError } = await supabase
      .from('beta_feedback')
      .select('feedback_id, message, ai_category')
      .eq('feedback_id', feedback_id)
      .single();

    if (fetchError || !feedback) {
      return new Response(JSON.stringify({ error: "Feedback not found" }), { 
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    if (feedback.ai_category) {
      return new Response(JSON.stringify({ 
        feedback_id,
        ai_category: feedback.ai_category,
        message: "Already categorized"
      }), { 
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const openaiKey = Deno.env.get("AI_OPENAI_KEY");
    if (!openaiKey) {
      return new Response(JSON.stringify({ error: "OpenAI API key not configured" }), { 
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const prompt = `Classify the user feedback into:
1. category: one of ["UI/UX", "Performance", "Bug", "Feature Request", "Confusion/Clarity", "Praise", "Other"]
2. summary: one-sentence condensed version
3. sentiment: positive, neutral, or negative
Return JSON only.

Feedback: "${feedback.message}"`;

    const openaiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openaiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: 'You are a feedback categorization assistant. Always respond with valid JSON containing category, summary, and sentiment fields.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.1,
        max_tokens: 200,
      }),
    });

    if (!openaiResponse.ok) {
      const errorText = await openaiResponse.text();
      console.error('OpenAI API error:', errorText);
      return new Response(JSON.stringify({ error: "OpenAI API error" }), { 
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const openaiData: OpenAIResponse = await openaiResponse.json();
    const aiContent = openaiData.choices[0]?.message?.content;

    if (!aiContent) {
      return new Response(JSON.stringify({ error: "No AI response received" }), { 
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    let aiResult: AICategorizationResult;
    try {
      aiResult = JSON.parse(aiContent);
    } catch (parseError) {
      console.error('Failed to parse AI response:', aiContent);
      return new Response(JSON.stringify({ error: "Invalid AI response format" }), { 
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const validCategories = ["UI/UX", "Performance", "Bug", "Feature Request", "Confusion/Clarity", "Praise", "Other"];
    const validSentiments = ["positive", "neutral", "negative"];

    if (!validCategories.includes(aiResult.category)) {
      aiResult.category = "Other";
    }
    if (!validSentiments.includes(aiResult.sentiment)) {
      aiResult.sentiment = "neutral";
    }

    const { error: updateError } = await supabase
      .from('beta_feedback')
      .update({
        ai_category: aiResult.category,
        ai_summary: aiResult.summary,
        ai_sentiment: aiResult.sentiment,
      })
      .eq('feedback_id', feedback_id);

    if (updateError) {
      console.error('Database update error:', updateError);
      return new Response(JSON.stringify({ error: "Failed to update feedback" }), { 
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    return new Response(JSON.stringify({
      feedback_id,
      ai_category: aiResult.category,
      ai_summary: aiResult.summary,
      ai_sentiment: aiResult.sentiment,
    }), { 
      status: 200,
      headers: { 
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    });

  } catch (error) {
    console.error('Function error:', error);
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }), { 
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
});
