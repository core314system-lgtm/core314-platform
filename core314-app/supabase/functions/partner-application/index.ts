/**
 * Partner Application Edge Function - PRODUCTION SYSTEM
 * 
 * Implements the full automated partner program intake:
 * 1. Validates all required fields
 * 2. Automated scoring (0-25 scale across 5 criteria)
 * 3. Red-flag keyword detection (auto-reject)
 * 4. Decision engine (auto-approve, auto-reject, escalate)
 * 5. Creates immutable application record with full audit trail
 * 6. Sends appropriate emails based on decision
 * 7. For auto-approvals: creates Partner Registry entry
 * 
 * Decision Rules (NON-NEGOTIABLE):
 * - If ANY score = 0 → REJECT
 * - If ANY red-flag detected → REJECT
 * - If score ≥ 18 and no 0s → AUTO-APPROVE
 * - If score 15–17 → ESCALATE
 * - Else → REJECT
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const SENDGRID_API_KEY = Deno.env.get('SENDGRID_API_KEY') || '';
const SENDGRID_SENDER_EMAIL = Deno.env.get('SENDGRID_SENDER_EMAIL') || 'noreply@core314.com';
const SENDGRID_SENDER_NAME = Deno.env.get('SENDGRID_SENDER_NAME') || 'Core314';
const PARTNER_ADMIN_EMAIL = Deno.env.get('PARTNER_ADMIN_EMAIL') || 'support@core314.com';

// =============================================================================
// RED-FLAG KEYWORDS (ANY = IMMEDIATE REJECT)
// =============================================================================

const RED_FLAG_KEYWORDS = [
  'affiliate', 'traffic', 'seo', 'audience', 'coupon', 'promo', 'influencer',
  'passive income', 'fast payout', 'volume', 'commission', 'referral link',
  'click', 'impression', 'monetize', 'viral', 'follower', 'subscriber',
];

// =============================================================================
// SCORING CRITERIA
// =============================================================================

interface ScoringResult {
  score_partner_role: number;
  score_client_relationship: number;
  score_icp_alignment: number;
  score_positioning_quality: number;
  score_program_intent: number;
  total_score: number;
  red_flag_detected: boolean;
  red_flag_keywords: string[];
}

const HIGH_VALUE_ROLES = ['cto', 'coo', 'cio', 'vp', 'director', 'partner', 'principal', 'managing', 'fractional', 'chief'];
const MEDIUM_VALUE_ROLES = ['consultant', 'advisor', 'architect', 'lead', 'senior', 'manager'];
const HIGH_VALUE_INDUSTRIES = ['healthcare', 'financial', 'fintech', 'govtech', 'government', 'enterprise', 'manufacturing', 'logistics', 'regulated'];
const MEDIUM_VALUE_INDUSTRIES = ['technology', 'saas', 'professional services', 'consulting', 'legal', 'insurance'];
const STRONG_POSITIONING_KEYWORDS = ['decision', 'intelligence', 'operational', 'visibility', 'insight', 'leadership', 'executive', 'strategic', 'complexity', 'integration'];
const WEAK_POSITIONING_KEYWORDS = ['tool', 'software', 'app', 'dashboard', 'report', 'analytics'];

function detectRedFlags(text: string): string[] {
  const lowerText = text.toLowerCase();
  return RED_FLAG_KEYWORDS.filter(keyword => lowerText.includes(keyword.toLowerCase()));
}

function scorePartnerRole(roleTitle: string, firmType: string): number {
  const lowerRole = roleTitle.toLowerCase();
  const lowerFirmType = firmType.toLowerCase();
  const hasHighValueRole = HIGH_VALUE_ROLES.some(r => lowerRole.includes(r));
  const hasMediumValueRole = MEDIUM_VALUE_ROLES.some(r => lowerRole.includes(r));
  const isAdvisorOrIntegrator = ['advisor', 'integrator'].includes(lowerFirmType);
  if (hasHighValueRole && isAdvisorOrIntegrator) return 5;
  if (hasHighValueRole) return 4;
  if (hasMediumValueRole && isAdvisorOrIntegrator) return 4;
  if (hasMediumValueRole) return 3;
  if (isAdvisorOrIntegrator) return 2;
  return 1;
}

function scoreClientRelationship(howAdvises: string, yearsExperience: number): number {
  const lowerText = howAdvises.toLowerCase();
  const depthIndicators = ['strategic', 'long-term', 'embedded', 'ongoing', 'retained', 'trusted', 'advisory board', 'executive'];
  const depthCount = depthIndicators.filter(i => lowerText.includes(i)).length;
  const experienceBonus = yearsExperience >= 10 ? 1 : yearsExperience >= 5 ? 0.5 : 0;
  const lengthBonus = howAdvises.length > 300 ? 0.5 : 0;
  const baseScore = Math.min(depthCount * 1.5, 4);
  return Math.min(Math.round(baseScore + experienceBonus + lengthBonus), 5);
}

function scoreICPAlignment(industry: string, clientProfile: string): number {
  const lowerIndustry = industry.toLowerCase();
  const lowerProfile = (clientProfile || '').toLowerCase();
  const hasHighValueIndustry = HIGH_VALUE_INDUSTRIES.some(i => lowerIndustry.includes(i) || lowerProfile.includes(i));
  const hasMediumValueIndustry = MEDIUM_VALUE_INDUSTRIES.some(i => lowerIndustry.includes(i) || lowerProfile.includes(i));
  const enterpriseIndicators = ['enterprise', 'large', 'complex', 'regulated', 'compliance', 'scale', 'multi'];
  const enterpriseCount = enterpriseIndicators.filter(i => lowerProfile.includes(i)).length;
  if (hasHighValueIndustry && enterpriseCount >= 2) return 5;
  if (hasHighValueIndustry) return 4;
  if (hasMediumValueIndustry && enterpriseCount >= 1) return 4;
  if (hasMediumValueIndustry) return 3;
  if (enterpriseCount >= 1) return 2;
  return 1;
}

function scorePositioningQuality(howIntroduce: string, howFits: string): number {
  const combinedText = `${howIntroduce || ''} ${howFits}`.toLowerCase();
  const strongCount = STRONG_POSITIONING_KEYWORDS.filter(k => combinedText.includes(k)).length;
  const weakCount = WEAK_POSITIONING_KEYWORDS.filter(k => combinedText.includes(k)).length;
  const totalLength = (howIntroduce || '').length + howFits.length;
  const lengthBonus = totalLength > 400 ? 1 : totalLength > 200 ? 0.5 : 0;
  const weakPenalty = weakCount > strongCount ? -1 : 0;
  const baseScore = Math.min(strongCount * 1.2, 4);
  return Math.max(1, Math.min(Math.round(baseScore + lengthBonus + weakPenalty), 5));
}

function scoreProgramIntent(
  notInfluencer: boolean, willNotMisrepresent: boolean, understandsDecisionIntelligence: boolean,
  notAffiliate: boolean, agreesRules: boolean, howFits: string
): number {
  if (!notInfluencer || !willNotMisrepresent || !understandsDecisionIntelligence) return 0;
  let score = 3;
  if (notAffiliate) score += 1;
  if (agreesRules) score += 1;
  const lowerFits = howFits.toLowerCase();
  const genuineIndicators = ['client', 'help', 'value', 'solve', 'improve', 'support'];
  const genuineCount = genuineIndicators.filter(i => lowerFits.includes(i)).length;
  if (genuineCount >= 3) score = Math.min(score + 1, 5);
  return Math.min(score, 5);
}

function calculateScores(input: PartnerApplicationInput): ScoringResult {
  const allText = [input.full_name, input.company, input.role_title, input.primary_industry,
    input.how_advises_orgs, input.how_core314_fits, input.typical_client_profile || '',
    input.how_introduce_core314 || ''].join(' ');
  const redFlagKeywords = detectRedFlags(allText);
  const scores = {
    score_partner_role: scorePartnerRole(input.role_title, input.firm_type || 'other'),
    score_client_relationship: scoreClientRelationship(input.how_advises_orgs, input.years_experience),
    score_icp_alignment: scoreICPAlignment(input.primary_industry, input.typical_client_profile || ''),
    score_positioning_quality: scorePositioningQuality(input.how_introduce_core314 || '', input.how_core314_fits),
    score_program_intent: scoreProgramIntent(input.not_influencer_marketer, input.will_not_misrepresent_ai,
      input.understands_decision_intelligence, input.understands_not_affiliate || false,
      input.agrees_rules_of_engagement || false, input.how_core314_fits),
    red_flag_detected: redFlagKeywords.length > 0,
    red_flag_keywords: redFlagKeywords,
    total_score: 0,
  };
  scores.total_score = scores.score_partner_role + scores.score_client_relationship +
    scores.score_icp_alignment + scores.score_positioning_quality + scores.score_program_intent;
  return scores;
}

// =============================================================================
// DECISION ENGINE
// =============================================================================

type DecisionType = 'auto_approved' | 'auto_rejected' | 'escalated';
interface DecisionResult { decision: DecisionType; reason: string; status: 'approved' | 'rejected' | 'escalated'; }

function makeDecision(scores: ScoringResult): DecisionResult {
  if (scores.red_flag_detected) {
    return { decision: 'auto_rejected', reason: `Red-flag keywords detected: ${scores.red_flag_keywords.join(', ')}`, status: 'rejected' };
  }
  const allScores = [scores.score_partner_role, scores.score_client_relationship, scores.score_icp_alignment,
    scores.score_positioning_quality, scores.score_program_intent];
  if (allScores.some(s => s === 0)) {
    const zeroCategories: string[] = [];
    if (scores.score_partner_role === 0) zeroCategories.push('partner_role');
    if (scores.score_client_relationship === 0) zeroCategories.push('client_relationship');
    if (scores.score_icp_alignment === 0) zeroCategories.push('icp_alignment');
    if (scores.score_positioning_quality === 0) zeroCategories.push('positioning_quality');
    if (scores.score_program_intent === 0) zeroCategories.push('program_intent');
    return { decision: 'auto_rejected', reason: `Zero score in categories: ${zeroCategories.join(', ')}`, status: 'rejected' };
  }
  if (scores.total_score >= 18) {
    return { decision: 'auto_approved', reason: `High score (${scores.total_score}/25) with no disqualifying factors`, status: 'approved' };
  }
  if (scores.total_score >= 15 && scores.total_score <= 17) {
    return { decision: 'escalated', reason: `Borderline score (${scores.total_score}/25) requires human review`, status: 'escalated' };
  }
  return { decision: 'auto_rejected', reason: `Score too low (${scores.total_score}/25) - minimum 15 required`, status: 'rejected' };
}

// =============================================================================
// EMAIL TEMPLATES
// =============================================================================

const APPLICANT_CONFIRMATION_HTML = `<!DOCTYPE html><html><body style="font-family: -apple-system, sans-serif; background: #f8fafc; padding: 40px;">
<div style="max-width: 600px; margin: 0 auto; background: white; border-radius: 8px; padding: 40px;">
<h1 style="color: #0f172a;">Core314 Partner Program</h1>
<h2>Application Received</h2>
<p>Thank you for your interest in the Core314 Partner Program.</p>
<p>Your application has been received and is being processed. You will receive a follow-up email with the outcome within 5 business days.</p>
<p style="color: #64748b; font-size: 14px;">This is an automated confirmation.</p>
</div></body></html>`;

const APPLICANT_CONFIRMATION_TEXT = `Core314 Partner Application Received

Thank you for your interest. Your application is being processed. You will hear back within 5 business days.`;

const APPLICANT_APPROVED_HTML = (name: string, partnerId: string) => `<!DOCTYPE html><html><body style="font-family: -apple-system, sans-serif; background: #f8fafc; padding: 40px;">
<div style="max-width: 600px; margin: 0 auto; background: white; border-radius: 8px; padding: 40px;">
<h1 style="color: #0f172a;">Core314 Partner Program</h1>
<h2 style="color: #059669;">Welcome to the Partner Program</h2>
<p>Dear ${name},</p>
<p>Your application has been <strong>approved</strong>.</p>
<div style="background: #f0fdf4; padding: 16px; border-radius: 8px; margin: 20px 0;">
<p style="margin: 0; color: #166534;"><strong>Your Partner ID:</strong></p>
<p style="margin: 8px 0 0 0; font-size: 24px; font-family: monospace; color: #166534;">${partnerId}</p>
</div>
<h3>Partner Economics</h3>
<ul><li>Revenue Share: 25% recurring</li><li>Attribution: Lifetime (no caps, no expiration)</li><li>Expansion Revenue: Included</li><li>Clawbacks: None</li></ul>
<h3>Next Steps</h3>
<p>You will receive the Partner Agreement for e-signature. Once signed, you will receive your enablement package.</p>
</div></body></html>`;

const APPLICANT_APPROVED_TEXT = (name: string, partnerId: string) => `Welcome to the Core314 Partner Program

Dear ${name},

Your application has been APPROVED.

Your Partner ID: ${partnerId}

Partner Economics:
- Revenue Share: 25% recurring
- Attribution: Lifetime
- Expansion Revenue: Included
- Clawbacks: None

You will receive the Partner Agreement for e-signature shortly.`;

const APPLICANT_REJECTED_HTML = (name: string) => `<!DOCTYPE html><html><body style="font-family: -apple-system, sans-serif; background: #f8fafc; padding: 40px;">
<div style="max-width: 600px; margin: 0 auto; background: white; border-radius: 8px; padding: 40px;">
<h1 style="color: #0f172a;">Core314 Partner Program</h1>
<h2>Application Update</h2>
<p>Dear ${name},</p>
<p>Thank you for your interest in the Core314 Partner Program.</p>
<p>After reviewing your application, we have determined that the program is not the right fit at this time.</p>
<p>You may reapply after 6 months if your circumstances change.</p>
</div></body></html>`;

const APPLICANT_REJECTED_TEXT = (name: string) => `Core314 Partner Application Update

Dear ${name},

After reviewing your application, we have determined that the program is not the right fit at this time.

You may reapply after 6 months.`;

const ADMIN_NOTIFICATION_HTML = (app: Record<string, unknown>, scores: ScoringResult, decision: DecisionResult) => `<!DOCTYPE html><html><body style="font-family: -apple-system, sans-serif; background: #f8fafc; padding: 40px;">
<div style="max-width: 600px; margin: 0 auto; background: white; border-radius: 8px; padding: 40px;">
<h1>Partner Application: ${decision.decision.replace('_', ' ').toUpperCase()}</h1>
<p style="color: ${decision.status === 'approved' ? '#059669' : decision.status === 'escalated' ? '#d97706' : '#dc2626'}; font-weight: bold;">
${decision.status === 'approved' ? 'AUTO-APPROVED' : decision.status === 'escalated' ? 'REQUIRES HUMAN REVIEW' : 'AUTO-REJECTED'}</p>
<table><tr><td>Name:</td><td>${app.full_name}</td></tr><tr><td>Email:</td><td>${app.email}</td></tr><tr><td>Company:</td><td>${app.company}</td></tr><tr><td>Role:</td><td>${app.role_title}</td></tr><tr><td>Firm Type:</td><td>${app.firm_type || 'N/A'}</td></tr></table>
<h3>Scoring (Total: ${scores.total_score}/25)</h3>
<ul><li>Partner Role: ${scores.score_partner_role}/5</li><li>Client Relationship: ${scores.score_client_relationship}/5</li><li>ICP Alignment: ${scores.score_icp_alignment}/5</li><li>Positioning: ${scores.score_positioning_quality}/5</li><li>Program Intent: ${scores.score_program_intent}/5</li></ul>
${scores.red_flag_detected ? `<p style="color: red;">RED FLAGS: ${scores.red_flag_keywords.join(', ')}</p>` : ''}
<p><strong>Decision:</strong> ${decision.reason}</p>
${decision.status === 'escalated' ? '<p style="background: #fef3c7; padding: 12px; border-radius: 4px;"><strong>ACTION REQUIRED:</strong> Review within 5 business days</p>' : ''}
<p style="color: #64748b; font-size: 12px;">Application ID: ${app.id}</p>
</div></body></html>`;

const ADMIN_NOTIFICATION_TEXT = (app: Record<string, unknown>, scores: ScoringResult, decision: DecisionResult) =>
`Partner Application: ${decision.decision.replace('_', ' ').toUpperCase()}

Name: ${app.full_name}
Email: ${app.email}
Company: ${app.company}
Role: ${app.role_title}

Scoring (Total: ${scores.total_score}/25):
- Partner Role: ${scores.score_partner_role}/5
- Client Relationship: ${scores.score_client_relationship}/5
- ICP Alignment: ${scores.score_icp_alignment}/5
- Positioning: ${scores.score_positioning_quality}/5
- Program Intent: ${scores.score_program_intent}/5
${scores.red_flag_detected ? `RED FLAGS: ${scores.red_flag_keywords.join(', ')}` : ''}

Decision: ${decision.reason}

Application ID: ${app.id}`;

// =============================================================================
// EMAIL SENDING
// =============================================================================

async function sendEmail(to: string, subject: string, html: string, text: string): Promise<{ success: boolean; error?: string }> {
  if (!SENDGRID_API_KEY) {
    console.error('SENDGRID_API_KEY not configured');
    return { success: false, error: 'Email service not configured' };
  }
  try {
    const response = await fetch('https://api.sendgrid.com/v3/mail/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${SENDGRID_API_KEY}` },
      body: JSON.stringify({
        personalizations: [{ to: [{ email: to }] }],
        from: { email: SENDGRID_SENDER_EMAIL, name: SENDGRID_SENDER_NAME },
        subject,
        content: [{ type: 'text/plain', value: text }, { type: 'text/html', value: html }],
      }),
    });
    if (response.ok) return { success: true };
    const errorText = await response.text();
    console.error('SendGrid error:', errorText);
    return { success: false, error: errorText };
  } catch (error) {
    console.error('SendGrid request failed:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

// =============================================================================
// VALIDATION
// =============================================================================

interface PartnerApplicationInput {
  full_name: string; email: string; company: string; role_title: string;
  years_experience: number; primary_industry: string; how_advises_orgs: string;
  how_core314_fits: string; not_influencer_marketer: boolean; will_not_misrepresent_ai: boolean;
  understands_decision_intelligence: boolean; ack_not_agent: boolean; ack_no_misrepresent: boolean;
  ack_no_entitlement: boolean; firm_type?: string; typical_client_profile?: string;
  tooling_decision_frequency?: string; how_introduce_core314?: string;
  understands_not_affiliate?: boolean; agrees_rules_of_engagement?: boolean;
}

function validateApplication(input: Partial<PartnerApplicationInput>): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  if (!input.full_name?.trim()) errors.push('Full name is required');
  if (!input.email?.trim()) errors.push('Email is required');
  if (!input.company?.trim()) errors.push('Company is required');
  if (!input.role_title?.trim()) errors.push('Role/title is required');
  if (!input.primary_industry?.trim()) errors.push('Primary industry is required');
  if (!input.how_advises_orgs?.trim()) errors.push('Description of advisory work is required');
  if (!input.how_core314_fits?.trim()) errors.push('Description of how Core314 fits is required');
  if (!input.firm_type?.trim()) errors.push('Firm type is required');
  if (!input.typical_client_profile?.trim()) errors.push('Typical client profile is required');
  if (!input.tooling_decision_frequency?.trim()) errors.push('Tooling decision frequency is required');
  if (!input.how_introduce_core314?.trim()) errors.push('How you would introduce Core314 is required');
  if (input.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.email)) errors.push('Invalid email format');
  if (input.years_experience === undefined || input.years_experience === null) errors.push('Years of experience is required');
  else if (typeof input.years_experience !== 'number' || input.years_experience < 0) errors.push('Years of experience must be non-negative');
  if (input.not_influencer_marketer !== true) errors.push('You must confirm you are not an influencer/marketer');
  if (input.will_not_misrepresent_ai !== true) errors.push('You must confirm you will not misrepresent AI capabilities');
  if (input.understands_decision_intelligence !== true) errors.push('You must confirm you understand decision intelligence');
  if (input.understands_not_affiliate !== true) errors.push('You must confirm this is NOT an affiliate program');
  if (input.agrees_rules_of_engagement !== true) errors.push('You must agree to Rules of Engagement');
  if (input.ack_not_agent !== true) errors.push('You must acknowledge you are not an agent of Core314');
  if (input.ack_no_misrepresent !== true) errors.push('You must agree not to misrepresent Core314');
  if (input.ack_no_entitlement !== true) errors.push('You must acknowledge no partnership entitlement');
  return { valid: errors.length === 0, errors };
}

function generatePartnerId(): string {
  const year = new Date().getFullYear();
  const random = Math.floor(Math.random() * 9000) + 1000;
  return `P-${year}-${random}`;
}

// =============================================================================
// MAIN HANDLER
// =============================================================================

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }),
      { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }

  try {
    const body = await req.json();
    const validation = validateApplication(body);
    if (!validation.valid) {
      return new Response(JSON.stringify({ error: 'Validation failed', details: validation.errors }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const supabase = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '');

    // Check reapplication cooldown (6 months after rejection)
    const { data: existingApps } = await supabase.from('partner_applications')
      .select('id, status, reapplication_allowed_after')
      .eq('email', body.email.trim().toLowerCase())
      .order('created_at', { ascending: false }).limit(1);

    if (existingApps?.length && existingApps[0].status === 'rejected' && existingApps[0].reapplication_allowed_after) {
      const cooldownEnd = new Date(existingApps[0].reapplication_allowed_after);
      if (new Date() < cooldownEnd) {
        return new Response(JSON.stringify({ error: 'Reapplication not allowed yet', details: [`You may reapply after ${cooldownEnd.toISOString().split('T')[0]}`] }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
    }

    // Calculate scores and make decision
    const scores = calculateScores(body as PartnerApplicationInput);
    const decision = makeDecision(scores);
    
    const ipAddress = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || req.headers.get('x-real-ip') || 'unknown';
    const userAgent = req.headers.get('user-agent') || 'unknown';
    const reapplicationDate = decision.status === 'rejected' ? new Date(Date.now() + 180 * 24 * 60 * 60 * 1000).toISOString() : null;
    const escalationDeadline = decision.status === 'escalated' ? new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString() : null;

    // Insert application with scores and decision
    const { data: application, error: insertError } = await supabase.from('partner_applications').insert({
      full_name: body.full_name.trim(), email: body.email.trim().toLowerCase(), company: body.company.trim(),
      role_title: body.role_title.trim(), years_experience: body.years_experience, primary_industry: body.primary_industry.trim(),
      how_advises_orgs: body.how_advises_orgs.trim(), how_core314_fits: body.how_core314_fits.trim(),
      not_influencer_marketer: body.not_influencer_marketer, will_not_misrepresent_ai: body.will_not_misrepresent_ai,
      understands_decision_intelligence: body.understands_decision_intelligence, ack_not_agent: body.ack_not_agent,
      ack_no_misrepresent: body.ack_no_misrepresent, ack_no_entitlement: body.ack_no_entitlement,
      firm_type: body.firm_type?.trim() || null, typical_client_profile: body.typical_client_profile?.trim() || null,
      tooling_decision_frequency: body.tooling_decision_frequency?.trim() || null,
      how_introduce_core314: body.how_introduce_core314?.trim() || null,
      understands_not_affiliate: body.understands_not_affiliate || false,
      agrees_rules_of_engagement: body.agrees_rules_of_engagement || false,
      score_partner_role: scores.score_partner_role, score_client_relationship: scores.score_client_relationship,
      score_icp_alignment: scores.score_icp_alignment, score_positioning_quality: scores.score_positioning_quality,
      score_program_intent: scores.score_program_intent, total_score: scores.total_score,
      red_flag_detected: scores.red_flag_detected, red_flag_keywords: scores.red_flag_keywords,
      status: decision.status, decision_type: decision.decision, decision_reason: decision.reason,
      decision_timestamp: new Date().toISOString(), decision_actor: 'system',
      escalated_at: decision.status === 'escalated' ? new Date().toISOString() : null,
      escalation_sla_deadline: escalationDeadline, reapplication_allowed_after: reapplicationDate,
      ip_address: ipAddress, user_agent: userAgent,
    }).select().single();

    if (insertError) {
      console.error('Failed to insert application:', insertError);
      return new Response(JSON.stringify({ error: 'Failed to submit application', details: insertError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Audit log - application submitted
    await supabase.from('partner_audit_log').insert({
      entity_type: 'application', entity_id: application.id, action: 'application_submitted',
      actor_type: 'system', actor_id: 'system',
      inputs: { email: body.email, company: body.company, firm_type: body.firm_type },
      outputs: { scores, decision }, decision: decision.decision, reason: decision.reason,
    });

    let partnerId: string | null = null;

    // For auto-approvals, create partner registry entry
    if (decision.status === 'approved') {
      partnerId = generatePartnerId();
      const { error: registryError } = await supabase.from('partner_registry').insert({
        partner_id: partnerId, legal_name: body.company.trim(),
        partner_type: body.firm_type?.trim() || 'consultant',
        primary_contact_name: body.full_name.trim(),
        primary_contact_email: body.email.trim().toLowerCase(),
        application_id: application.id, status: 'pending_agreement',
      });
      if (registryError) console.error('Failed to create partner registry:', registryError);
      else {
        await supabase.from('partner_audit_log').insert({
          entity_type: 'registry', entity_id: application.id, action: 'partner_created',
          actor_type: 'system', actor_id: 'system',
          inputs: { application_id: application.id }, outputs: { partner_id: partnerId },
          decision: 'Partner registry entry created from auto-approved application',
        });
      }
    }

    // Send emails based on decision
    await sendEmail(body.email.trim().toLowerCase(), 'Core314 Partner Application Received', APPLICANT_CONFIRMATION_HTML, APPLICANT_CONFIRMATION_TEXT);
    if (decision.status === 'approved' && partnerId) {
      await sendEmail(body.email.trim().toLowerCase(), 'Welcome to the Core314 Partner Program', APPLICANT_APPROVED_HTML(body.full_name, partnerId), APPLICANT_APPROVED_TEXT(body.full_name, partnerId));
    } else if (decision.status === 'rejected') {
      await sendEmail(body.email.trim().toLowerCase(), 'Core314 Partner Application Update', APPLICANT_REJECTED_HTML(body.full_name), APPLICANT_REJECTED_TEXT(body.full_name));
    }
    await sendEmail(PARTNER_ADMIN_EMAIL, `Partner Application ${decision.decision.replace('_', ' ').toUpperCase()}: ${body.full_name} (${body.company})`,
      ADMIN_NOTIFICATION_HTML(application, scores, decision), ADMIN_NOTIFICATION_TEXT(application, scores, decision));

    return new Response(JSON.stringify({
      success: true,
      message: decision.status === 'approved' ? 'Application approved! Check your email for next steps.'
        : decision.status === 'escalated' ? 'Application submitted and under review. You will hear back within 5 business days.'
        : 'Application submitted successfully.',
      application_id: application.id, status: decision.status, partner_id: partnerId,
    }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (error) {
    console.error('Partner application error:', error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
