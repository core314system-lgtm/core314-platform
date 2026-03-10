const { createClient } = require("@supabase/supabase-js");

/**
 * HubSpot Data Ingestion & Signal Mapping
 * Polls HubSpot CRM for Contacts, Deals, Companies and converts them into Core314 signals.
 *
 * Called via:
 *   - Scheduled function (cron)
 *   - Manual POST with optional { user_id } body
 *
 * Environment variables:
 *   - HUBSPOT_CLIENT_ID, HUBSPOT_CLIENT_SECRET (for token refresh)
 *   - SUPABASE_URL or VITE_SUPABASE_URL
 *   - SUPABASE_SERVICE_ROLE_KEY
 */

// ---- Helpers ----

function getSupabase() {
  const url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Missing Supabase configuration");
  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

async function ensureFreshToken(supabase, connection) {
  const expiresAt = new Date(connection.token_expires_at);
  const now = new Date();
  // Refresh if expiring within 5 minutes
  if (expiresAt.getTime() - now.getTime() > 5 * 60 * 1000) {
    return connection.access_token;
  }

  console.log(`[hubspot-poll] Token expiring soon for user ${connection.user_id}, refreshing...`);

  const clientId = process.env.HUBSPOT_CLIENT_ID;
  const clientSecret = process.env.HUBSPOT_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error("Missing HubSpot OAuth credentials for token refresh");
  }

  const res = await fetch("https://api.hubapi.com/oauth/v1/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: connection.refresh_token,
    }).toString(),
  });

  if (!res.ok) {
    throw new Error(`Token refresh failed: ${res.status}`);
  }

  const data = await res.json();
  const newExpiresAt = new Date(Date.now() + data.expires_in * 1000).toISOString();

  // Update both tables
  await supabase
    .from("hubspot_connections")
    .update({
      access_token: data.access_token,
      refresh_token: data.refresh_token,
      token_expires_at: newExpiresAt,
      updated_at: new Date().toISOString(),
    })
    .eq("id", connection.id);

  if (connection.user_integration_id) {
    await supabase
      .from("user_integrations")
      .update({
        access_token: data.access_token,
        refresh_token: data.refresh_token,
        token_expires_at: newExpiresAt,
        updated_at: new Date().toISOString(),
      })
      .eq("id", connection.user_integration_id);
  }

  return data.access_token;
}

async function hubspotGet(accessToken, endpoint, params = {}) {
  const url = new URL(`https://api.hubapi.com${endpoint}`);
  for (const [k, v] of Object.entries(params)) {
    url.searchParams.set(k, String(v));
  }
  const res = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`HubSpot API ${endpoint} failed: ${res.status} ${text}`);
  }
  return res.json();
}

// ---- Signal Detection Logic ----

function detectDealSignals(deals, userId) {
  const signals = [];
  const now = new Date();

  // Group deals by stage
  const stageGroups = {};
  const stalledDeals = [];
  let totalValue = 0;
  let closedWonCount = 0;
  let totalDeals = 0;

  for (const deal of deals) {
    const props = deal.properties || {};
    totalDeals++;
    const stage = props.dealstage || "unknown";
    if (!stageGroups[stage]) stageGroups[stage] = [];
    stageGroups[stage].push(deal);

    const amount = parseFloat(props.amount) || 0;
    totalValue += amount;

    if (stage === "closedwon") closedWonCount++;

    // Check for stalled deals (no activity in 5+ days)
    const lastModified = props.hs_lastmodifieddate
      ? new Date(props.hs_lastmodifieddate)
      : null;
    if (
      lastModified &&
      stage !== "closedwon" &&
      stage !== "closedlost"
    ) {
      const daysSinceUpdate =
        (now.getTime() - lastModified.getTime()) / (1000 * 60 * 60 * 24);
      if (daysSinceUpdate > 5) {
        stalledDeals.push({ deal, daysSinceUpdate, amount });
      }
    }
  }

  // Signal: Stalled Deals
  if (stalledDeals.length > 0) {
    const totalAtRisk = stalledDeals.reduce((sum, d) => sum + d.amount, 0);
    signals.push({
      user_id: userId,
      signal_type: "stalled_deals",
      severity: stalledDeals.length >= 5 ? "high" : "medium",
      confidence: Math.min(95, 60 + stalledDeals.length * 5),
      description: `${stalledDeals.length} open deal(s) have not been updated in over 5 days. Combined pipeline value at risk: $${totalAtRisk.toLocaleString()}.`,
      source_integration: "hubspot",
      signal_data: JSON.stringify({
        stalled_count: stalledDeals.length,
        total_at_risk: totalAtRisk,
        deals: stalledDeals.slice(0, 10).map((d) => ({
          name: d.deal.properties.dealname,
          days_stalled: Math.round(d.daysSinceUpdate),
          amount: d.amount,
        })),
      }),
      detected_at: now.toISOString(),
      is_active: true,
    });
  }

  // Signal: Pipeline Slowdown (low close rate)
  if (totalDeals >= 5) {
    const closeRate = totalDeals > 0 ? (closedWonCount / totalDeals) * 100 : 0;
    if (closeRate < 20) {
      signals.push({
        user_id: userId,
        signal_type: "pipeline_slowdown",
        severity: closeRate < 10 ? "high" : "medium",
        confidence: Math.min(90, 50 + totalDeals * 2),
        description: `Pipeline close rate is ${closeRate.toFixed(1)}% (${closedWonCount} won out of ${totalDeals} deals). Deal progression may be slowing.`,
        source_integration: "hubspot",
        signal_data: JSON.stringify({
          close_rate: closeRate,
          total_deals: totalDeals,
          closed_won: closedWonCount,
          total_pipeline_value: totalValue,
          stages: Object.fromEntries(
            Object.entries(stageGroups).map(([k, v]) => [k, v.length])
          ),
        }),
        detected_at: now.toISOString(),
        is_active: true,
      });
    }
  }

  return signals;
}

function detectContactSignals(contacts, userId) {
  const signals = [];
  const now = new Date();

  // Check for recent contact surge (many contacts created recently)
  const recentContacts = contacts.filter((c) => {
    const created = c.properties?.createdate
      ? new Date(c.properties.createdate)
      : null;
    if (!created) return false;
    const daysSince =
      (now.getTime() - created.getTime()) / (1000 * 60 * 60 * 24);
    return daysSince <= 7;
  });

  if (recentContacts.length >= 10) {
    signals.push({
      user_id: userId,
      signal_type: "contact_surge",
      severity: recentContacts.length >= 25 ? "high" : "medium",
      confidence: Math.min(90, 55 + recentContacts.length),
      description: `${recentContacts.length} new contacts created in the past 7 days. This may indicate increased lead generation activity or a marketing campaign impact.`,
      source_integration: "hubspot",
      signal_data: JSON.stringify({
        new_contacts_7d: recentContacts.length,
        total_contacts: contacts.length,
      }),
      detected_at: now.toISOString(),
      is_active: true,
    });
  }

  return signals;
}

function detectCompanySignals(companies, userId) {
  const signals = [];
  const now = new Date();

  // Check for recently updated companies
  const recentlyUpdated = companies.filter((c) => {
    const updated = c.properties?.hs_lastmodifieddate
      ? new Date(c.properties.hs_lastmodifieddate)
      : null;
    if (!updated) return false;
    const daysSince =
      (now.getTime() - updated.getTime()) / (1000 * 60 * 60 * 24);
    return daysSince <= 3;
  });

  if (recentlyUpdated.length >= 5) {
    signals.push({
      user_id: userId,
      signal_type: "company_activity_spike",
      severity: "low",
      confidence: Math.min(80, 50 + recentlyUpdated.length * 3),
      description: `${recentlyUpdated.length} companies updated in the past 3 days. Increased CRM activity detected.`,
      source_integration: "hubspot",
      signal_data: JSON.stringify({
        updated_companies_3d: recentlyUpdated.length,
        total_companies: companies.length,
      }),
      detected_at: now.toISOString(),
      is_active: true,
    });
  }

  return signals;
}

// ---- Main Handler ----

exports.handler = async (event) => {
  const headers = {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
  };

  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 204, headers, body: "" };
  }

  if (event.httpMethod !== "POST") {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: "Method not allowed" }),
    };
  }

  try {
    const supabase = getSupabase();

    // Parse optional user_id filter
    let targetUserId = null;
    try {
      const body = JSON.parse(event.body || "{}");
      targetUserId = body.user_id || null;
    } catch {
      // ignore
    }

    // Fetch active HubSpot connections
    let query = supabase
      .from("hubspot_connections")
      .select("id, user_id, access_token, refresh_token, token_expires_at, user_integration_id, hubspot_portal_id");

    if (targetUserId) {
      query = query.eq("user_id", targetUserId);
    }

    const { data: connections, error: connError } = await query;

    if (connError) {
      console.error("[hubspot-poll] Error fetching connections:", connError);
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ error: "Failed to fetch HubSpot connections" }),
      };
    }

    if (!connections || connections.length === 0) {
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          message: "No active HubSpot connections to poll",
          polled: 0,
        }),
      };
    }

    console.log(
      `[hubspot-poll] Polling ${connections.length} HubSpot connection(s)`
    );

    const results = [];

    for (const conn of connections) {
      try {
        // Ensure token is fresh
        const accessToken = await ensureFreshToken(supabase, conn);

        // Mark as syncing
        await supabase
          .from("hubspot_connections")
          .update({ sync_status: "syncing", updated_at: new Date().toISOString() })
          .eq("id", conn.id);

        // Pull CRM data
        console.log(`[hubspot-poll] Fetching CRM data for user ${conn.user_id}`);

        const [contactsRes, dealsRes, companiesRes] = await Promise.all([
          hubspotGet(accessToken, "/crm/v3/objects/contacts", { limit: 100 }),
          hubspotGet(accessToken, "/crm/v3/objects/deals", {
            limit: 100,
            properties: "dealname,dealstage,amount,closedate,hs_lastmodifieddate,pipeline",
          }),
          hubspotGet(accessToken, "/crm/v3/objects/companies", {
            limit: 100,
            properties: "name,domain,industry,hs_lastmodifieddate",
          }),
        ]);

        const contacts = contactsRes.results || [];
        const deals = dealsRes.results || [];
        const companies = companiesRes.results || [];

        console.log(
          `[hubspot-poll] User ${conn.user_id}: ${contacts.length} contacts, ${deals.length} deals, ${companies.length} companies`
        );

        // Store raw events in integration_events for the signal detection engine
        const events = [];

        if (deals.length > 0) {
          events.push({
            user_id: conn.user_id,
            integration_id: conn.user_integration_id,
            event_type: "hubspot_deals_snapshot",
            event_data: JSON.stringify({
              deals: deals.map((d) => d.properties),
              total: deals.length,
              polled_at: new Date().toISOString(),
            }),
            created_at: new Date().toISOString(),
          });
        }

        if (contacts.length > 0) {
          events.push({
            user_id: conn.user_id,
            integration_id: conn.user_integration_id,
            event_type: "hubspot_contacts_snapshot",
            event_data: JSON.stringify({
              contacts: contacts.map((c) => c.properties),
              total: contacts.length,
              polled_at: new Date().toISOString(),
            }),
            created_at: new Date().toISOString(),
          });
        }

        if (companies.length > 0) {
          events.push({
            user_id: conn.user_id,
            integration_id: conn.user_integration_id,
            event_type: "hubspot_companies_snapshot",
            event_data: JSON.stringify({
              companies: companies.map((c) => c.properties),
              total: companies.length,
              polled_at: new Date().toISOString(),
            }),
            created_at: new Date().toISOString(),
          });
        }

        // Insert integration events
        if (events.length > 0) {
          const { error: evtError } = await supabase
            .from("integration_events")
            .insert(events);

          if (evtError) {
            console.warn(
              `[hubspot-poll] Failed to insert integration_events:`,
              evtError
            );
          }
        }

        // ---- Signal Detection (Part 5) ----
        // Deactivate previous HubSpot signals for this user
        await supabase
          .from("operational_signals")
          .update({ is_active: false })
          .eq("user_id", conn.user_id)
          .eq("source_integration", "hubspot");

        // Detect new signals
        const allSignals = [
          ...detectDealSignals(deals, conn.user_id),
          ...detectContactSignals(contacts, conn.user_id),
          ...detectCompanySignals(companies, conn.user_id),
        ];

        if (allSignals.length > 0) {
          const { error: sigError } = await supabase
            .from("operational_signals")
            .insert(allSignals);

          if (sigError) {
            console.warn(
              `[hubspot-poll] Failed to insert signals:`,
              sigError
            );
          } else {
            console.log(
              `[hubspot-poll] Inserted ${allSignals.length} signal(s) for user ${conn.user_id}`
            );
          }
        }

        // Update sync status
        await supabase
          .from("hubspot_connections")
          .update({
            sync_status: "success",
            sync_error: null,
            last_sync_at: new Date().toISOString(),
            contacts_synced: contacts.length,
            deals_synced: deals.length,
            companies_synced: companies.length,
            updated_at: new Date().toISOString(),
          })
          .eq("id", conn.id);

        // Update user_integrations last_verified_at
        if (conn.user_integration_id) {
          await supabase
            .from("user_integrations")
            .update({
              last_verified_at: new Date().toISOString(),
              error_message: null,
              consecutive_failures: 0,
              updated_at: new Date().toISOString(),
            })
            .eq("id", conn.user_integration_id);
        }

        results.push({
          user_id: conn.user_id,
          success: true,
          contacts: contacts.length,
          deals: deals.length,
          companies: companies.length,
          signals_detected: allSignals.length,
        });
      } catch (err) {
        console.error(
          `[hubspot-poll] Error polling for user ${conn.user_id}:`,
          err
        );

        // Update error status
        await supabase
          .from("hubspot_connections")
          .update({
            sync_status: "error",
            sync_error: err.message,
            updated_at: new Date().toISOString(),
          })
          .eq("id", conn.id);

        if (conn.user_integration_id) {
          await supabase
            .from("user_integrations")
            .update({
              error_message: err.message,
              last_error_at: new Date().toISOString(),
              consecutive_failures: (conn.consecutive_failures || 0) + 1,
              updated_at: new Date().toISOString(),
            })
            .eq("id", conn.user_integration_id);
        }

        results.push({
          user_id: conn.user_id,
          success: false,
          error: err.message,
        });
      }
    }

    const successCount = results.filter((r) => r.success).length;
    const failCount = results.filter((r) => !r.success).length;

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        message: `Polled ${successCount} connection(s), ${failCount} failed`,
        polled: successCount,
        failed: failCount,
        results,
      }),
    };
  } catch (err) {
    console.error("[hubspot-poll] Unexpected error:", err);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: "Internal server error" }),
    };
  }
};
