/**
 * Deal Registration Edge Function - PRODUCTION SYSTEM
 * 
 * Implements Part 8 of the Partner Program:
 * - Validates Partner ID exists and is active
 * - Registers customer deals with lifetime attribution
 * - Enforces one-partner-per-customer rule
 * - First approved registration wins
 * - Creates immutable audit trail
 * 
 * Required fields:
 * - partner_id (validated against partner_registry)
 * - customer_legal_name
 * - customer_domain
 * - intro_date
 * - relationship_type
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

interface DealRegistrationInput {
  partner_id: string;
  customer_legal_name: string;
  customer_domain: string;
  intro_date: string;
  relationship_type: 'new_business' | 'expansion' | 'renewal';
  notes?: string;
}

function validateDealRegistration(input: Partial<DealRegistrationInput>): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  
  if (!input.partner_id?.trim()) errors.push('Partner ID is required');
  else if (!/^P-\d{4}-\d{4}$/.test(input.partner_id.trim())) errors.push('Invalid Partner ID format (expected P-YYYY-XXXX)');
  
  if (!input.customer_legal_name?.trim()) errors.push('Customer legal name is required');
  if (!input.customer_domain?.trim()) errors.push('Customer domain is required');
  else if (!/^[a-zA-Z0-9][a-zA-Z0-9-]*\.[a-zA-Z]{2,}$/.test(input.customer_domain.trim())) {
    errors.push('Invalid domain format');
  }
  
  if (!input.intro_date?.trim()) errors.push('Introduction date is required');
  else {
    const introDate = new Date(input.intro_date);
    if (isNaN(introDate.getTime())) errors.push('Invalid introduction date format');
    else if (introDate > new Date()) errors.push('Introduction date cannot be in the future');
  }
  
  if (!input.relationship_type) errors.push('Relationship type is required');
  else if (!['new_business', 'expansion', 'renewal'].includes(input.relationship_type)) {
    errors.push('Invalid relationship type');
  }
  
  return { valid: errors.length === 0, errors };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }),
      { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }

  try {
    const body = await req.json();
    const validation = validateDealRegistration(body);
    if (!validation.valid) {
      return new Response(JSON.stringify({ error: 'Validation failed', details: validation.errors }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const supabase = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '');

    // Validate Partner ID exists and is active
    const { data: partner, error: partnerError } = await supabase
      .from('partner_registry')
      .select('id, partner_id, status, legal_name')
      .eq('partner_id', body.partner_id.trim())
      .single();

    if (partnerError || !partner) {
      return new Response(JSON.stringify({ error: 'Invalid Partner ID', details: ['Partner ID not found in registry'] }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    if (partner.status !== 'active') {
      return new Response(JSON.stringify({ error: 'Partner not active', details: [`Partner status is ${partner.status}. Only active partners can register deals.`] }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Check if customer domain is already registered (one partner per customer)
    const normalizedDomain = body.customer_domain.trim().toLowerCase();
    const { data: existingDeal } = await supabase
      .from('partner_deal_registrations')
      .select('id, partner_id, status')
      .eq('customer_domain', normalizedDomain)
      .eq('status', 'approved')
      .single();

    if (existingDeal) {
      return new Response(JSON.stringify({ 
        error: 'Customer already registered', 
        details: [`This customer domain is already registered to partner ${existingDeal.partner_id}. One partner per customer rule applies.`] 
      }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Check for pending registration for same domain by same partner
    const { data: pendingDeal } = await supabase
      .from('partner_deal_registrations')
      .select('id')
      .eq('customer_domain', normalizedDomain)
      .eq('partner_id', body.partner_id.trim())
      .eq('status', 'pending')
      .single();

    if (pendingDeal) {
      return new Response(JSON.stringify({ 
        error: 'Duplicate registration', 
        details: ['You already have a pending registration for this customer domain.'] 
      }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Create deal registration
    const { data: deal, error: insertError } = await supabase
      .from('partner_deal_registrations')
      .insert({
        partner_id: body.partner_id.trim(),
        customer_legal_name: body.customer_legal_name.trim(),
        customer_domain: normalizedDomain,
        intro_date: body.intro_date,
        relationship_type: body.relationship_type,
        notes: body.notes?.trim() || null,
        status: 'approved', // Auto-approve if partner is active and no conflicts
        approved_at: new Date().toISOString(),
        attribution_locked: true, // Lock attribution for life
      })
      .select()
      .single();

    if (insertError) {
      console.error('Failed to create deal registration:', insertError);
      return new Response(JSON.stringify({ error: 'Failed to register deal', details: insertError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Audit log
    await supabase.from('partner_audit_log').insert({
      entity_type: 'deal_registration',
      entity_id: deal.id,
      action: 'deal_registered',
      actor_type: 'partner',
      actor_id: body.partner_id.trim(),
      inputs: { customer_domain: normalizedDomain, relationship_type: body.relationship_type },
      outputs: { deal_id: deal.id, status: 'approved' },
      decision: 'Deal auto-approved - partner active, no conflicts',
      reason: 'First registration for this customer domain',
    });

    return new Response(JSON.stringify({
      success: true,
      message: 'Deal registered successfully. Attribution is locked for the lifetime of this customer account.',
      deal_id: deal.id,
      partner_id: body.partner_id.trim(),
      customer_domain: normalizedDomain,
      status: 'approved',
      attribution_locked: true,
    }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (error) {
    console.error('Deal registration error:', error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
