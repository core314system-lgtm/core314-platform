
import { Handler, HandlerEvent, HandlerContext } from '@netlify/functions';

interface RecalculateResponse {
  success: boolean;
  total_users: number;
  scores_calculated: number;
  errors: number;
  message: string;
}

const handler: Handler = async (event: HandlerEvent, context: HandlerContext) => {
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'Method not allowed' }),
    };
  }

  try {
    const authHeader = event.headers.authorization || event.headers.Authorization;
    if (!authHeader) {
      return {
        statusCode: 401,
        body: JSON.stringify({ error: 'Missing authorization header' }),
      };
    }

    const supabaseUrl = process.env.VITE_SUPABASE_URL;
    const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseAnonKey) {
      return {
        statusCode: 500,
        body: JSON.stringify({ error: 'Missing Supabase configuration' }),
      };
    }

    const verifyResponse = await fetch(`${supabaseUrl}/rest/v1/profiles?select=role&id=eq.${authHeader}`, {
      headers: {
        'apikey': supabaseAnonKey,
        'Authorization': authHeader,
      },
    });

    if (!verifyResponse.ok) {
      return {
        statusCode: 401,
        body: JSON.stringify({ error: 'Unauthorized: Invalid authentication' }),
      };
    }

    const profiles = await verifyResponse.json();
    if (!profiles || profiles.length === 0 || profiles[0].role !== 'admin') {
      return {
        statusCode: 403,
        body: JSON.stringify({ error: 'Forbidden: Admin access required' }),
      };
    }

    const betaUsersResponse = await fetch(`${supabaseUrl}/rest/v1/beta_users?select=user_id`, {
      headers: {
        'apikey': supabaseAnonKey,
        'Authorization': authHeader,
      },
    });

    if (!betaUsersResponse.ok) {
      return {
        statusCode: 500,
        body: JSON.stringify({ error: 'Failed to fetch beta users' }),
      };
    }

    const betaUsers = await betaUsersResponse.json();
    const totalUsers = betaUsers.length;
    let scoresCalculated = 0;
    let errors = 0;

    for (const betaUser of betaUsers) {
      try {
        const calculateResponse = await fetch(`${supabaseUrl}/functions/v1/calculate-user-score`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': authHeader,
          },
          body: JSON.stringify({ user_id: betaUser.user_id }),
        });

        if (calculateResponse.ok) {
          scoresCalculated++;
        } else {
          console.error(`Failed to calculate score for user ${betaUser.user_id}`);
          errors++;
        }
      } catch (error) {
        console.error(`Error calculating score for user ${betaUser.user_id}:`, error);
        errors++;
      }
    }

    const response: RecalculateResponse = {
      success: true,
      total_users: totalUsers,
      scores_calculated: scoresCalculated,
      errors: errors,
      message: `Successfully recalculated scores for ${scoresCalculated} out of ${totalUsers} users`,
    };

    return {
      statusCode: 200,
      body: JSON.stringify(response),
    };

  } catch (error) {
    console.error('Unexpected error in admin-recalculate-user-scores:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ 
        error: error instanceof Error ? error.message : 'Unknown error occurred' 
      }),
    };
  }
};

export { handler };
