-- ============================================================================
-- Procuvex production baseline schema (public)
--
-- Authoritative snapshot of the PRODUCTION 'public' schema, generated with:
--   pg_dump --schema-only --schema=public --no-owner
-- against project psmicdfnvgwsjkhkwoub on 2026-07-08.
--
-- WHY THIS EXISTS: the foundational tables (organizations, user_profiles,
-- master_subcontractors, organization_members, company_profile, sow_quotes,
-- etc.) were created directly in the database and are NOT produced by any file
-- in supabase/migrations/. A fresh database therefore CANNOT be rebuilt from
-- the migrations alone. This file captures the complete current schema so the
-- environment is reproducible from version control (verified: the procuvex-
-- staging project was rebuilt from this exact dump).
--
-- Rebuild a fresh environment:
--   1) psql <target> -f supabase/baseline/prod_public_schema.sql
--   2) recreate the auth trigger (lives in the auth schema, not public):
--        CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users
--          FOR EACH ROW EXECUTE FUNCTION handle_new_user();
--   3) apply any migrations dated AFTER this snapshot.
--
-- Schema-only: contains NO data and NO secrets.
-- ============================================================================

--
-- PostgreSQL database dump
--

\restrict mt9036VhR3iwsN6bBO8ksXOkK5f2oU8JZ9qlnHgDXBYUB7Tc1n8NqTg5ZNbTxzO

-- Dumped from database version 17.6
-- Dumped by pg_dump version 17.10 (Ubuntu 17.10-1.pgdg22.04+1)

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: public; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA public;


--
-- Name: SCHEMA public; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON SCHEMA public IS 'standard public schema';


--
-- Name: archive_no_email_records(integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.archive_no_email_records(batch_limit integer DEFAULT 20000) RETURNS integer
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
  affected INT;
BEGIN
  WITH to_archive AS (
    SELECT id FROM master_subcontractors
    WHERE (contact_email IS NULL OR contact_email = '')
      AND archived = false
    LIMIT batch_limit
  )
  UPDATE master_subcontractors
  SET archived = true,
      archived_at = NOW(),
      archive_reason = 'no_email_address'
  FROM to_archive
  WHERE master_subcontractors.id = to_archive.id;
  
  GET DIAGNOSTICS affected = ROW_COUNT;
  RETURN affected;
END;
$$;


--
-- Name: check_search_rate_limit(uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.check_search_rate_limit(p_user_id uuid, p_org_id uuid) RETURNS boolean
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
  v_plan TEXT; v_is_admin BOOLEAN; v_daily_count INTEGER; v_limit INTEGER; v_day_start TIMESTAMPTZ;
BEGIN
  SELECT COALESCE(is_global_admin, false) INTO v_is_admin FROM user_profiles WHERE id = p_user_id;
  IF v_is_admin THEN RETURN true; END IF;

  v_plan := get_org_plan(p_org_id);
  IF v_plan LIKE '%enterprise%' OR v_plan LIKE '%agentic%' THEN v_limit := 200;
  ELSIF v_plan LIKE '%growth%' THEN v_limit := 50;
  ELSE v_limit := 15; END IF;

  v_day_start := date_trunc('day', now());
  SELECT COUNT(*) INTO v_daily_count FROM sub_access_log
  WHERE user_id = p_user_id AND action_type IN ('search', 'page_browse') AND created_at >= v_day_start;

  RETURN v_daily_count < v_limit;
END;
$$;


--
-- Name: enforce_connection_limit(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.enforce_connection_limit() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
  v_plan TEXT; v_status TEXT; v_is_admin BOOLEAN;
  v_monthly_count INTEGER; v_limit INTEGER; v_month_start TIMESTAMPTZ;
BEGIN
  SELECT COALESCE(is_global_admin, false) INTO v_is_admin FROM user_profiles WHERE id = NEW.user_id;
  IF v_is_admin THEN RETURN NEW; END IF;

  v_plan := get_org_plan(NEW.org_id);
  v_status := get_org_status(NEW.org_id);

  IF v_plan LIKE '%enterprise%' OR v_plan LIKE '%agentic%' THEN v_limit := 100;
  ELSIF v_plan LIKE '%growth%' THEN v_limit := 25;
  ELSE v_limit := 10; END IF;

  IF v_status NOT IN ('active', 'trialing') THEN
    RAISE EXCEPTION 'Subscription inactive. Please renew to connect with subcontractors.' USING ERRCODE = 'P0001';
  END IF;

  v_month_start := date_trunc('month', now());
  SELECT COUNT(*) INTO v_monthly_count FROM sub_connections WHERE org_id = NEW.org_id AND created_at >= v_month_start;

  IF v_monthly_count >= v_limit THEN
    RAISE EXCEPTION 'Monthly connection limit reached (% of %). Upgrade your plan.', v_monthly_count, v_limit USING ERRCODE = 'P0001';
  END IF;

  INSERT INTO sub_access_log (user_id, org_id, action_type, metadata)
  VALUES (NEW.user_id, NEW.org_id, 'connect', jsonb_build_object('sub_id', NEW.sub_id));

  RETURN NEW;
END;
$$;


--
-- Name: ensure_user_org(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.ensure_user_org() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
  new_org_id UUID;
  invite_record RECORD;
BEGIN
  IF EXISTS (SELECT 1 FROM organization_members WHERE user_id = NEW.id) THEN
    RETURN NEW;
  END IF;

  SELECT id, org_id, role INTO invite_record
    FROM org_invitations
    WHERE email = NEW.email
      AND status = 'pending'
      AND expires_at > now()
    ORDER BY created_at DESC
    LIMIT 1;

  IF invite_record.id IS NOT NULL THEN
    INSERT INTO organization_members (org_id, user_id, role)
    VALUES (invite_record.org_id, NEW.id, invite_record.role);

    UPDATE user_profiles SET current_org_id = invite_record.org_id WHERE id = NEW.id;

    UPDATE org_invitations
    SET status = 'accepted', accepted_at = now()
    WHERE id = invite_record.id;
  ELSE
    INSERT INTO organizations (name, slug)
    VALUES (
      COALESCE(NEW.full_name, split_part(NEW.email, '@', 1)) || '''s Organization',
      'org-' || substr(gen_random_uuid()::text, 1, 8)
    )
    RETURNING id INTO new_org_id;

    INSERT INTO organization_members (org_id, user_id, role)
    VALUES (new_org_id, NEW.id, 'owner');

    UPDATE user_profiles SET current_org_id = new_org_id WHERE id = NEW.id;
  END IF;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'ensure_user_org failed for user %: %', NEW.id, SQLERRM;
  RETURN NEW;
END;
$$;


--
-- Name: freeze_connections_on_churn(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.freeze_connections_on_churn() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
BEGIN
  IF NEW.subscription_status IN ('cancelled', 'past_due') AND OLD.subscription_status IN ('active', 'trialing') THEN
    UPDATE sub_connections SET frozen = true WHERE org_id = NEW.id;
  END IF;
  IF NEW.subscription_status IN ('active', 'trialing') AND OLD.subscription_status IN ('cancelled', 'past_due') THEN
    UPDATE sub_connections SET frozen = false WHERE org_id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$;


--
-- Name: get_org_plan(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_org_plan(target_org_id uuid) RETURNS text
    LANGUAGE sql STABLE SECURITY DEFINER
    AS $$
  SELECT COALESCE(subscription_plan, 'no_subscription') FROM organizations WHERE id = target_org_id;
$$;


--
-- Name: get_org_status(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_org_status(target_org_id uuid) RETURNS text
    LANGUAGE sql STABLE SECURITY DEFINER
    AS $$
  SELECT COALESCE(subscription_status, 'no_subscription') FROM organizations WHERE id = target_org_id;
$$;


--
-- Name: get_sub_search_limit(uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_sub_search_limit(p_user_id uuid, p_org_id uuid) RETURNS integer
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    AS $$
DECLARE v_plan TEXT; v_status TEXT; v_is_admin BOOLEAN;
BEGIN
  SELECT COALESCE(is_global_admin, false) INTO v_is_admin FROM user_profiles WHERE id = p_user_id;
  IF v_is_admin THEN RETURN 10000; END IF;

  v_plan := get_org_plan(p_org_id);
  v_status := get_org_status(p_org_id);

  IF v_status NOT IN ('active', 'trialing') THEN RETURN 0; END IF;

  IF v_plan LIKE '%enterprise%' OR v_plan LIKE '%agentic%' THEN RETURN 500;
  ELSIF v_plan LIKE '%growth%' THEN RETURN 100;
  ELSIF v_status = 'trialing' THEN RETURN 5;
  ELSE RETURN 0; END IF;
END;
$$;


--
-- Name: get_user_org_ids(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_user_org_ids(uid uuid) RETURNS SETOF uuid
    LANGUAGE sql STABLE SECURITY DEFINER
    AS $$
  SELECT org_id FROM organization_members WHERE user_id = uid;
$$;


--
-- Name: handle_new_user(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.handle_new_user() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
begin
  insert into public.user_profiles (id, email, full_name, role)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', ''),
    'admin'
  );
  return new;
end;
$$;


--
-- Name: increment_master_sub_field(uuid, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.increment_master_sub_field(row_id uuid, field_name text) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    AS $_$
BEGIN
  EXECUTE format('UPDATE master_subcontractors SET %I = COALESCE(%I, 0) + 1 WHERE id = $1', field_name, field_name)
  USING row_id;
END;
$_$;


--
-- Name: increment_match_count(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.increment_match_count(sub_id uuid) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
BEGIN
  UPDATE master_subcontractors
  SET match_count = COALESCE(match_count, 0) + 1
  WHERE id = sub_id;
END;
$$;


--
-- Name: is_connected_to_sub(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.is_connected_to_sub(p_sub_id uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    AS $$
  SELECT EXISTS (
    SELECT 1 FROM sub_connections sc
    JOIN user_profiles up ON up.current_org_id = sc.org_id
    WHERE sc.sub_id = p_sub_id
    AND up.id = auth.uid()
    AND sc.frozen = false
  );
$$;


--
-- Name: is_global_admin(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.is_global_admin() RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    AS $$
  SELECT COALESCE(
    (SELECT is_global_admin FROM user_profiles WHERE id = auth.uid()),
    false
  );
$$;


--
-- Name: purge_auth_user_by_email(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.purge_auth_user_by_email(target_email text) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
BEGIN
  DELETE FROM auth.users WHERE email = target_email;
END;
$$;


--
-- Name: shares_org_with(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.shares_org_with(target_user uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    AS $$
  SELECT EXISTS (
    SELECT 1 FROM organization_members a
    JOIN organization_members b ON a.org_id = b.org_id
    WHERE a.user_id = auth.uid() AND b.user_id = target_user
  );
$$;


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: account_usage; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.account_usage (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    org_id uuid NOT NULL,
    action_type text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: agent_actions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.agent_actions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    org_id uuid NOT NULL,
    project_id uuid,
    agent_type text NOT NULL,
    action_type text NOT NULL,
    status text DEFAULT 'pending_approval'::text NOT NULL,
    title text NOT NULL,
    description text,
    payload jsonb DEFAULT '{}'::jsonb,
    context jsonb DEFAULT '{}'::jsonb,
    assigned_to uuid,
    created_at timestamp with time zone DEFAULT now(),
    approved_at timestamp with time zone,
    executed_at timestamp with time zone,
    expires_at timestamp with time zone,
    resolved_by uuid
);


--
-- Name: agent_settings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.agent_settings (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    org_id uuid NOT NULL,
    project_id uuid,
    agent_type text NOT NULL,
    autonomy_level text DEFAULT 'advisor'::text NOT NULL,
    enabled boolean DEFAULT false,
    primary_contact_id uuid,
    config jsonb DEFAULT '{}'::jsonb,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: ai_audit_log; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ai_audit_log (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id text NOT NULL,
    org_id text,
    request_type text NOT NULL,
    model text NOT NULL,
    prompt_tokens integer DEFAULT 0,
    completion_tokens integer DEFAULT 0,
    total_tokens integer DEFAULT 0,
    task_order_id uuid,
    task_order_title text,
    document_context text,
    response_summary text,
    latency_ms integer DEFAULT 0,
    status text DEFAULT 'success'::text NOT NULL,
    error_message text,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: audit_events; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.audit_events (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid,
    org_id uuid,
    action text NOT NULL,
    resource_type text,
    resource_id text,
    metadata jsonb DEFAULT '{}'::jsonb,
    ip_address text,
    user_agent text,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: beta_feedback; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.beta_feedback (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    week_number integer NOT NULL,
    responses jsonb DEFAULT '{}'::jsonb NOT NULL,
    submitted_at timestamp with time zone DEFAULT now(),
    CONSTRAINT beta_feedback_week_number_check CHECK (((week_number >= 1) AND (week_number <= 4)))
);


--
-- Name: beta_invitations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.beta_invitations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    email text NOT NULL,
    token text NOT NULL,
    status text DEFAULT 'pending'::text NOT NULL,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now(),
    claimed_at timestamp with time zone,
    expires_at timestamp with time zone,
    notes text,
    agreed_at timestamp with time zone,
    applicant_name text,
    CONSTRAINT beta_invitations_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'applied'::text, 'accepted'::text, 'declined'::text, 'expired'::text, 'revoked'::text])))
);


--
-- Name: capture_gates; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.capture_gates (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    task_order_id uuid NOT NULL,
    gate_number integer NOT NULL,
    gate_name text NOT NULL,
    status text DEFAULT 'not_started'::text NOT NULL,
    scheduled_date date,
    completed_date date,
    decision text,
    decision_rationale text,
    checklist jsonb DEFAULT '[]'::jsonb,
    reviewers text[] DEFAULT '{}'::text[],
    approved_by text,
    notes text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: color_team_reviews; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.color_team_reviews (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    task_order_id uuid NOT NULL,
    review_type text NOT NULL,
    status text DEFAULT 'scheduled'::text NOT NULL,
    scheduled_date date,
    completed_date date,
    lead_reviewer text,
    reviewers text[] DEFAULT '{}'::text[],
    overall_rating text,
    findings jsonb DEFAULT '[]'::jsonb,
    action_items jsonb DEFAULT '[]'::jsonb,
    summary text,
    notes text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: contacts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.contacts (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    org_id uuid,
    first_name text NOT NULL,
    last_name text NOT NULL,
    email text,
    phone text,
    title text,
    organization text,
    contact_type text DEFAULT 'other'::text NOT NULL,
    agency text,
    notes text,
    tags text[] DEFAULT '{}'::text[],
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: contract_vehicles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.contract_vehicles (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    org_id uuid NOT NULL,
    vehicle_name text NOT NULL,
    vehicle_type text NOT NULL,
    contract_number text,
    ordering_period_start date,
    ordering_period_end date,
    ceiling_value numeric,
    naics_codes text[] DEFAULT '{}'::text[],
    sin_numbers text[] DEFAULT '{}'::text[],
    scope_description text,
    contracting_agency text,
    status text DEFAULT 'active'::text NOT NULL,
    renewal_date date,
    notes text,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: contracts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.contracts (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    title text NOT NULL,
    contract_number text,
    contract_type text DEFAULT 'idiq'::text NOT NULL,
    status text DEFAULT 'active'::text NOT NULL,
    vehicle text,
    agency text,
    contracting_officer text,
    co_email text,
    co_phone text,
    period_of_performance_start date,
    period_of_performance_end date,
    ceiling_value numeric,
    funded_value numeric,
    naics_code text,
    set_aside text,
    description text,
    org_id uuid NOT NULL,
    created_by uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT contracts_contract_type_check CHECK ((contract_type = ANY (ARRAY['idiq'::text, 'bpa'::text, 'gwac'::text, 'gsa_schedule'::text, 'prime'::text, 'subcontract'::text, 'msa'::text, 'other'::text]))),
    CONSTRAINT contracts_status_check CHECK ((status = ANY (ARRAY['active'::text, 'pending'::text, 'expired'::text, 'closed'::text])))
);


--
-- Name: cpars_ratings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.cpars_ratings (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    org_id uuid,
    contract_title text NOT NULL,
    contract_number text,
    agency text,
    period text,
    quality integer,
    schedule integer,
    cost_control integer,
    management integer,
    small_business integer,
    overall numeric(2,1),
    narrative_summary text,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT cpars_ratings_cost_control_check CHECK (((cost_control >= 1) AND (cost_control <= 5))),
    CONSTRAINT cpars_ratings_management_check CHECK (((management >= 1) AND (management <= 5))),
    CONSTRAINT cpars_ratings_quality_check CHECK (((quality >= 1) AND (quality <= 5))),
    CONSTRAINT cpars_ratings_schedule_check CHECK (((schedule >= 1) AND (schedule <= 5))),
    CONSTRAINT cpars_ratings_small_business_check CHECK (((small_business >= 1) AND (small_business <= 5)))
);


--
-- Name: database_hygiene_log; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.database_hygiene_log (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    master_sub_id text,
    email text,
    action text NOT NULL,
    reason text,
    performed_at timestamp with time zone DEFAULT now() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: documents; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.documents (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    task_order_id uuid NOT NULL,
    file_name text NOT NULL,
    file_path text NOT NULL,
    file_size bigint DEFAULT 0 NOT NULL,
    file_type text,
    category text DEFAULT 'other'::text NOT NULL,
    version integer DEFAULT 1 NOT NULL,
    uploaded_by uuid,
    uploaded_at timestamp with time zone DEFAULT now() NOT NULL,
    org_id uuid,
    sow_item_id uuid,
    CONSTRAINT documents_category_check CHECK ((category = ANY (ARRAY['sow'::text, 'pricing_sheet'::text, 'exhibit'::text, 'amendment'::text, 'qa_response'::text, 'wage_determination'::text, 'site_info'::text, 'subcontractor_quote'::text, 'internal_notes'::text, 'other'::text])))
);


--
-- Name: email_delivery_log; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.email_delivery_log (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    org_id uuid,
    email_type text NOT NULL,
    recipient_email text NOT NULL,
    sendgrid_message_id text,
    status text DEFAULT 'sent'::text,
    bounce_reason text,
    created_at timestamp with time zone DEFAULT now(),
    delivered_at timestamp with time zone,
    bounced_at timestamp with time zone
);


--
-- Name: email_suppression_list; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.email_suppression_list (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    email text NOT NULL,
    reason text NOT NULL,
    suppressed_at timestamp with time zone DEFAULT now() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: email_tracking; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.email_tracking (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    rfq_token_id uuid,
    sow_subcontractor_id uuid,
    sendgrid_message_id text,
    event_type text NOT NULL,
    email_to text,
    email_subject text,
    "timestamp" timestamp with time zone DEFAULT now() NOT NULL,
    metadata jsonb,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT email_tracking_event_type_check CHECK ((event_type = ANY (ARRAY['sent'::text, 'delivered'::text, 'opened'::text, 'clicked'::text, 'bounced'::text, 'deferred'::text, 'dropped'::text, 'spam_report'::text, 'unsubscribe'::text])))
);


--
-- Name: gate_templates; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.gate_templates (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    org_id uuid NOT NULL,
    template_name text DEFAULT 'Default'::text NOT NULL,
    gates jsonb DEFAULT '[]'::jsonb NOT NULL,
    is_default boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: key_personnel; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.key_personnel (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    org_id uuid NOT NULL,
    full_name text NOT NULL,
    email text,
    phone text,
    labor_category_id uuid,
    title text,
    years_experience integer,
    education text,
    certifications text[] DEFAULT '{}'::text[],
    clearance_level text,
    clearance_expiry date,
    availability text DEFAULT 'available'::text,
    resume_path text,
    bio text,
    skills text[] DEFAULT '{}'::text[],
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: labor_categories; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.labor_categories (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    org_id uuid NOT NULL,
    category_name text NOT NULL,
    labor_category_code text,
    description text,
    min_years_experience integer,
    education_requirement text,
    certifications text[] DEFAULT '{}'::text[],
    clearance_required text,
    hourly_rate_min numeric,
    hourly_rate_max numeric,
    annual_salary_min numeric,
    annual_salary_max numeric,
    notes text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: master_sub_certifications; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.master_sub_certifications (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    master_sub_id uuid NOT NULL,
    cert_type text NOT NULL,
    cert_name text NOT NULL,
    issuing_authority text,
    cert_number text,
    effective_date date,
    expiration_date date,
    coverage_amount numeric,
    document_path text,
    ai_verified boolean DEFAULT false,
    ai_verification_notes text,
    created_at timestamp with time zone DEFAULT now(),
    reminder_sent_at timestamp with time zone,
    file_url text,
    uploaded_at timestamp with time zone DEFAULT now(),
    CONSTRAINT master_sub_certifications_cert_type_check CHECK ((cert_type = ANY (ARRAY['license'::text, 'insurance'::text, 'certification'::text, 'w9'::text, 'capability_statement'::text, 'bond'::text, 'other'::text])))
);


--
-- Name: master_sub_contact_log; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.master_sub_contact_log (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    master_sub_id uuid NOT NULL,
    event_type text NOT NULL,
    metadata jsonb DEFAULT '{}'::jsonb,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT master_sub_contact_log_event_type_check CHECK ((event_type = ANY (ARRAY['claim_email_sent'::text, 'claim_email_opened'::text, 'claim_email_clicked'::text, 'profile_claimed'::text, 'profile_viewed'::text, 'profile_updated'::text, 'verification_started'::text, 'verification_completed'::text, 'verification_expired'::text, 'matched_to_project'::text, 'rfq_received'::text, 'rfq_responded'::text])))
);


--
-- Name: master_subcontractors; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.master_subcontractors (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    company_name text NOT NULL,
    slug text NOT NULL,
    dba_name text,
    contact_name text,
    contact_email text,
    contact_phone text,
    website text,
    address_line1 text,
    address_line2 text,
    city text,
    state text,
    zip_code text,
    country text DEFAULT 'US'::text,
    description text,
    sam_uei text,
    cage_code text,
    naics_codes text[] DEFAULT '{}'::text[],
    psc_codes text[] DEFAULT '{}'::text[],
    sam_registration_status text,
    sam_registration_date date,
    sam_expiration_date date,
    entity_type text,
    service_categories text[] DEFAULT '{}'::text[],
    trade_categories text[] DEFAULT '{}'::text[],
    geographic_coverage text[] DEFAULT '{}'::text[],
    service_radius_miles integer,
    small_business boolean DEFAULT false,
    small_business_types text[] DEFAULT '{}'::text[],
    verification_status text DEFAULT 'unverified'::text,
    claimed_by uuid,
    claimed_at timestamp with time zone,
    claim_token text,
    verified_at timestamp with time zone,
    verification_expires_at timestamp with time zone,
    stripe_subscription_id text,
    profile_completeness integer DEFAULT 0,
    logo_url text,
    capability_statement_path text,
    data_source text DEFAULT 'sam_gov'::text,
    source_id text,
    match_count integer DEFAULT 0,
    view_count integer DEFAULT 0,
    last_matched_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    claim_token_expires_at timestamp with time zone,
    claimed_by_user_id uuid,
    outreach_sent_at timestamp with time zone,
    outreach_email_count integer DEFAULT 0,
    last_outreach_email_at timestamp with time zone,
    profile_updated_at timestamp with time zone,
    stripe_customer_id text,
    stripe_checkout_session_id text,
    verified_by uuid,
    capability_narrative text,
    unsubscribed boolean DEFAULT false,
    unsubscribed_at timestamp with time zone,
    data_health_score integer DEFAULT 50 NOT NULL,
    archived boolean DEFAULT false NOT NULL,
    archived_at timestamp with time zone,
    archive_reason text,
    soft_bounce_count integer DEFAULT 0 NOT NULL,
    last_bounce_at timestamp with time zone,
    last_engagement_at timestamp with time zone,
    email_verified_at timestamp with time zone,
    domain_checked_at timestamp with time zone,
    engagement_open_count integer DEFAULT 0 NOT NULL,
    engagement_click_count integer DEFAULT 0 NOT NULL,
    external_id text,
    confirmed_at timestamp with time zone,
    CONSTRAINT master_subcontractors_data_source_check CHECK ((data_source = ANY (ARRAY['sam_gov'::text, 'manual'::text, 'import'::text, 'self_register'::text, 'gsa_elibrary'::text, 'texas_hub'::text, 'texas_cmbl'::text, 'state_dbe'::text]))),
    CONSTRAINT master_subcontractors_profile_completeness_check CHECK (((profile_completeness >= 0) AND (profile_completeness <= 100))),
    CONSTRAINT master_subcontractors_verification_status_check CHECK ((verification_status = ANY (ARRAY['unverified'::text, 'claimed'::text, 'pending_verification'::text, 'verified'::text, 'expired'::text])))
);


--
-- Name: master_subcontractors_safe; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.master_subcontractors_safe AS
 SELECT id,
    company_name,
    dba_name,
    slug,
    contact_name,
        CASE
            WHEN (public.is_global_admin() OR public.is_connected_to_sub(id)) THEN contact_email
            ELSE
            CASE
                WHEN (contact_email IS NOT NULL) THEN (("left"(contact_email, 1) || '***@'::text) || split_part(contact_email, '@'::text, 2))
                ELSE NULL::text
            END
        END AS contact_email,
        CASE
            WHEN (public.is_global_admin() OR public.is_connected_to_sub(id)) THEN contact_phone
            ELSE
            CASE
                WHEN (contact_phone IS NOT NULL) THEN ('(***) ***-'::text || "right"(regexp_replace(contact_phone, '[^0-9]'::text, ''::text, 'g'::text), 4))
                ELSE NULL::text
            END
        END AS contact_phone,
    city,
    state,
    zip_code,
    address_line1,
    trade_categories,
    naics_codes,
    small_business,
    small_business_types,
    geographic_coverage,
    website,
    sam_uei,
    cage_code,
    verification_status,
    profile_completeness,
    data_health_score,
    description,
    capability_statement_path,
    archived,
    unsubscribed,
    created_at,
    updated_at,
    claimed_by_user_id,
    claimed_at,
    claim_token,
    claim_token_expires_at,
    outreach_sent_at,
    outreach_email_count,
    last_outreach_email_at,
    profile_updated_at
   FROM public.master_subcontractors;


--
-- Name: notification_preferences; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.notification_preferences (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    org_id uuid NOT NULL,
    project_id uuid,
    agent_type text DEFAULT 'all'::text NOT NULL,
    channel text DEFAULT 'both'::text NOT NULL,
    enabled boolean DEFAULT true
);


--
-- Name: notifications; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.notifications (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    org_id uuid NOT NULL,
    type text DEFAULT 'system'::text NOT NULL,
    title text NOT NULL,
    message text DEFAULT ''::text,
    link text,
    read boolean DEFAULT false,
    metadata jsonb DEFAULT '{}'::jsonb,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: opportunity_questions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.opportunity_questions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    task_order_id uuid NOT NULL,
    sow_subcontractor_id uuid,
    subcontractor_id uuid,
    submitted_by_type text DEFAULT 'subcontractor'::text NOT NULL,
    submitted_by_user_id uuid,
    question_text text NOT NULL,
    related_section text,
    ai_answer text,
    ai_confidence_score numeric(5,2),
    ai_source_references jsonb DEFAULT '[]'::jsonb,
    official_answer text,
    official_source_document_id uuid,
    status text DEFAULT 'pending_review'::text NOT NULL,
    question_category text,
    is_from_portal boolean DEFAULT false NOT NULL,
    rfq_token_id uuid,
    submission_id uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    answered_at timestamp with time zone,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT opportunity_questions_ai_confidence_score_check CHECK (((ai_confidence_score >= (0)::numeric) AND (ai_confidence_score <= (100)::numeric))),
    CONSTRAINT opportunity_questions_status_check CHECK ((status = ANY (ARRAY['auto_answered'::text, 'pending_review'::text, 'pending_submission'::text, 'submitted'::text, 'answered'::text, 'unanswerable'::text, 'dismissed'::text]))),
    CONSTRAINT opportunity_questions_submitted_by_type_check CHECK ((submitted_by_type = ANY (ARRAY['subcontractor'::text, 'prime_team'::text])))
);


--
-- Name: org_email_domains; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.org_email_domains (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    org_id uuid NOT NULL,
    domain text NOT NULL,
    from_name text DEFAULT 'Notifications'::text NOT NULL,
    from_email text NOT NULL,
    reply_to_email text,
    status text DEFAULT 'pending'::text NOT NULL,
    spf_record text,
    spf_verified boolean DEFAULT false,
    dkim_selector text,
    dkim_record text,
    dkim_verified boolean DEFAULT false,
    mx_record text,
    mx_verified boolean DEFAULT false,
    tracking_cname text,
    tracking_verified boolean DEFAULT false,
    logo_url text,
    brand_color text DEFAULT '#4F46E5'::text,
    footer_text text,
    mailgun_domain_id text,
    provider text DEFAULT 'mailgun'::text NOT NULL,
    verified_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    created_by uuid,
    CONSTRAINT org_email_domains_provider_check CHECK ((provider = ANY (ARRAY['mailgun'::text, 'ses'::text, 'sendgrid'::text]))),
    CONSTRAINT org_email_domains_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'verifying'::text, 'verified'::text, 'failed'::text])))
);


--
-- Name: org_invitations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.org_invitations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    org_id uuid NOT NULL,
    email text NOT NULL,
    role text DEFAULT 'member'::text NOT NULL,
    token text NOT NULL,
    invited_by uuid NOT NULL,
    status text DEFAULT 'pending'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    expires_at timestamp with time zone DEFAULT (now() + '7 days'::interval),
    accepted_at timestamp with time zone,
    CONSTRAINT org_invitations_role_check CHECK ((role = ANY (ARRAY['admin'::text, 'member'::text, 'viewer'::text]))),
    CONSTRAINT org_invitations_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'accepted'::text, 'expired'::text, 'cancelled'::text])))
);


--
-- Name: org_sso_providers; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.org_sso_providers (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    org_id uuid NOT NULL,
    provider_id text NOT NULL,
    domains text[] DEFAULT '{}'::text[] NOT NULL,
    metadata_url text,
    status text DEFAULT 'active'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: organization_members; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.organization_members (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    org_id uuid NOT NULL,
    user_id uuid NOT NULL,
    role text DEFAULT 'member'::text NOT NULL,
    invited_by uuid,
    joined_at timestamp with time zone DEFAULT now(),
    CONSTRAINT organization_members_role_check CHECK ((role = ANY (ARRAY['owner'::text, 'admin'::text, 'member'::text, 'viewer'::text])))
);


--
-- Name: organization_settings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.organization_settings (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    org_id uuid,
    slack_webhook_url text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: organizations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.organizations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    slug text NOT NULL,
    logo_url text,
    settings jsonb DEFAULT '{}'::jsonb,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    subscription_status text DEFAULT 'no_subscription'::text,
    subscription_plan text,
    stripe_subscription_id text,
    stripe_customer_id text,
    trial_ends_at timestamp with time zone,
    subscription_ends_at timestamp with time zone,
    email_branding_enabled boolean DEFAULT false,
    default_email_domain_id uuid
);


--
-- Name: partner_payouts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.partner_payouts (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    partner_id uuid NOT NULL,
    month text NOT NULL,
    amount numeric(10,2) NOT NULL,
    status text DEFAULT 'pending'::text NOT NULL,
    paid_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT partner_payouts_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'paid'::text])))
);


--
-- Name: past_performance_citations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.past_performance_citations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    org_id uuid NOT NULL,
    contract_title text NOT NULL,
    contract_number text,
    agency text,
    client_name text,
    contract_type text,
    naics_code text,
    set_aside text,
    contract_value numeric,
    period_of_performance_start date,
    period_of_performance_end date,
    relevance_tags text[] DEFAULT '{}'::text[],
    service_categories text[] DEFAULT '{}'::text[],
    description text,
    our_role text,
    key_personnel text[] DEFAULT '{}'::text[],
    cpars_rating text,
    past_performance_narrative text,
    lessons_learned text,
    reusable_content jsonb DEFAULT '{}'::jsonb,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: portal_quote_submissions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.portal_quote_submissions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    rfq_token_id uuid NOT NULL,
    sow_quote_id uuid,
    custom_fields jsonb DEFAULT '{}'::jsonb NOT NULL,
    submitted_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: project_assignments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.project_assignments (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    task_order_id uuid NOT NULL,
    user_id uuid NOT NULL,
    role text DEFAULT 'contributor'::text NOT NULL,
    assigned_by uuid,
    assigned_at timestamp with time zone DEFAULT now(),
    is_primary_contact boolean DEFAULT false,
    CONSTRAINT project_assignments_role_check CHECK ((role = ANY (ARRAY['lead'::text, 'contributor'::text, 'reviewer'::text, 'observer'::text])))
);


--
-- Name: project_comments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.project_comments (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    project_id uuid,
    org_id uuid,
    user_id uuid NOT NULL,
    user_name text,
    content text NOT NULL,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: project_contacts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.project_contacts (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    project_id uuid,
    contact_id uuid,
    role text,
    is_primary boolean DEFAULT false,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: project_key_personnel; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.project_key_personnel (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    task_order_id uuid NOT NULL,
    personnel_id uuid NOT NULL,
    proposed_role text,
    labor_category_id uuid,
    allocation_percent integer DEFAULT 100,
    notes text,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: project_past_performance; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.project_past_performance (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    task_order_id uuid NOT NULL,
    citation_id uuid NOT NULL,
    relevance_score integer DEFAULT 0,
    relevance_notes text,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: project_subcontractors; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.project_subcontractors (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    task_order_id uuid NOT NULL,
    subcontractor_id uuid NOT NULL,
    match_score integer DEFAULT 0,
    relevance_reason text,
    matched_requirements text[] DEFAULT '{}'::text[],
    status text DEFAULT 'matched'::text,
    source text DEFAULT 'ai_match'::text,
    added_by uuid,
    notes text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    org_id uuid,
    CONSTRAINT project_subcontractors_match_score_check CHECK (((match_score >= 0) AND (match_score <= 100))),
    CONSTRAINT project_subcontractors_source_check CHECK ((source = ANY (ARRAY['ai_match'::text, 'auto_discover'::text, 'manual'::text, 'sow_tracker'::text]))),
    CONSTRAINT project_subcontractors_status_check CHECK ((status = ANY (ARRAY['matched'::text, 'shortlisted'::text, 'invited'::text, 'quoted'::text, 'awarded'::text, 'rejected'::text, 'removed'::text])))
);


--
-- Name: project_tasks; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.project_tasks (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    project_id uuid,
    org_id uuid,
    title text NOT NULL,
    assigned_to text,
    status text DEFAULT 'todo'::text NOT NULL,
    priority text DEFAULT 'medium'::text NOT NULL,
    due_date date,
    created_by uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: question_answer_history; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.question_answer_history (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    opportunity_question_id uuid,
    task_order_id uuid,
    question_category text,
    question_pattern text NOT NULL,
    answer_pattern text,
    opportunity_type text,
    agency text,
    was_auto_answered boolean DEFAULT false NOT NULL,
    confidence_score numeric(5,2),
    source_document_type text,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: question_submissions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.question_submissions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    task_order_id uuid NOT NULL,
    submission_deadline timestamp with time zone NOT NULL,
    submitted_at timestamp with time zone,
    submitted_by uuid,
    question_count integer DEFAULT 0 NOT NULL,
    status text DEFAULT 'draft'::text NOT NULL,
    response_received_at timestamp with time zone,
    response_document_id uuid,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT question_submissions_status_check CHECK ((status = ANY (ARRAY['draft'::text, 'submitted'::text, 'response_received'::text, 'closed'::text])))
);


--
-- Name: quote_form_fields; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.quote_form_fields (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    template_id uuid NOT NULL,
    field_name text NOT NULL,
    field_label text NOT NULL,
    field_type text NOT NULL,
    is_required boolean DEFAULT false NOT NULL,
    help_text text,
    placeholder text,
    options jsonb,
    display_order integer DEFAULT 0 NOT NULL,
    is_default_field boolean DEFAULT false NOT NULL,
    default_field_key text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT quote_form_fields_field_type_check CHECK ((field_type = ANY (ARRAY['text'::text, 'number'::text, 'currency'::text, 'textarea'::text, 'select'::text, 'file'::text, 'date'::text, 'checkbox'::text, 'email'::text, 'phone'::text])))
);


--
-- Name: quote_form_templates; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.quote_form_templates (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    description text,
    task_order_id uuid,
    sow_item_id uuid,
    is_default boolean DEFAULT false NOT NULL,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: referral_partners; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.referral_partners (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    email text NOT NULL,
    company text,
    audience_size text,
    promotion_method text,
    referral_code text NOT NULL,
    magic_token text NOT NULL,
    commission_rate numeric(4,2) DEFAULT 0.20 NOT NULL,
    commission_months integer DEFAULT 12 NOT NULL,
    status text DEFAULT 'pending'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    approved_at timestamp with time zone,
    updated_at timestamp with time zone DEFAULT now(),
    token_expires_at timestamp with time zone,
    CONSTRAINT referral_partners_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'active'::text, 'rejected'::text, 'suspended'::text])))
);


--
-- Name: referral_signups; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.referral_signups (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    partner_id uuid NOT NULL,
    user_email text NOT NULL,
    company_name text,
    plan_name text,
    stripe_subscription_id text,
    subscription_status text DEFAULT 'trial'::text NOT NULL,
    subscription_started_at timestamp with time zone,
    subscription_cancelled_at timestamp with time zone,
    monthly_amount numeric(10,2) DEFAULT 0,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT referral_signups_subscription_status_check CHECK ((subscription_status = ANY (ARRAY['trial'::text, 'active'::text, 'cancelled'::text, 'past_due'::text])))
);


--
-- Name: rfq_tokens; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.rfq_tokens (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    token text NOT NULL,
    sow_subcontractor_id uuid NOT NULL,
    sow_item_id uuid NOT NULL,
    task_order_id uuid NOT NULL,
    subcontractor_id uuid NOT NULL,
    expires_at timestamp with time zone NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: sb_subcontracting_plans; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.sb_subcontracting_plans (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    task_order_id uuid NOT NULL,
    total_subcontracting_dollars numeric,
    sb_goal_percent numeric DEFAULT 23,
    sb_goal_dollars numeric,
    sdb_goal_percent numeric DEFAULT 5,
    sdb_goal_dollars numeric,
    wosb_goal_percent numeric DEFAULT 5,
    wosb_goal_dollars numeric,
    hubzone_goal_percent numeric DEFAULT 3,
    hubzone_goal_dollars numeric,
    sdvosb_goal_percent numeric DEFAULT 3,
    sdvosb_goal_dollars numeric,
    planned_subcontractors jsonb DEFAULT '[]'::jsonb,
    plan_narrative text,
    good_faith_efforts text,
    administrator_name text,
    administrator_title text,
    administrator_email text,
    status text DEFAULT 'draft'::text,
    generated_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: sow_communications; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.sow_communications (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    sow_subcontractor_id uuid NOT NULL,
    comm_type text NOT NULL,
    direction text NOT NULL,
    subject text,
    body text,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT sow_communications_comm_type_check CHECK ((comm_type = ANY (ARRAY['rfq_sent'::text, 'question'::text, 'response'::text, 'follow_up'::text, 'quote_received'::text, 'clarification'::text, 'award_notice'::text, 'decline_notice'::text, 'note'::text]))),
    CONSTRAINT sow_communications_direction_check CHECK ((direction = ANY (ARRAY['outbound'::text, 'inbound'::text, 'internal'::text])))
);


--
-- Name: sow_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.sow_items (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    task_order_id uuid NOT NULL,
    sow_name text NOT NULL,
    service_category text NOT NULL,
    description text,
    source_document text,
    status text DEFAULT 'not_started'::text NOT NULL,
    awarded_subcontractor_id uuid,
    awarded_amount numeric(12,2),
    notes text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT sow_items_status_check CHECK ((status = ANY (ARRAY['not_started'::text, 'subs_identified'::text, 'rfqs_sent'::text, 'quotes_received'::text, 'evaluating'::text, 'awarded'::text])))
);


--
-- Name: sow_quotes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.sow_quotes (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    sow_subcontractor_id uuid NOT NULL,
    sow_item_id uuid NOT NULL,
    subcontractor_id uuid NOT NULL,
    total_amount numeric(12,2),
    monthly_amount numeric(12,2),
    annual_amount numeric(12,2),
    labor_cost numeric(12,2),
    materials_cost numeric(12,2),
    equipment_cost numeric(12,2),
    overhead_markup numeric(5,2),
    scope_inclusions text,
    scope_exclusions text,
    assumptions text,
    timeline text,
    payment_terms text,
    validity_period text,
    attachment_path text,
    status text DEFAULT 'received'::text NOT NULL,
    reviewer_notes text,
    submitted_at timestamp with time zone DEFAULT now(),
    reviewed_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now(),
    ai_compliance_score integer,
    ai_compliance_analysis jsonb,
    ai_analyzed_at timestamp with time zone,
    is_revision boolean DEFAULT false,
    CONSTRAINT sow_quotes_status_check CHECK ((status = ANY (ARRAY['received'::text, 'under_review'::text, 'clarification_needed'::text, 'accepted'::text, 'rejected'::text, 'expired'::text])))
);


--
-- Name: sow_subcontractors; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.sow_subcontractors (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    sow_item_id uuid NOT NULL,
    subcontractor_id uuid NOT NULL,
    match_score integer DEFAULT 0,
    outreach_status text DEFAULT 'identified'::text NOT NULL,
    rfq_sent_date timestamp with time zone,
    rfq_due_date timestamp with time zone,
    response_date timestamp with time zone,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    email_sent_at timestamp with time zone,
    email_opened_at timestamp with time zone,
    email_clicked_at timestamp with time zone,
    portal_viewed_at timestamp with time zone,
    follow_up_count integer DEFAULT 0 NOT NULL,
    last_follow_up_at timestamp with time zone,
    incumbent_status text DEFAULT 'unknown'::text,
    org_id uuid,
    CONSTRAINT sow_subcontractors_incumbent_status_check CHECK ((incumbent_status = ANY (ARRAY['known'::text, 'suspected'::text, 'not_incumbent'::text, 'unknown'::text]))),
    CONSTRAINT sow_subcontractors_outreach_status_check CHECK ((outreach_status = ANY (ARRAY['identified'::text, 'invited'::text, 'reviewing'::text, 'questions_pending'::text, 'quote_submitted'::text, 'declined'::text, 'no_response'::text, 'awarded'::text, 'not_selected'::text])))
);


--
-- Name: sub_access_log; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.sub_access_log (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    org_id uuid NOT NULL,
    action_type text NOT NULL,
    metadata jsonb DEFAULT '{}'::jsonb,
    ip_address text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT sub_access_log_action_type_check CHECK ((action_type = ANY (ARRAY['search'::text, 'connect'::text, 'view_profile'::text, 'page_browse'::text])))
);


--
-- Name: sub_connections; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.sub_connections (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    org_id uuid NOT NULL,
    sub_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    frozen boolean DEFAULT false NOT NULL
);


--
-- Name: subcontractor_questions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.subcontractor_questions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    rfq_token_id uuid,
    sow_subcontractor_id uuid NOT NULL,
    sow_item_id uuid NOT NULL,
    task_order_id uuid NOT NULL,
    subcontractor_id uuid NOT NULL,
    question_text text NOT NULL,
    related_section text,
    status text DEFAULT 'pending'::text NOT NULL,
    answer_text text,
    answered_by uuid,
    answered_at timestamp with time zone,
    shared_with_all boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT subcontractor_questions_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'answered'::text, 'shared'::text, 'dismissed'::text])))
);


--
-- Name: subcontractors; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.subcontractors (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    company_name text NOT NULL,
    contact_name text,
    contact_email text,
    contact_phone text,
    service_categories text[] DEFAULT '{}'::text[],
    geographic_coverage text[] DEFAULT '{}'::text[],
    preferred boolean DEFAULT false NOT NULL,
    incumbent_status text DEFAULT 'unknown'::text NOT NULL,
    performance_notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    address text,
    website text,
    nationwide boolean DEFAULT false,
    regions text[] DEFAULT '{}'::text[],
    org_id uuid,
    CONSTRAINT subcontractors_incumbent_status_check CHECK ((incumbent_status = ANY (ARRAY['known'::text, 'suspected'::text, 'not_incumbent'::text, 'unknown'::text])))
);


--
-- Name: support_tickets; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.support_tickets (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    user_email text DEFAULT ''::text,
    user_name text DEFAULT ''::text,
    org_id uuid,
    message text NOT NULL,
    conversation_context text DEFAULT ''::text,
    preferred_contact text DEFAULT 'email'::text,
    status text DEFAULT 'open'::text,
    priority text DEFAULT 'normal'::text,
    response text,
    responded_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: task_orders; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.task_orders (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    title text NOT NULL,
    solicitation_number text,
    task_order_number text,
    site_name text,
    location_city text,
    location_state text,
    status text DEFAULT 'draft'::text NOT NULL,
    due_date date,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    created_by uuid,
    notes text,
    org_id uuid,
    project_type text DEFAULT 'government_task_order'::text,
    contract_id uuid,
    question_deadline timestamp with time zone,
    naics_code text,
    CONSTRAINT task_orders_status_check CHECK ((status = ANY (ARRAY['draft'::text, 'in_progress'::text, 'under_review'::text, 'submitted'::text, 'awarded'::text, 'not_awarded'::text])))
);


--
-- Name: teaming_agreements; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.teaming_agreements (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    org_id uuid,
    partner_name text NOT NULL,
    partner_role text DEFAULT 'prime'::text,
    our_role text DEFAULT 'sub'::text,
    workshare_percent numeric DEFAULT 0,
    naics_codes text[] DEFAULT '{}'::text[],
    certifications text[] DEFAULT '{}'::text[],
    agreement_status text DEFAULT 'prospective'::text,
    agreement_date date,
    expiration_date date,
    contact_name text DEFAULT ''::text,
    contact_email text DEFAULT ''::text,
    contact_phone text DEFAULT ''::text,
    notes text DEFAULT ''::text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: user_profiles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_profiles (
    id uuid NOT NULL,
    email text NOT NULL,
    full_name text,
    role text DEFAULT 'read_only'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    current_org_id uuid,
    beta_agreement_accepted_at timestamp with time zone,
    beta_agreement_version text,
    last_sign_in_at timestamp with time zone,
    is_global_admin boolean DEFAULT false,
    beta_start_date timestamp with time zone,
    beta_coupon_code text,
    beta_coupon_expires_at timestamp with time zone,
    beta_program_status text,
    account_type text DEFAULT 'platform'::text NOT NULL,
    CONSTRAINT user_profiles_beta_program_status_check CHECK (((beta_program_status IS NULL) OR (beta_program_status = ANY (ARRAY['active'::text, 'completed'::text, 'expired'::text, 'claimed'::text])))),
    CONSTRAINT user_profiles_role_check CHECK ((role = ANY (ARRAY['admin'::text, 'market_sector_lead'::text, 'program_manager'::text, 'procurement'::text, 'contracts'::text, 'talent_acquisition'::text, 'read_only'::text])))
);


--
-- Name: workflow_history; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.workflow_history (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    task_order_id uuid NOT NULL,
    from_stage text,
    to_stage text NOT NULL,
    changed_by uuid NOT NULL,
    changed_by_name text,
    note text,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: account_usage account_usage_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.account_usage
    ADD CONSTRAINT account_usage_pkey PRIMARY KEY (id);


--
-- Name: agent_actions agent_actions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.agent_actions
    ADD CONSTRAINT agent_actions_pkey PRIMARY KEY (id);


--
-- Name: agent_settings agent_settings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.agent_settings
    ADD CONSTRAINT agent_settings_pkey PRIMARY KEY (id);


--
-- Name: ai_audit_log ai_audit_log_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_audit_log
    ADD CONSTRAINT ai_audit_log_pkey PRIMARY KEY (id);


--
-- Name: audit_events audit_events_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audit_events
    ADD CONSTRAINT audit_events_pkey PRIMARY KEY (id);


--
-- Name: beta_feedback beta_feedback_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.beta_feedback
    ADD CONSTRAINT beta_feedback_pkey PRIMARY KEY (id);


--
-- Name: beta_feedback beta_feedback_user_id_week_number_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.beta_feedback
    ADD CONSTRAINT beta_feedback_user_id_week_number_key UNIQUE (user_id, week_number);


--
-- Name: beta_invitations beta_invitations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.beta_invitations
    ADD CONSTRAINT beta_invitations_pkey PRIMARY KEY (id);


--
-- Name: beta_invitations beta_invitations_token_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.beta_invitations
    ADD CONSTRAINT beta_invitations_token_key UNIQUE (token);


--
-- Name: capture_gates capture_gates_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.capture_gates
    ADD CONSTRAINT capture_gates_pkey PRIMARY KEY (id);


--
-- Name: capture_gates capture_gates_task_order_id_gate_number_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.capture_gates
    ADD CONSTRAINT capture_gates_task_order_id_gate_number_key UNIQUE (task_order_id, gate_number);


--
-- Name: color_team_reviews color_team_reviews_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.color_team_reviews
    ADD CONSTRAINT color_team_reviews_pkey PRIMARY KEY (id);


--
-- Name: contacts contacts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contacts
    ADD CONSTRAINT contacts_pkey PRIMARY KEY (id);


--
-- Name: contract_vehicles contract_vehicles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contract_vehicles
    ADD CONSTRAINT contract_vehicles_pkey PRIMARY KEY (id);


--
-- Name: contracts contracts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contracts
    ADD CONSTRAINT contracts_pkey PRIMARY KEY (id);


--
-- Name: cpars_ratings cpars_ratings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cpars_ratings
    ADD CONSTRAINT cpars_ratings_pkey PRIMARY KEY (id);


--
-- Name: database_hygiene_log database_hygiene_log_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.database_hygiene_log
    ADD CONSTRAINT database_hygiene_log_pkey PRIMARY KEY (id);


--
-- Name: documents documents_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.documents
    ADD CONSTRAINT documents_pkey PRIMARY KEY (id);


--
-- Name: email_delivery_log email_delivery_log_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.email_delivery_log
    ADD CONSTRAINT email_delivery_log_pkey PRIMARY KEY (id);


--
-- Name: email_suppression_list email_suppression_list_email_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.email_suppression_list
    ADD CONSTRAINT email_suppression_list_email_key UNIQUE (email);


--
-- Name: email_suppression_list email_suppression_list_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.email_suppression_list
    ADD CONSTRAINT email_suppression_list_pkey PRIMARY KEY (id);


--
-- Name: email_tracking email_tracking_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.email_tracking
    ADD CONSTRAINT email_tracking_pkey PRIMARY KEY (id);


--
-- Name: gate_templates gate_templates_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.gate_templates
    ADD CONSTRAINT gate_templates_pkey PRIMARY KEY (id);


--
-- Name: key_personnel key_personnel_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.key_personnel
    ADD CONSTRAINT key_personnel_pkey PRIMARY KEY (id);


--
-- Name: labor_categories labor_categories_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.labor_categories
    ADD CONSTRAINT labor_categories_pkey PRIMARY KEY (id);


--
-- Name: master_sub_certifications master_sub_certifications_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.master_sub_certifications
    ADD CONSTRAINT master_sub_certifications_pkey PRIMARY KEY (id);


--
-- Name: master_sub_contact_log master_sub_contact_log_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.master_sub_contact_log
    ADD CONSTRAINT master_sub_contact_log_pkey PRIMARY KEY (id);


--
-- Name: master_subcontractors master_subcontractors_claim_token_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.master_subcontractors
    ADD CONSTRAINT master_subcontractors_claim_token_key UNIQUE (claim_token);


--
-- Name: master_subcontractors master_subcontractors_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.master_subcontractors
    ADD CONSTRAINT master_subcontractors_pkey PRIMARY KEY (id);


--
-- Name: master_subcontractors master_subcontractors_sam_uei_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.master_subcontractors
    ADD CONSTRAINT master_subcontractors_sam_uei_key UNIQUE (sam_uei);


--
-- Name: master_subcontractors master_subcontractors_slug_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.master_subcontractors
    ADD CONSTRAINT master_subcontractors_slug_key UNIQUE (slug);


--
-- Name: notification_preferences notification_preferences_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notification_preferences
    ADD CONSTRAINT notification_preferences_pkey PRIMARY KEY (id);


--
-- Name: notifications notifications_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_pkey PRIMARY KEY (id);


--
-- Name: opportunity_questions opportunity_questions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.opportunity_questions
    ADD CONSTRAINT opportunity_questions_pkey PRIMARY KEY (id);


--
-- Name: org_email_domains org_email_domains_org_id_domain_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.org_email_domains
    ADD CONSTRAINT org_email_domains_org_id_domain_key UNIQUE (org_id, domain);


--
-- Name: org_email_domains org_email_domains_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.org_email_domains
    ADD CONSTRAINT org_email_domains_pkey PRIMARY KEY (id);


--
-- Name: org_invitations org_invitations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.org_invitations
    ADD CONSTRAINT org_invitations_pkey PRIMARY KEY (id);


--
-- Name: org_invitations org_invitations_token_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.org_invitations
    ADD CONSTRAINT org_invitations_token_key UNIQUE (token);


--
-- Name: org_sso_providers org_sso_providers_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.org_sso_providers
    ADD CONSTRAINT org_sso_providers_pkey PRIMARY KEY (id);


--
-- Name: organization_members organization_members_org_id_user_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.organization_members
    ADD CONSTRAINT organization_members_org_id_user_id_key UNIQUE (org_id, user_id);


--
-- Name: organization_members organization_members_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.organization_members
    ADD CONSTRAINT organization_members_pkey PRIMARY KEY (id);


--
-- Name: organization_settings organization_settings_org_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.organization_settings
    ADD CONSTRAINT organization_settings_org_id_key UNIQUE (org_id);


--
-- Name: organization_settings organization_settings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.organization_settings
    ADD CONSTRAINT organization_settings_pkey PRIMARY KEY (id);


--
-- Name: organizations organizations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.organizations
    ADD CONSTRAINT organizations_pkey PRIMARY KEY (id);


--
-- Name: organizations organizations_slug_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.organizations
    ADD CONSTRAINT organizations_slug_key UNIQUE (slug);


--
-- Name: partner_payouts partner_payouts_partner_id_month_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.partner_payouts
    ADD CONSTRAINT partner_payouts_partner_id_month_key UNIQUE (partner_id, month);


--
-- Name: partner_payouts partner_payouts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.partner_payouts
    ADD CONSTRAINT partner_payouts_pkey PRIMARY KEY (id);


--
-- Name: past_performance_citations past_performance_citations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.past_performance_citations
    ADD CONSTRAINT past_performance_citations_pkey PRIMARY KEY (id);


--
-- Name: portal_quote_submissions portal_quote_submissions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.portal_quote_submissions
    ADD CONSTRAINT portal_quote_submissions_pkey PRIMARY KEY (id);


--
-- Name: project_assignments project_assignments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.project_assignments
    ADD CONSTRAINT project_assignments_pkey PRIMARY KEY (id);


--
-- Name: project_assignments project_assignments_task_order_id_user_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.project_assignments
    ADD CONSTRAINT project_assignments_task_order_id_user_id_key UNIQUE (task_order_id, user_id);


--
-- Name: project_comments project_comments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.project_comments
    ADD CONSTRAINT project_comments_pkey PRIMARY KEY (id);


--
-- Name: project_contacts project_contacts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.project_contacts
    ADD CONSTRAINT project_contacts_pkey PRIMARY KEY (id);


--
-- Name: project_key_personnel project_key_personnel_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.project_key_personnel
    ADD CONSTRAINT project_key_personnel_pkey PRIMARY KEY (id);


--
-- Name: project_key_personnel project_key_personnel_task_order_id_personnel_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.project_key_personnel
    ADD CONSTRAINT project_key_personnel_task_order_id_personnel_id_key UNIQUE (task_order_id, personnel_id);


--
-- Name: project_past_performance project_past_performance_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.project_past_performance
    ADD CONSTRAINT project_past_performance_pkey PRIMARY KEY (id);


--
-- Name: project_past_performance project_past_performance_task_order_id_citation_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.project_past_performance
    ADD CONSTRAINT project_past_performance_task_order_id_citation_id_key UNIQUE (task_order_id, citation_id);


--
-- Name: project_subcontractors project_subcontractors_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.project_subcontractors
    ADD CONSTRAINT project_subcontractors_pkey PRIMARY KEY (id);


--
-- Name: project_subcontractors project_subcontractors_task_order_id_subcontractor_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.project_subcontractors
    ADD CONSTRAINT project_subcontractors_task_order_id_subcontractor_id_key UNIQUE (task_order_id, subcontractor_id);


--
-- Name: project_tasks project_tasks_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.project_tasks
    ADD CONSTRAINT project_tasks_pkey PRIMARY KEY (id);


--
-- Name: question_answer_history question_answer_history_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.question_answer_history
    ADD CONSTRAINT question_answer_history_pkey PRIMARY KEY (id);


--
-- Name: question_submissions question_submissions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.question_submissions
    ADD CONSTRAINT question_submissions_pkey PRIMARY KEY (id);


--
-- Name: quote_form_fields quote_form_fields_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.quote_form_fields
    ADD CONSTRAINT quote_form_fields_pkey PRIMARY KEY (id);


--
-- Name: quote_form_templates quote_form_templates_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.quote_form_templates
    ADD CONSTRAINT quote_form_templates_pkey PRIMARY KEY (id);


--
-- Name: referral_partners referral_partners_email_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.referral_partners
    ADD CONSTRAINT referral_partners_email_key UNIQUE (email);


--
-- Name: referral_partners referral_partners_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.referral_partners
    ADD CONSTRAINT referral_partners_pkey PRIMARY KEY (id);


--
-- Name: referral_partners referral_partners_referral_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.referral_partners
    ADD CONSTRAINT referral_partners_referral_code_key UNIQUE (referral_code);


--
-- Name: referral_signups referral_signups_partner_id_user_email_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.referral_signups
    ADD CONSTRAINT referral_signups_partner_id_user_email_key UNIQUE (partner_id, user_email);


--
-- Name: referral_signups referral_signups_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.referral_signups
    ADD CONSTRAINT referral_signups_pkey PRIMARY KEY (id);


--
-- Name: rfq_tokens rfq_tokens_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rfq_tokens
    ADD CONSTRAINT rfq_tokens_pkey PRIMARY KEY (id);


--
-- Name: rfq_tokens rfq_tokens_token_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rfq_tokens
    ADD CONSTRAINT rfq_tokens_token_key UNIQUE (token);


--
-- Name: sb_subcontracting_plans sb_subcontracting_plans_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sb_subcontracting_plans
    ADD CONSTRAINT sb_subcontracting_plans_pkey PRIMARY KEY (id);


--
-- Name: sb_subcontracting_plans sb_subcontracting_plans_task_order_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sb_subcontracting_plans
    ADD CONSTRAINT sb_subcontracting_plans_task_order_id_key UNIQUE (task_order_id);


--
-- Name: sow_communications sow_communications_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sow_communications
    ADD CONSTRAINT sow_communications_pkey PRIMARY KEY (id);


--
-- Name: sow_items sow_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sow_items
    ADD CONSTRAINT sow_items_pkey PRIMARY KEY (id);


--
-- Name: sow_quotes sow_quotes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sow_quotes
    ADD CONSTRAINT sow_quotes_pkey PRIMARY KEY (id);


--
-- Name: sow_subcontractors sow_subcontractors_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sow_subcontractors
    ADD CONSTRAINT sow_subcontractors_pkey PRIMARY KEY (id);


--
-- Name: sow_subcontractors sow_subcontractors_sow_item_id_subcontractor_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sow_subcontractors
    ADD CONSTRAINT sow_subcontractors_sow_item_id_subcontractor_id_key UNIQUE (sow_item_id, subcontractor_id);


--
-- Name: sub_access_log sub_access_log_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sub_access_log
    ADD CONSTRAINT sub_access_log_pkey PRIMARY KEY (id);


--
-- Name: sub_connections sub_connections_org_id_sub_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sub_connections
    ADD CONSTRAINT sub_connections_org_id_sub_id_key UNIQUE (org_id, sub_id);


--
-- Name: sub_connections sub_connections_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sub_connections
    ADD CONSTRAINT sub_connections_pkey PRIMARY KEY (id);


--
-- Name: subcontractor_questions subcontractor_questions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.subcontractor_questions
    ADD CONSTRAINT subcontractor_questions_pkey PRIMARY KEY (id);


--
-- Name: subcontractors subcontractors_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.subcontractors
    ADD CONSTRAINT subcontractors_pkey PRIMARY KEY (id);


--
-- Name: support_tickets support_tickets_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.support_tickets
    ADD CONSTRAINT support_tickets_pkey PRIMARY KEY (id);


--
-- Name: task_orders task_orders_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.task_orders
    ADD CONSTRAINT task_orders_pkey PRIMARY KEY (id);


--
-- Name: teaming_agreements teaming_agreements_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.teaming_agreements
    ADD CONSTRAINT teaming_agreements_pkey PRIMARY KEY (id);


--
-- Name: user_profiles user_profiles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_profiles
    ADD CONSTRAINT user_profiles_pkey PRIMARY KEY (id);


--
-- Name: workflow_history workflow_history_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workflow_history
    ADD CONSTRAINT workflow_history_pkey PRIMARY KEY (id);


--
-- Name: idx_account_usage_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_account_usage_created ON public.account_usage USING btree (created_at DESC);


--
-- Name: idx_account_usage_org_action_time; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_account_usage_org_action_time ON public.account_usage USING btree (org_id, action_type, created_at DESC);


--
-- Name: idx_agent_actions_org; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_agent_actions_org ON public.agent_actions USING btree (org_id);


--
-- Name: idx_agent_actions_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_agent_actions_status ON public.agent_actions USING btree (status);


--
-- Name: idx_agent_settings_org; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_agent_settings_org ON public.agent_settings USING btree (org_id);


--
-- Name: idx_ai_audit_log_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ai_audit_log_created_at ON public.ai_audit_log USING btree (created_at DESC);


--
-- Name: idx_ai_audit_log_request_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ai_audit_log_request_type ON public.ai_audit_log USING btree (request_type);


--
-- Name: idx_ai_audit_log_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ai_audit_log_user_id ON public.ai_audit_log USING btree (user_id);


--
-- Name: idx_audit_events_action; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_audit_events_action ON public.audit_events USING btree (action);


--
-- Name: idx_audit_events_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_audit_events_created_at ON public.audit_events USING btree (created_at DESC);


--
-- Name: idx_audit_events_org_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_audit_events_org_id ON public.audit_events USING btree (org_id);


--
-- Name: idx_audit_events_resource; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_audit_events_resource ON public.audit_events USING btree (resource_type, resource_id);


--
-- Name: idx_audit_events_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_audit_events_user_id ON public.audit_events USING btree (user_id);


--
-- Name: idx_beta_feedback_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_beta_feedback_user ON public.beta_feedback USING btree (user_id, week_number);


--
-- Name: idx_beta_invitations_email; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_beta_invitations_email ON public.beta_invitations USING btree (email, status);


--
-- Name: idx_beta_invitations_token; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_beta_invitations_token ON public.beta_invitations USING btree (token);


--
-- Name: idx_contacts_org_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_contacts_org_id ON public.contacts USING btree (org_id);


--
-- Name: idx_contacts_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_contacts_type ON public.contacts USING btree (contact_type);


--
-- Name: idx_contracts_org; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_contracts_org ON public.contracts USING btree (org_id);


--
-- Name: idx_email_delivery_log_org_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_email_delivery_log_org_status ON public.email_delivery_log USING btree (org_id, status, created_at DESC);


--
-- Name: idx_email_tracking_event; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_email_tracking_event ON public.email_tracking USING btree (event_type);


--
-- Name: idx_email_tracking_sow_sub; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_email_tracking_sow_sub ON public.email_tracking USING btree (sow_subcontractor_id);


--
-- Name: idx_hygiene_log_action; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_hygiene_log_action ON public.database_hygiene_log USING btree (action);


--
-- Name: idx_hygiene_log_performed; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_hygiene_log_performed ON public.database_hygiene_log USING btree (performed_at);


--
-- Name: idx_master_sub_archived; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_master_sub_archived ON public.master_subcontractors USING btree (archived);


--
-- Name: idx_master_sub_archived_health; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_master_sub_archived_health ON public.master_subcontractors USING btree (archived, data_health_score) WHERE (archived = false);


--
-- Name: idx_master_sub_cert_expiration; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_master_sub_cert_expiration ON public.master_sub_certifications USING btree (expiration_date) WHERE ((expiration_date IS NOT NULL) AND (reminder_sent_at IS NULL));


--
-- Name: idx_master_sub_certs_expiry; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_master_sub_certs_expiry ON public.master_sub_certifications USING btree (expiration_date);


--
-- Name: idx_master_sub_certs_sub; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_master_sub_certs_sub ON public.master_sub_certifications USING btree (master_sub_id);


--
-- Name: idx_master_sub_claim_token; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_master_sub_claim_token ON public.master_subcontractors USING btree (claim_token) WHERE (claim_token IS NOT NULL);


--
-- Name: idx_master_sub_data_source_ext; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_master_sub_data_source_ext ON public.master_subcontractors USING btree (data_source, external_id) WHERE (external_id IS NOT NULL);


--
-- Name: idx_master_sub_external_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_master_sub_external_id ON public.master_subcontractors USING btree (external_id) WHERE (external_id IS NOT NULL);


--
-- Name: idx_master_sub_health_score; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_master_sub_health_score ON public.master_subcontractors USING btree (data_health_score);


--
-- Name: idx_master_sub_last_engagement; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_master_sub_last_engagement ON public.master_subcontractors USING btree (last_engagement_at);


--
-- Name: idx_master_sub_log_sub; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_master_sub_log_sub ON public.master_sub_contact_log USING btree (master_sub_id);


--
-- Name: idx_master_sub_log_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_master_sub_log_type ON public.master_sub_contact_log USING btree (event_type);


--
-- Name: idx_master_sub_outreach_targets; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_master_sub_outreach_targets ON public.master_subcontractors USING btree (contact_email, outreach_sent_at) WHERE ((contact_email IS NOT NULL) AND (claimed_at IS NULL));


--
-- Name: idx_master_sub_sam_uei; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_master_sub_sam_uei ON public.master_subcontractors USING btree (sam_uei) WHERE (sam_uei IS NOT NULL);


--
-- Name: idx_master_sub_verified; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_master_sub_verified ON public.master_subcontractors USING btree (verification_status, profile_completeness DESC) WHERE (verification_status = 'verified'::text);


--
-- Name: idx_master_subs_claim_token; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_master_subs_claim_token ON public.master_subcontractors USING btree (claim_token);


--
-- Name: idx_master_subs_company_name; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_master_subs_company_name ON public.master_subcontractors USING gin (to_tsvector('english'::regconfig, company_name));


--
-- Name: idx_master_subs_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_master_subs_created ON public.master_subcontractors USING btree (created_at DESC);


--
-- Name: idx_master_subs_email; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_master_subs_email ON public.master_subcontractors USING btree (contact_email);


--
-- Name: idx_master_subs_naics; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_master_subs_naics ON public.master_subcontractors USING gin (naics_codes);


--
-- Name: idx_master_subs_sam_uei; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_master_subs_sam_uei ON public.master_subcontractors USING btree (sam_uei);


--
-- Name: idx_master_subs_service_cats; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_master_subs_service_cats ON public.master_subcontractors USING gin (service_categories);


--
-- Name: idx_master_subs_slug; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_master_subs_slug ON public.master_subcontractors USING btree (slug);


--
-- Name: idx_master_subs_small_biz; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_master_subs_small_biz ON public.master_subcontractors USING gin (small_business_types);


--
-- Name: idx_master_subs_state; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_master_subs_state ON public.master_subcontractors USING btree (state);


--
-- Name: idx_master_subs_trade_cats; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_master_subs_trade_cats ON public.master_subcontractors USING gin (trade_categories);


--
-- Name: idx_master_subs_verification; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_master_subs_verification ON public.master_subcontractors USING btree (verification_status);


--
-- Name: idx_notification_prefs_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_notification_prefs_user ON public.notification_preferences USING btree (user_id);


--
-- Name: idx_notifications_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_notifications_created_at ON public.notifications USING btree (created_at DESC);


--
-- Name: idx_notifications_org_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_notifications_org_id ON public.notifications USING btree (org_id);


--
-- Name: idx_notifications_org_read; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_notifications_org_read ON public.notifications USING btree (org_id, read);


--
-- Name: idx_oq_confidence; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_oq_confidence ON public.opportunity_questions USING btree (ai_confidence_score);


--
-- Name: idx_oq_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_oq_created ON public.opportunity_questions USING btree (created_at DESC);


--
-- Name: idx_oq_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_oq_status ON public.opportunity_questions USING btree (status);


--
-- Name: idx_oq_sub; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_oq_sub ON public.opportunity_questions USING btree (sow_subcontractor_id);


--
-- Name: idx_oq_task_order; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_oq_task_order ON public.opportunity_questions USING btree (task_order_id);


--
-- Name: idx_org_email_domains_org_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_org_email_domains_org_id ON public.org_email_domains USING btree (org_id);


--
-- Name: idx_org_email_domains_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_org_email_domains_status ON public.org_email_domains USING btree (status);


--
-- Name: idx_org_invitations_email; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_org_invitations_email ON public.org_invitations USING btree (email);


--
-- Name: idx_org_invitations_org; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_org_invitations_org ON public.org_invitations USING btree (org_id);


--
-- Name: idx_org_invitations_token; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_org_invitations_token ON public.org_invitations USING btree (token);


--
-- Name: idx_org_invitations_unique_pending; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_org_invitations_unique_pending ON public.org_invitations USING btree (org_id, email) WHERE (status = 'pending'::text);


--
-- Name: idx_org_members_org; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_org_members_org ON public.organization_members USING btree (org_id);


--
-- Name: idx_org_members_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_org_members_user ON public.organization_members USING btree (user_id);


--
-- Name: idx_org_sso_providers_org; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_org_sso_providers_org ON public.org_sso_providers USING btree (org_id);


--
-- Name: idx_org_sso_providers_provider; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_org_sso_providers_provider ON public.org_sso_providers USING btree (provider_id);


--
-- Name: idx_partner_payouts_partner; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_partner_payouts_partner ON public.partner_payouts USING btree (partner_id);


--
-- Name: idx_project_assignments_task_order; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_project_assignments_task_order ON public.project_assignments USING btree (task_order_id);


--
-- Name: idx_project_assignments_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_project_assignments_user ON public.project_assignments USING btree (user_id);


--
-- Name: idx_project_comments_org; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_project_comments_org ON public.project_comments USING btree (org_id);


--
-- Name: idx_project_comments_project; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_project_comments_project ON public.project_comments USING btree (project_id);


--
-- Name: idx_project_contacts_contact; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_project_contacts_contact ON public.project_contacts USING btree (contact_id);


--
-- Name: idx_project_contacts_project; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_project_contacts_project ON public.project_contacts USING btree (project_id);


--
-- Name: idx_project_subs_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_project_subs_status ON public.project_subcontractors USING btree (status);


--
-- Name: idx_project_subs_subcontractor; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_project_subs_subcontractor ON public.project_subcontractors USING btree (subcontractor_id);


--
-- Name: idx_project_subs_task_order; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_project_subs_task_order ON public.project_subcontractors USING btree (task_order_id);


--
-- Name: idx_project_tasks_org; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_project_tasks_org ON public.project_tasks USING btree (org_id);


--
-- Name: idx_project_tasks_project; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_project_tasks_project ON public.project_tasks USING btree (project_id);


--
-- Name: idx_project_tasks_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_project_tasks_status ON public.project_tasks USING btree (status);


--
-- Name: idx_qah_category; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_qah_category ON public.question_answer_history USING btree (question_category);


--
-- Name: idx_qah_pattern; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_qah_pattern ON public.question_answer_history USING btree (question_pattern);


--
-- Name: idx_qs_deadline; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_qs_deadline ON public.question_submissions USING btree (submission_deadline);


--
-- Name: idx_qs_task_order; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_qs_task_order ON public.question_submissions USING btree (task_order_id);


--
-- Name: idx_quote_form_fields_template; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_quote_form_fields_template ON public.quote_form_fields USING btree (template_id);


--
-- Name: idx_referral_partners_code; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_referral_partners_code ON public.referral_partners USING btree (referral_code);


--
-- Name: idx_referral_partners_email; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_referral_partners_email ON public.referral_partners USING btree (email);


--
-- Name: idx_referral_partners_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_referral_partners_status ON public.referral_partners USING btree (status);


--
-- Name: idx_referral_signups_partner; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_referral_signups_partner ON public.referral_signups USING btree (partner_id);


--
-- Name: idx_referral_signups_stripe; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_referral_signups_stripe ON public.referral_signups USING btree (stripe_subscription_id);


--
-- Name: idx_rfq_tokens_sow_sub; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_rfq_tokens_sow_sub ON public.rfq_tokens USING btree (sow_subcontractor_id);


--
-- Name: idx_rfq_tokens_token; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_rfq_tokens_token ON public.rfq_tokens USING btree (token);


--
-- Name: idx_sow_communications_sow_sub; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_sow_communications_sow_sub ON public.sow_communications USING btree (sow_subcontractor_id);


--
-- Name: idx_sow_items_task_order; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_sow_items_task_order ON public.sow_items USING btree (task_order_id);


--
-- Name: idx_sow_quotes_sow_item; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_sow_quotes_sow_item ON public.sow_quotes USING btree (sow_item_id);


--
-- Name: idx_sow_quotes_sub; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_sow_quotes_sub ON public.sow_quotes USING btree (subcontractor_id);


--
-- Name: idx_sow_subcontractors_sow; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_sow_subcontractors_sow ON public.sow_subcontractors USING btree (sow_item_id);


--
-- Name: idx_sow_subcontractors_sub; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_sow_subcontractors_sub ON public.sow_subcontractors USING btree (subcontractor_id);


--
-- Name: idx_sub_access_log_action_time; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_sub_access_log_action_time ON public.sub_access_log USING btree (action_type, created_at DESC);


--
-- Name: idx_sub_access_log_org_time; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_sub_access_log_org_time ON public.sub_access_log USING btree (org_id, created_at DESC);


--
-- Name: idx_sub_access_log_user_time; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_sub_access_log_user_time ON public.sub_access_log USING btree (user_id, created_at DESC);


--
-- Name: idx_sub_connections_org; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_sub_connections_org ON public.sub_connections USING btree (org_id);


--
-- Name: idx_sub_connections_sub; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_sub_connections_sub ON public.sub_connections USING btree (sub_id);


--
-- Name: idx_sub_connections_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_sub_connections_user ON public.sub_connections USING btree (user_id);


--
-- Name: idx_sub_questions_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_sub_questions_status ON public.subcontractor_questions USING btree (status);


--
-- Name: idx_sub_questions_task_order; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_sub_questions_task_order ON public.subcontractor_questions USING btree (task_order_id);


--
-- Name: idx_subcontractors_org; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_subcontractors_org ON public.subcontractors USING btree (org_id);


--
-- Name: idx_suppression_email; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_suppression_email ON public.email_suppression_list USING btree (email);


--
-- Name: idx_task_orders_contract; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_task_orders_contract ON public.task_orders USING btree (contract_id);


--
-- Name: idx_task_orders_org; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_task_orders_org ON public.task_orders USING btree (org_id);


--
-- Name: idx_user_profiles_account_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_user_profiles_account_type ON public.user_profiles USING btree (account_type);


--
-- Name: idx_workflow_history_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_workflow_history_created ON public.workflow_history USING btree (created_at DESC);


--
-- Name: idx_workflow_history_task_order; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_workflow_history_task_order ON public.workflow_history USING btree (task_order_id);


--
-- Name: user_profiles on_profile_created_ensure_org; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER on_profile_created_ensure_org AFTER INSERT ON public.user_profiles FOR EACH ROW EXECUTE FUNCTION public.ensure_user_org();


--
-- Name: sub_connections trg_enforce_connection_limit; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_enforce_connection_limit BEFORE INSERT ON public.sub_connections FOR EACH ROW EXECUTE FUNCTION public.enforce_connection_limit();


--
-- Name: organizations trg_freeze_connections_on_churn; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_freeze_connections_on_churn AFTER UPDATE OF subscription_status ON public.organizations FOR EACH ROW EXECUTE FUNCTION public.freeze_connections_on_churn();


--
-- Name: agent_actions agent_actions_assigned_to_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.agent_actions
    ADD CONSTRAINT agent_actions_assigned_to_fkey FOREIGN KEY (assigned_to) REFERENCES public.user_profiles(id);


--
-- Name: agent_actions agent_actions_org_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.agent_actions
    ADD CONSTRAINT agent_actions_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.organizations(id);


--
-- Name: agent_actions agent_actions_project_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.agent_actions
    ADD CONSTRAINT agent_actions_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.task_orders(id);


--
-- Name: agent_actions agent_actions_resolved_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.agent_actions
    ADD CONSTRAINT agent_actions_resolved_by_fkey FOREIGN KEY (resolved_by) REFERENCES public.user_profiles(id);


--
-- Name: agent_settings agent_settings_org_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.agent_settings
    ADD CONSTRAINT agent_settings_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.organizations(id);


--
-- Name: agent_settings agent_settings_primary_contact_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.agent_settings
    ADD CONSTRAINT agent_settings_primary_contact_id_fkey FOREIGN KEY (primary_contact_id) REFERENCES public.user_profiles(id);


--
-- Name: agent_settings agent_settings_project_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.agent_settings
    ADD CONSTRAINT agent_settings_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.task_orders(id);


--
-- Name: audit_events audit_events_org_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audit_events
    ADD CONSTRAINT audit_events_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.organizations(id);


--
-- Name: audit_events audit_events_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audit_events
    ADD CONSTRAINT audit_events_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id);


--
-- Name: beta_feedback beta_feedback_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.beta_feedback
    ADD CONSTRAINT beta_feedback_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.user_profiles(id) ON DELETE CASCADE;


--
-- Name: beta_invitations beta_invitations_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.beta_invitations
    ADD CONSTRAINT beta_invitations_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.user_profiles(id) ON DELETE SET NULL;


--
-- Name: capture_gates capture_gates_task_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.capture_gates
    ADD CONSTRAINT capture_gates_task_order_id_fkey FOREIGN KEY (task_order_id) REFERENCES public.task_orders(id) ON DELETE CASCADE;


--
-- Name: color_team_reviews color_team_reviews_task_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.color_team_reviews
    ADD CONSTRAINT color_team_reviews_task_order_id_fkey FOREIGN KEY (task_order_id) REFERENCES public.task_orders(id) ON DELETE CASCADE;


--
-- Name: contacts contacts_org_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contacts
    ADD CONSTRAINT contacts_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: contract_vehicles contract_vehicles_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contract_vehicles
    ADD CONSTRAINT contract_vehicles_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id);


--
-- Name: contract_vehicles contract_vehicles_org_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contract_vehicles
    ADD CONSTRAINT contract_vehicles_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: contracts contracts_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contracts
    ADD CONSTRAINT contracts_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id);


--
-- Name: contracts contracts_org_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contracts
    ADD CONSTRAINT contracts_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: cpars_ratings cpars_ratings_org_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cpars_ratings
    ADD CONSTRAINT cpars_ratings_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: documents documents_org_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.documents
    ADD CONSTRAINT documents_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.organizations(id);


--
-- Name: documents documents_sow_item_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.documents
    ADD CONSTRAINT documents_sow_item_id_fkey FOREIGN KEY (sow_item_id) REFERENCES public.sow_items(id);


--
-- Name: documents documents_task_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.documents
    ADD CONSTRAINT documents_task_order_id_fkey FOREIGN KEY (task_order_id) REFERENCES public.task_orders(id) ON DELETE CASCADE;


--
-- Name: documents documents_uploaded_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.documents
    ADD CONSTRAINT documents_uploaded_by_fkey FOREIGN KEY (uploaded_by) REFERENCES auth.users(id);


--
-- Name: email_delivery_log email_delivery_log_org_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.email_delivery_log
    ADD CONSTRAINT email_delivery_log_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: email_tracking email_tracking_rfq_token_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.email_tracking
    ADD CONSTRAINT email_tracking_rfq_token_id_fkey FOREIGN KEY (rfq_token_id) REFERENCES public.rfq_tokens(id) ON DELETE SET NULL;


--
-- Name: email_tracking email_tracking_sow_subcontractor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.email_tracking
    ADD CONSTRAINT email_tracking_sow_subcontractor_id_fkey FOREIGN KEY (sow_subcontractor_id) REFERENCES public.sow_subcontractors(id) ON DELETE SET NULL;


--
-- Name: opportunity_questions fk_oq_submission; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.opportunity_questions
    ADD CONSTRAINT fk_oq_submission FOREIGN KEY (submission_id) REFERENCES public.question_submissions(id) ON DELETE SET NULL;


--
-- Name: gate_templates gate_templates_org_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.gate_templates
    ADD CONSTRAINT gate_templates_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: key_personnel key_personnel_labor_category_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.key_personnel
    ADD CONSTRAINT key_personnel_labor_category_id_fkey FOREIGN KEY (labor_category_id) REFERENCES public.labor_categories(id);


--
-- Name: key_personnel key_personnel_org_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.key_personnel
    ADD CONSTRAINT key_personnel_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: labor_categories labor_categories_org_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.labor_categories
    ADD CONSTRAINT labor_categories_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: master_sub_certifications master_sub_certifications_master_sub_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.master_sub_certifications
    ADD CONSTRAINT master_sub_certifications_master_sub_id_fkey FOREIGN KEY (master_sub_id) REFERENCES public.master_subcontractors(id) ON DELETE CASCADE;


--
-- Name: master_sub_contact_log master_sub_contact_log_master_sub_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.master_sub_contact_log
    ADD CONSTRAINT master_sub_contact_log_master_sub_id_fkey FOREIGN KEY (master_sub_id) REFERENCES public.master_subcontractors(id) ON DELETE CASCADE;


--
-- Name: master_subcontractors master_subcontractors_claimed_by_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.master_subcontractors
    ADD CONSTRAINT master_subcontractors_claimed_by_user_id_fkey FOREIGN KEY (claimed_by_user_id) REFERENCES auth.users(id);


--
-- Name: master_subcontractors master_subcontractors_verified_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.master_subcontractors
    ADD CONSTRAINT master_subcontractors_verified_by_fkey FOREIGN KEY (verified_by) REFERENCES auth.users(id);


--
-- Name: notification_preferences notification_preferences_org_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notification_preferences
    ADD CONSTRAINT notification_preferences_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.organizations(id);


--
-- Name: notification_preferences notification_preferences_project_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notification_preferences
    ADD CONSTRAINT notification_preferences_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.task_orders(id);


--
-- Name: notification_preferences notification_preferences_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notification_preferences
    ADD CONSTRAINT notification_preferences_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.user_profiles(id);


--
-- Name: opportunity_questions opportunity_questions_official_source_document_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.opportunity_questions
    ADD CONSTRAINT opportunity_questions_official_source_document_id_fkey FOREIGN KEY (official_source_document_id) REFERENCES public.documents(id) ON DELETE SET NULL;


--
-- Name: opportunity_questions opportunity_questions_rfq_token_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.opportunity_questions
    ADD CONSTRAINT opportunity_questions_rfq_token_id_fkey FOREIGN KEY (rfq_token_id) REFERENCES public.rfq_tokens(id) ON DELETE SET NULL;


--
-- Name: opportunity_questions opportunity_questions_sow_subcontractor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.opportunity_questions
    ADD CONSTRAINT opportunity_questions_sow_subcontractor_id_fkey FOREIGN KEY (sow_subcontractor_id) REFERENCES public.sow_subcontractors(id) ON DELETE SET NULL;


--
-- Name: opportunity_questions opportunity_questions_subcontractor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.opportunity_questions
    ADD CONSTRAINT opportunity_questions_subcontractor_id_fkey FOREIGN KEY (subcontractor_id) REFERENCES public.subcontractors(id) ON DELETE SET NULL;


--
-- Name: opportunity_questions opportunity_questions_submitted_by_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.opportunity_questions
    ADD CONSTRAINT opportunity_questions_submitted_by_user_id_fkey FOREIGN KEY (submitted_by_user_id) REFERENCES auth.users(id) ON DELETE SET NULL;


--
-- Name: opportunity_questions opportunity_questions_task_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.opportunity_questions
    ADD CONSTRAINT opportunity_questions_task_order_id_fkey FOREIGN KEY (task_order_id) REFERENCES public.task_orders(id) ON DELETE CASCADE;


--
-- Name: org_email_domains org_email_domains_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.org_email_domains
    ADD CONSTRAINT org_email_domains_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id);


--
-- Name: org_email_domains org_email_domains_org_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.org_email_domains
    ADD CONSTRAINT org_email_domains_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: org_invitations org_invitations_invited_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.org_invitations
    ADD CONSTRAINT org_invitations_invited_by_fkey FOREIGN KEY (invited_by) REFERENCES auth.users(id);


--
-- Name: org_invitations org_invitations_org_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.org_invitations
    ADD CONSTRAINT org_invitations_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: org_sso_providers org_sso_providers_org_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.org_sso_providers
    ADD CONSTRAINT org_sso_providers_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: organization_members organization_members_invited_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.organization_members
    ADD CONSTRAINT organization_members_invited_by_fkey FOREIGN KEY (invited_by) REFERENCES auth.users(id);


--
-- Name: organization_members organization_members_org_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.organization_members
    ADD CONSTRAINT organization_members_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: organization_members organization_members_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.organization_members
    ADD CONSTRAINT organization_members_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: organization_settings organization_settings_org_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.organization_settings
    ADD CONSTRAINT organization_settings_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: organizations organizations_default_email_domain_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.organizations
    ADD CONSTRAINT organizations_default_email_domain_id_fkey FOREIGN KEY (default_email_domain_id) REFERENCES public.org_email_domains(id);


--
-- Name: partner_payouts partner_payouts_partner_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.partner_payouts
    ADD CONSTRAINT partner_payouts_partner_id_fkey FOREIGN KEY (partner_id) REFERENCES public.referral_partners(id);


--
-- Name: past_performance_citations past_performance_citations_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.past_performance_citations
    ADD CONSTRAINT past_performance_citations_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id);


--
-- Name: past_performance_citations past_performance_citations_org_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.past_performance_citations
    ADD CONSTRAINT past_performance_citations_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: portal_quote_submissions portal_quote_submissions_rfq_token_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.portal_quote_submissions
    ADD CONSTRAINT portal_quote_submissions_rfq_token_id_fkey FOREIGN KEY (rfq_token_id) REFERENCES public.rfq_tokens(id) ON DELETE CASCADE;


--
-- Name: portal_quote_submissions portal_quote_submissions_sow_quote_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.portal_quote_submissions
    ADD CONSTRAINT portal_quote_submissions_sow_quote_id_fkey FOREIGN KEY (sow_quote_id) REFERENCES public.sow_quotes(id) ON DELETE SET NULL;


--
-- Name: project_assignments project_assignments_assigned_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.project_assignments
    ADD CONSTRAINT project_assignments_assigned_by_fkey FOREIGN KEY (assigned_by) REFERENCES auth.users(id);


--
-- Name: project_assignments project_assignments_task_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.project_assignments
    ADD CONSTRAINT project_assignments_task_order_id_fkey FOREIGN KEY (task_order_id) REFERENCES public.task_orders(id) ON DELETE CASCADE;


--
-- Name: project_assignments project_assignments_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.project_assignments
    ADD CONSTRAINT project_assignments_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: project_comments project_comments_org_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.project_comments
    ADD CONSTRAINT project_comments_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: project_comments project_comments_project_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.project_comments
    ADD CONSTRAINT project_comments_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.task_orders(id) ON DELETE CASCADE;


--
-- Name: project_contacts project_contacts_contact_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.project_contacts
    ADD CONSTRAINT project_contacts_contact_id_fkey FOREIGN KEY (contact_id) REFERENCES public.contacts(id) ON DELETE CASCADE;


--
-- Name: project_contacts project_contacts_project_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.project_contacts
    ADD CONSTRAINT project_contacts_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.task_orders(id) ON DELETE CASCADE;


--
-- Name: project_key_personnel project_key_personnel_labor_category_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.project_key_personnel
    ADD CONSTRAINT project_key_personnel_labor_category_id_fkey FOREIGN KEY (labor_category_id) REFERENCES public.labor_categories(id);


--
-- Name: project_key_personnel project_key_personnel_personnel_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.project_key_personnel
    ADD CONSTRAINT project_key_personnel_personnel_id_fkey FOREIGN KEY (personnel_id) REFERENCES public.key_personnel(id) ON DELETE CASCADE;


--
-- Name: project_key_personnel project_key_personnel_task_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.project_key_personnel
    ADD CONSTRAINT project_key_personnel_task_order_id_fkey FOREIGN KEY (task_order_id) REFERENCES public.task_orders(id) ON DELETE CASCADE;


--
-- Name: project_past_performance project_past_performance_citation_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.project_past_performance
    ADD CONSTRAINT project_past_performance_citation_id_fkey FOREIGN KEY (citation_id) REFERENCES public.past_performance_citations(id) ON DELETE CASCADE;


--
-- Name: project_past_performance project_past_performance_task_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.project_past_performance
    ADD CONSTRAINT project_past_performance_task_order_id_fkey FOREIGN KEY (task_order_id) REFERENCES public.task_orders(id) ON DELETE CASCADE;


--
-- Name: project_subcontractors project_subcontractors_org_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.project_subcontractors
    ADD CONSTRAINT project_subcontractors_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.organizations(id);


--
-- Name: project_subcontractors project_subcontractors_subcontractor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.project_subcontractors
    ADD CONSTRAINT project_subcontractors_subcontractor_id_fkey FOREIGN KEY (subcontractor_id) REFERENCES public.subcontractors(id) ON DELETE CASCADE;


--
-- Name: project_subcontractors project_subcontractors_task_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.project_subcontractors
    ADD CONSTRAINT project_subcontractors_task_order_id_fkey FOREIGN KEY (task_order_id) REFERENCES public.task_orders(id) ON DELETE CASCADE;


--
-- Name: project_tasks project_tasks_org_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.project_tasks
    ADD CONSTRAINT project_tasks_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: project_tasks project_tasks_project_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.project_tasks
    ADD CONSTRAINT project_tasks_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.task_orders(id) ON DELETE CASCADE;


--
-- Name: question_answer_history question_answer_history_opportunity_question_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.question_answer_history
    ADD CONSTRAINT question_answer_history_opportunity_question_id_fkey FOREIGN KEY (opportunity_question_id) REFERENCES public.opportunity_questions(id) ON DELETE SET NULL;


--
-- Name: question_answer_history question_answer_history_task_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.question_answer_history
    ADD CONSTRAINT question_answer_history_task_order_id_fkey FOREIGN KEY (task_order_id) REFERENCES public.task_orders(id) ON DELETE SET NULL;


--
-- Name: question_submissions question_submissions_response_document_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.question_submissions
    ADD CONSTRAINT question_submissions_response_document_id_fkey FOREIGN KEY (response_document_id) REFERENCES public.documents(id) ON DELETE SET NULL;


--
-- Name: question_submissions question_submissions_submitted_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.question_submissions
    ADD CONSTRAINT question_submissions_submitted_by_fkey FOREIGN KEY (submitted_by) REFERENCES auth.users(id) ON DELETE SET NULL;


--
-- Name: question_submissions question_submissions_task_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.question_submissions
    ADD CONSTRAINT question_submissions_task_order_id_fkey FOREIGN KEY (task_order_id) REFERENCES public.task_orders(id) ON DELETE CASCADE;


--
-- Name: quote_form_fields quote_form_fields_template_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.quote_form_fields
    ADD CONSTRAINT quote_form_fields_template_id_fkey FOREIGN KEY (template_id) REFERENCES public.quote_form_templates(id) ON DELETE CASCADE;


--
-- Name: quote_form_templates quote_form_templates_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.quote_form_templates
    ADD CONSTRAINT quote_form_templates_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id);


--
-- Name: quote_form_templates quote_form_templates_sow_item_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.quote_form_templates
    ADD CONSTRAINT quote_form_templates_sow_item_id_fkey FOREIGN KEY (sow_item_id) REFERENCES public.sow_items(id) ON DELETE CASCADE;


--
-- Name: quote_form_templates quote_form_templates_task_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.quote_form_templates
    ADD CONSTRAINT quote_form_templates_task_order_id_fkey FOREIGN KEY (task_order_id) REFERENCES public.task_orders(id) ON DELETE CASCADE;


--
-- Name: referral_signups referral_signups_partner_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.referral_signups
    ADD CONSTRAINT referral_signups_partner_id_fkey FOREIGN KEY (partner_id) REFERENCES public.referral_partners(id);


--
-- Name: rfq_tokens rfq_tokens_sow_item_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rfq_tokens
    ADD CONSTRAINT rfq_tokens_sow_item_id_fkey FOREIGN KEY (sow_item_id) REFERENCES public.sow_items(id) ON DELETE CASCADE;


--
-- Name: rfq_tokens rfq_tokens_sow_subcontractor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rfq_tokens
    ADD CONSTRAINT rfq_tokens_sow_subcontractor_id_fkey FOREIGN KEY (sow_subcontractor_id) REFERENCES public.sow_subcontractors(id) ON DELETE CASCADE;


--
-- Name: rfq_tokens rfq_tokens_subcontractor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rfq_tokens
    ADD CONSTRAINT rfq_tokens_subcontractor_id_fkey FOREIGN KEY (subcontractor_id) REFERENCES public.subcontractors(id) ON DELETE CASCADE;


--
-- Name: rfq_tokens rfq_tokens_task_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rfq_tokens
    ADD CONSTRAINT rfq_tokens_task_order_id_fkey FOREIGN KEY (task_order_id) REFERENCES public.task_orders(id) ON DELETE CASCADE;


--
-- Name: sb_subcontracting_plans sb_subcontracting_plans_task_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sb_subcontracting_plans
    ADD CONSTRAINT sb_subcontracting_plans_task_order_id_fkey FOREIGN KEY (task_order_id) REFERENCES public.task_orders(id) ON DELETE CASCADE;


--
-- Name: sow_communications sow_communications_sow_subcontractor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sow_communications
    ADD CONSTRAINT sow_communications_sow_subcontractor_id_fkey FOREIGN KEY (sow_subcontractor_id) REFERENCES public.sow_subcontractors(id) ON DELETE CASCADE;


--
-- Name: sow_items sow_items_awarded_subcontractor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sow_items
    ADD CONSTRAINT sow_items_awarded_subcontractor_id_fkey FOREIGN KEY (awarded_subcontractor_id) REFERENCES public.subcontractors(id);


--
-- Name: sow_items sow_items_task_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sow_items
    ADD CONSTRAINT sow_items_task_order_id_fkey FOREIGN KEY (task_order_id) REFERENCES public.task_orders(id) ON DELETE CASCADE;


--
-- Name: sow_quotes sow_quotes_sow_item_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sow_quotes
    ADD CONSTRAINT sow_quotes_sow_item_id_fkey FOREIGN KEY (sow_item_id) REFERENCES public.sow_items(id) ON DELETE CASCADE;


--
-- Name: sow_quotes sow_quotes_sow_subcontractor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sow_quotes
    ADD CONSTRAINT sow_quotes_sow_subcontractor_id_fkey FOREIGN KEY (sow_subcontractor_id) REFERENCES public.sow_subcontractors(id) ON DELETE CASCADE;


--
-- Name: sow_quotes sow_quotes_subcontractor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sow_quotes
    ADD CONSTRAINT sow_quotes_subcontractor_id_fkey FOREIGN KEY (subcontractor_id) REFERENCES public.subcontractors(id) ON DELETE CASCADE;


--
-- Name: sow_subcontractors sow_subcontractors_org_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sow_subcontractors
    ADD CONSTRAINT sow_subcontractors_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.organizations(id);


--
-- Name: sow_subcontractors sow_subcontractors_sow_item_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sow_subcontractors
    ADD CONSTRAINT sow_subcontractors_sow_item_id_fkey FOREIGN KEY (sow_item_id) REFERENCES public.sow_items(id) ON DELETE CASCADE;


--
-- Name: sow_subcontractors sow_subcontractors_subcontractor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sow_subcontractors
    ADD CONSTRAINT sow_subcontractors_subcontractor_id_fkey FOREIGN KEY (subcontractor_id) REFERENCES public.subcontractors(id) ON DELETE CASCADE;


--
-- Name: sub_access_log sub_access_log_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sub_access_log
    ADD CONSTRAINT sub_access_log_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: sub_connections sub_connections_sub_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sub_connections
    ADD CONSTRAINT sub_connections_sub_id_fkey FOREIGN KEY (sub_id) REFERENCES public.master_subcontractors(id);


--
-- Name: subcontractor_questions subcontractor_questions_answered_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.subcontractor_questions
    ADD CONSTRAINT subcontractor_questions_answered_by_fkey FOREIGN KEY (answered_by) REFERENCES auth.users(id);


--
-- Name: subcontractor_questions subcontractor_questions_rfq_token_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.subcontractor_questions
    ADD CONSTRAINT subcontractor_questions_rfq_token_id_fkey FOREIGN KEY (rfq_token_id) REFERENCES public.rfq_tokens(id) ON DELETE SET NULL;


--
-- Name: subcontractor_questions subcontractor_questions_sow_item_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.subcontractor_questions
    ADD CONSTRAINT subcontractor_questions_sow_item_id_fkey FOREIGN KEY (sow_item_id) REFERENCES public.sow_items(id) ON DELETE CASCADE;


--
-- Name: subcontractor_questions subcontractor_questions_sow_subcontractor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.subcontractor_questions
    ADD CONSTRAINT subcontractor_questions_sow_subcontractor_id_fkey FOREIGN KEY (sow_subcontractor_id) REFERENCES public.sow_subcontractors(id) ON DELETE CASCADE;


--
-- Name: subcontractor_questions subcontractor_questions_subcontractor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.subcontractor_questions
    ADD CONSTRAINT subcontractor_questions_subcontractor_id_fkey FOREIGN KEY (subcontractor_id) REFERENCES public.subcontractors(id) ON DELETE CASCADE;


--
-- Name: subcontractor_questions subcontractor_questions_task_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.subcontractor_questions
    ADD CONSTRAINT subcontractor_questions_task_order_id_fkey FOREIGN KEY (task_order_id) REFERENCES public.task_orders(id) ON DELETE CASCADE;


--
-- Name: subcontractors subcontractors_org_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.subcontractors
    ADD CONSTRAINT subcontractors_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.organizations(id);


--
-- Name: support_tickets support_tickets_org_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.support_tickets
    ADD CONSTRAINT support_tickets_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.organizations(id);


--
-- Name: task_orders task_orders_contract_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.task_orders
    ADD CONSTRAINT task_orders_contract_id_fkey FOREIGN KEY (contract_id) REFERENCES public.contracts(id) ON DELETE SET NULL;


--
-- Name: task_orders task_orders_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.task_orders
    ADD CONSTRAINT task_orders_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id);


--
-- Name: task_orders task_orders_org_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.task_orders
    ADD CONSTRAINT task_orders_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.organizations(id);


--
-- Name: teaming_agreements teaming_agreements_org_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.teaming_agreements
    ADD CONSTRAINT teaming_agreements_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.organizations(id);


--
-- Name: user_profiles user_profiles_current_org_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_profiles
    ADD CONSTRAINT user_profiles_current_org_id_fkey FOREIGN KEY (current_org_id) REFERENCES public.organizations(id);


--
-- Name: user_profiles user_profiles_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_profiles
    ADD CONSTRAINT user_profiles_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: workflow_history workflow_history_changed_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workflow_history
    ADD CONSTRAINT workflow_history_changed_by_fkey FOREIGN KEY (changed_by) REFERENCES auth.users(id);


--
-- Name: workflow_history workflow_history_task_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workflow_history
    ADD CONSTRAINT workflow_history_task_order_id_fkey FOREIGN KEY (task_order_id) REFERENCES public.task_orders(id) ON DELETE CASCADE;


--
-- Name: agent_settings Admins can manage agent settings; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can manage agent settings" ON public.agent_settings USING ((org_id IN ( SELECT organization_members.org_id
   FROM public.organization_members
  WHERE ((organization_members.user_id = auth.uid()) AND (organization_members.role = ANY (ARRAY['owner'::text, 'admin'::text]))))));


--
-- Name: org_email_domains Admins can manage org email domains; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can manage org email domains" ON public.org_email_domains USING ((org_id IN ( SELECT org_email_domains.org_id
   FROM public.user_profiles
  WHERE ((user_profiles.id = auth.uid()) AND (user_profiles.role = 'admin'::text)))));


--
-- Name: org_sso_providers Admins can manage their org SSO providers; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can manage their org SSO providers" ON public.org_sso_providers USING ((org_id IN ( SELECT user_profiles.current_org_id
   FROM public.user_profiles
  WHERE ((user_profiles.id = auth.uid()) AND ((user_profiles.role = 'admin'::text) OR (user_profiles.is_global_admin = true))))));


--
-- Name: account_usage Admins can read account usage; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can read account usage" ON public.account_usage FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.user_profiles
  WHERE ((user_profiles.id = auth.uid()) AND (user_profiles.is_global_admin = true)))));


--
-- Name: sub_access_log Admins can read all access logs; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can read all access logs" ON public.sub_access_log FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.user_profiles
  WHERE ((user_profiles.id = auth.uid()) AND (user_profiles.is_global_admin = true)))));


--
-- Name: master_subcontractors Admins manage master subs; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins manage master subs" ON public.master_subcontractors TO authenticated USING (public.is_global_admin()) WITH CHECK (public.is_global_admin());


--
-- Name: organizations Allow org creation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Allow org creation" ON public.organizations FOR INSERT WITH CHECK (true);


--
-- Name: org_invitations Allow update invitations; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Allow update invitations" ON public.org_invitations FOR UPDATE USING (true);


--
-- Name: email_tracking Anyone can insert email tracking; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Anyone can insert email tracking" ON public.email_tracking FOR INSERT WITH CHECK (true);


--
-- Name: portal_quote_submissions Anyone can insert portal submissions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Anyone can insert portal submissions" ON public.portal_quote_submissions FOR INSERT WITH CHECK (true);


--
-- Name: subcontractor_questions Anyone can insert questions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Anyone can insert questions" ON public.subcontractor_questions FOR INSERT WITH CHECK (true);


--
-- Name: rfq_tokens Anyone can read rfq tokens; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Anyone can read rfq tokens" ON public.rfq_tokens FOR SELECT USING (true);


--
-- Name: subcontractor_questions Anyone can read shared questions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Anyone can read shared questions" ON public.subcontractor_questions FOR SELECT USING ((shared_with_all = true));


--
-- Name: org_invitations Anyone can view invitations; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Anyone can view invitations" ON public.org_invitations FOR SELECT USING (true);


--
-- Name: master_sub_certifications Auth insert certs; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Auth insert certs" ON public.master_sub_certifications FOR INSERT TO authenticated WITH CHECK (true);


--
-- Name: master_sub_contact_log Auth insert contact log; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Auth insert contact log" ON public.master_sub_contact_log FOR INSERT TO authenticated WITH CHECK (true);


--
-- Name: master_sub_certifications Auth read certs; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Auth read certs" ON public.master_sub_certifications FOR SELECT TO authenticated USING (true);


--
-- Name: master_sub_contact_log Auth read contact log; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Auth read contact log" ON public.master_sub_contact_log FOR SELECT TO authenticated USING (true);


--
-- Name: opportunity_questions Auth users can manage opportunity questions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Auth users can manage opportunity questions" ON public.opportunity_questions USING ((auth.uid() IS NOT NULL));


--
-- Name: question_answer_history Auth users can manage question history; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Auth users can manage question history" ON public.question_answer_history USING ((auth.uid() IS NOT NULL));


--
-- Name: question_submissions Auth users can manage question submissions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Auth users can manage question submissions" ON public.question_submissions USING ((auth.uid() IS NOT NULL));


--
-- Name: subcontractor_questions Auth users can manage questions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Auth users can manage questions" ON public.subcontractor_questions USING ((auth.uid() IS NOT NULL));


--
-- Name: quote_form_fields Auth users can manage quote form fields; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Auth users can manage quote form fields" ON public.quote_form_fields USING ((auth.uid() IS NOT NULL));


--
-- Name: quote_form_templates Auth users can manage quote form templates; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Auth users can manage quote form templates" ON public.quote_form_templates USING ((auth.uid() IS NOT NULL));


--
-- Name: rfq_tokens Auth users can manage rfq tokens; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Auth users can manage rfq tokens" ON public.rfq_tokens USING ((auth.uid() IS NOT NULL));


--
-- Name: email_tracking Auth users can view email tracking; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Auth users can view email tracking" ON public.email_tracking FOR SELECT USING ((auth.uid() IS NOT NULL));


--
-- Name: portal_quote_submissions Auth users can view portal submissions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Auth users can view portal submissions" ON public.portal_quote_submissions FOR SELECT USING ((auth.uid() IS NOT NULL));


--
-- Name: workflow_history Authenticated users can add workflow history; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can add workflow history" ON public.workflow_history FOR INSERT WITH CHECK ((auth.uid() IS NOT NULL));


--
-- Name: contracts Authenticated users can create contracts; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can create contracts" ON public.contracts FOR INSERT WITH CHECK ((auth.uid() IS NOT NULL));


--
-- Name: contracts Authenticated users can delete contracts; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can delete contracts" ON public.contracts FOR DELETE USING ((auth.uid() IS NOT NULL));


--
-- Name: documents Authenticated users can delete documents; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can delete documents" ON public.documents FOR DELETE USING ((auth.uid() IS NOT NULL));


--
-- Name: project_assignments Authenticated users can delete project assignments; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can delete project assignments" ON public.project_assignments FOR DELETE USING ((auth.uid() IS NOT NULL));


--
-- Name: subcontractors Authenticated users can delete subcontractors; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can delete subcontractors" ON public.subcontractors FOR DELETE USING ((auth.uid() IS NOT NULL));


--
-- Name: task_orders Authenticated users can delete task orders; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can delete task orders" ON public.task_orders FOR DELETE USING ((auth.uid() IS NOT NULL));


--
-- Name: audit_events Authenticated users can insert audit events; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can insert audit events" ON public.audit_events FOR INSERT TO authenticated WITH CHECK ((user_id = auth.uid()));


--
-- Name: ai_audit_log Authenticated users can insert audit log; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can insert audit log" ON public.ai_audit_log FOR INSERT TO authenticated WITH CHECK (true);


--
-- Name: documents Authenticated users can insert documents; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can insert documents" ON public.documents FOR INSERT WITH CHECK ((auth.uid() IS NOT NULL));


--
-- Name: subcontractors Authenticated users can insert subcontractors; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can insert subcontractors" ON public.subcontractors FOR INSERT WITH CHECK ((auth.uid() IS NOT NULL));


--
-- Name: task_orders Authenticated users can insert task orders; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can insert task orders" ON public.task_orders FOR INSERT WITH CHECK ((auth.uid() IS NOT NULL));


--
-- Name: project_assignments Authenticated users can manage project assignments; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can manage project assignments" ON public.project_assignments FOR INSERT WITH CHECK ((auth.uid() IS NOT NULL));


--
-- Name: ai_audit_log Authenticated users can read audit log; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can read audit log" ON public.ai_audit_log FOR SELECT TO authenticated USING (true);


--
-- Name: contracts Authenticated users can update contracts; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can update contracts" ON public.contracts FOR UPDATE USING ((auth.uid() IS NOT NULL));


--
-- Name: project_assignments Authenticated users can update project assignments; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can update project assignments" ON public.project_assignments FOR UPDATE USING ((auth.uid() IS NOT NULL));


--
-- Name: subcontractors Authenticated users can update subcontractors; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can update subcontractors" ON public.subcontractors FOR UPDATE USING ((auth.uid() IS NOT NULL));


--
-- Name: task_orders Authenticated users can update task orders; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can update task orders" ON public.task_orders FOR UPDATE USING ((auth.uid() IS NOT NULL));


--
-- Name: documents Authenticated users can view documents; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can view documents" ON public.documents FOR SELECT USING ((auth.uid() IS NOT NULL));


--
-- Name: subcontractors Authenticated users can view subcontractors; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can view subcontractors" ON public.subcontractors FOR SELECT USING ((auth.uid() IS NOT NULL));


--
-- Name: task_orders Authenticated users can view task orders; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can view task orders" ON public.task_orders FOR SELECT USING ((auth.uid() IS NOT NULL));


--
-- Name: master_subcontractors Claimed subs can update their own profile; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Claimed subs can update their own profile" ON public.master_subcontractors FOR UPDATE USING ((claimed_by_user_id = auth.uid())) WITH CHECK ((claimed_by_user_id = auth.uid()));


--
-- Name: audit_events Global admins can view all audit events; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Global admins can view all audit events" ON public.audit_events FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.user_profiles
  WHERE ((user_profiles.id = auth.uid()) AND (user_profiles.is_global_admin = true)))));


--
-- Name: master_subcontractors Only admins can read raw master_subcontractors; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Only admins can read raw master_subcontractors" ON public.master_subcontractors FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.user_profiles
  WHERE ((user_profiles.id = auth.uid()) AND (user_profiles.is_global_admin = true)))));


--
-- Name: audit_events Org admins can view their org audit events; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Org admins can view their org audit events" ON public.audit_events FOR SELECT USING ((org_id IN ( SELECT user_profiles.current_org_id
   FROM public.user_profiles
  WHERE ((user_profiles.id = auth.uid()) AND (user_profiles.role = 'admin'::text)))));


--
-- Name: org_invitations Org owners/admins can create invitations; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Org owners/admins can create invitations" ON public.org_invitations FOR INSERT WITH CHECK ((org_id IN ( SELECT om.org_id
   FROM public.organization_members om
  WHERE ((om.user_id = auth.uid()) AND (om.role = ANY (ARRAY['owner'::text, 'admin'::text]))))));


--
-- Name: org_invitations Org owners/admins can delete invitations; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Org owners/admins can delete invitations" ON public.org_invitations FOR DELETE USING ((org_id IN ( SELECT om.org_id
   FROM public.organization_members om
  WHERE ((om.user_id = auth.uid()) AND (om.role = ANY (ARRAY['owner'::text, 'admin'::text]))))));


--
-- Name: organization_members Org owners/admins can manage members; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Org owners/admins can manage members" ON public.organization_members FOR INSERT WITH CHECK ((org_id IN ( SELECT om.org_id
   FROM public.organization_members om
  WHERE ((om.user_id = auth.uid()) AND (om.role = ANY (ARRAY['owner'::text, 'admin'::text]))))));


--
-- Name: organization_members Org owners/admins can remove members; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Org owners/admins can remove members" ON public.organization_members FOR DELETE USING (((org_id IN ( SELECT om.org_id
   FROM public.organization_members om
  WHERE ((om.user_id = auth.uid()) AND (om.role = ANY (ARRAY['owner'::text, 'admin'::text]))))) OR (user_id = auth.uid())));


--
-- Name: organization_members Org owners/admins can update members; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Org owners/admins can update members" ON public.organization_members FOR UPDATE USING ((org_id IN ( SELECT om.org_id
   FROM public.organization_members om
  WHERE ((om.user_id = auth.uid()) AND (om.role = ANY (ARRAY['owner'::text, 'admin'::text]))))));


--
-- Name: organizations Org owners/admins can update their organization; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Org owners/admins can update their organization" ON public.organizations FOR UPDATE USING ((id IN ( SELECT organization_members.org_id
   FROM public.organization_members
  WHERE ((organization_members.user_id = auth.uid()) AND (organization_members.role = ANY (ARRAY['owner'::text, 'admin'::text]))))));


--
-- Name: opportunity_questions Portal users can insert opportunity questions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Portal users can insert opportunity questions" ON public.opportunity_questions FOR INSERT WITH CHECK (true);


--
-- Name: opportunity_questions Portal users can read own questions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Portal users can read own questions" ON public.opportunity_questions FOR SELECT USING (true);


--
-- Name: notifications Service role can insert notifications; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Service role can insert notifications" ON public.notifications FOR INSERT WITH CHECK (true);


--
-- Name: master_sub_certifications Service role certs; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Service role certs" ON public.master_sub_certifications TO service_role USING (true) WITH CHECK (true);


--
-- Name: master_sub_contact_log Service role contact log; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Service role contact log" ON public.master_sub_contact_log TO service_role USING (true) WITH CHECK (true);


--
-- Name: ai_audit_log Service role full access; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Service role full access" ON public.ai_audit_log TO service_role USING (true) WITH CHECK (true);


--
-- Name: database_hygiene_log Service role full access hygiene log; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Service role full access hygiene log" ON public.database_hygiene_log USING (true) WITH CHECK (true);


--
-- Name: account_usage Service role full access on account_usage; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Service role full access on account_usage" ON public.account_usage TO service_role USING (true) WITH CHECK (true);


--
-- Name: email_suppression_list Service role full access suppression; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Service role full access suppression" ON public.email_suppression_list USING (true) WITH CHECK (true);


--
-- Name: master_subcontractors Service role master subs; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Service role master subs" ON public.master_subcontractors TO service_role USING (true) WITH CHECK (true);


--
-- Name: org_invitations System can update invitations on accept; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "System can update invitations on accept" ON public.org_invitations FOR UPDATE USING (true);


--
-- Name: sub_connections Users can insert connections; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can insert connections" ON public.sub_connections FOR INSERT WITH CHECK (true);


--
-- Name: sub_connections Users can insert connections for their org (trigger enforces li; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can insert connections for their org (trigger enforces li" ON public.sub_connections FOR INSERT TO authenticated WITH CHECK (((user_id = auth.uid()) AND (org_id = ( SELECT user_profiles.current_org_id
   FROM public.user_profiles
  WHERE (user_profiles.id = auth.uid())))));


--
-- Name: sub_access_log Users can insert their own access logs; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can insert their own access logs" ON public.sub_access_log FOR INSERT TO authenticated WITH CHECK ((user_id = auth.uid()));


--
-- Name: project_key_personnel Users can manage project key personnel; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can manage project key personnel" ON public.project_key_personnel TO authenticated USING ((task_order_id IN ( SELECT task_orders.id
   FROM public.task_orders
  WHERE (task_orders.org_id IN ( SELECT task_orders.org_id
           FROM public.user_profiles
          WHERE (user_profiles.id = auth.uid())))))) WITH CHECK ((task_order_id IN ( SELECT task_orders.id
   FROM public.task_orders
  WHERE (task_orders.org_id IN ( SELECT task_orders.org_id
           FROM public.user_profiles
          WHERE (user_profiles.id = auth.uid()))))));


--
-- Name: project_past_performance Users can manage project past performance links; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can manage project past performance links" ON public.project_past_performance TO authenticated USING ((task_order_id IN ( SELECT task_orders.id
   FROM public.task_orders
  WHERE (task_orders.org_id IN ( SELECT task_orders.org_id
           FROM public.user_profiles
          WHERE (user_profiles.id = auth.uid())))))) WITH CHECK ((task_order_id IN ( SELECT task_orders.id
   FROM public.task_orders
  WHERE (task_orders.org_id IN ( SELECT task_orders.org_id
           FROM public.user_profiles
          WHERE (user_profiles.id = auth.uid()))))));


--
-- Name: notification_preferences Users can manage their notification prefs; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can manage their notification prefs" ON public.notification_preferences USING ((user_id = auth.uid()));


--
-- Name: sb_subcontracting_plans Users can manage their org SB plans; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can manage their org SB plans" ON public.sb_subcontracting_plans TO authenticated USING ((task_order_id IN ( SELECT task_orders.id
   FROM public.task_orders
  WHERE (task_orders.org_id IN ( SELECT task_orders.org_id
           FROM public.user_profiles
          WHERE (user_profiles.id = auth.uid())))))) WITH CHECK ((task_order_id IN ( SELECT task_orders.id
   FROM public.task_orders
  WHERE (task_orders.org_id IN ( SELECT task_orders.org_id
           FROM public.user_profiles
          WHERE (user_profiles.id = auth.uid()))))));


--
-- Name: capture_gates Users can manage their org capture gates; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can manage their org capture gates" ON public.capture_gates TO authenticated USING ((task_order_id IN ( SELECT task_orders.id
   FROM public.task_orders
  WHERE (task_orders.org_id IN ( SELECT task_orders.org_id
           FROM public.user_profiles
          WHERE (user_profiles.id = auth.uid())))))) WITH CHECK ((task_order_id IN ( SELECT task_orders.id
   FROM public.task_orders
  WHERE (task_orders.org_id IN ( SELECT task_orders.org_id
           FROM public.user_profiles
          WHERE (user_profiles.id = auth.uid()))))));


--
-- Name: color_team_reviews Users can manage their org color team reviews; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can manage their org color team reviews" ON public.color_team_reviews TO authenticated USING ((task_order_id IN ( SELECT task_orders.id
   FROM public.task_orders
  WHERE (task_orders.org_id IN ( SELECT task_orders.org_id
           FROM public.user_profiles
          WHERE (user_profiles.id = auth.uid())))))) WITH CHECK ((task_order_id IN ( SELECT task_orders.id
   FROM public.task_orders
  WHERE (task_orders.org_id IN ( SELECT task_orders.org_id
           FROM public.user_profiles
          WHERE (user_profiles.id = auth.uid()))))));


--
-- Name: contract_vehicles Users can manage their org contract vehicles; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can manage their org contract vehicles" ON public.contract_vehicles TO authenticated USING ((org_id IN ( SELECT contract_vehicles.org_id
   FROM public.user_profiles
  WHERE (user_profiles.id = auth.uid())))) WITH CHECK ((org_id IN ( SELECT contract_vehicles.org_id
   FROM public.user_profiles
  WHERE (user_profiles.id = auth.uid()))));


--
-- Name: cpars_ratings Users can manage their org cpars ratings; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can manage their org cpars ratings" ON public.cpars_ratings TO authenticated USING ((org_id IN ( SELECT cpars_ratings.org_id
   FROM public.user_profiles
  WHERE (user_profiles.id = auth.uid())))) WITH CHECK ((org_id IN ( SELECT cpars_ratings.org_id
   FROM public.user_profiles
  WHERE (user_profiles.id = auth.uid()))));


--
-- Name: gate_templates Users can manage their org gate templates; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can manage their org gate templates" ON public.gate_templates TO authenticated USING ((org_id IN ( SELECT gate_templates.org_id
   FROM public.user_profiles
  WHERE (user_profiles.id = auth.uid())))) WITH CHECK ((org_id IN ( SELECT gate_templates.org_id
   FROM public.user_profiles
  WHERE (user_profiles.id = auth.uid()))));


--
-- Name: key_personnel Users can manage their org key personnel; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can manage their org key personnel" ON public.key_personnel TO authenticated USING ((org_id IN ( SELECT key_personnel.org_id
   FROM public.user_profiles
  WHERE (user_profiles.id = auth.uid())))) WITH CHECK ((org_id IN ( SELECT key_personnel.org_id
   FROM public.user_profiles
  WHERE (user_profiles.id = auth.uid()))));


--
-- Name: labor_categories Users can manage their org labor categories; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can manage their org labor categories" ON public.labor_categories TO authenticated USING ((org_id IN ( SELECT labor_categories.org_id
   FROM public.user_profiles
  WHERE (user_profiles.id = auth.uid())))) WITH CHECK ((org_id IN ( SELECT labor_categories.org_id
   FROM public.user_profiles
  WHERE (user_profiles.id = auth.uid()))));


--
-- Name: past_performance_citations Users can manage their org past performance; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can manage their org past performance" ON public.past_performance_citations TO authenticated USING ((org_id IN ( SELECT past_performance_citations.org_id
   FROM public.user_profiles
  WHERE (user_profiles.id = auth.uid())))) WITH CHECK ((org_id IN ( SELECT past_performance_citations.org_id
   FROM public.user_profiles
  WHERE (user_profiles.id = auth.uid()))));


--
-- Name: notifications Users can read own org notifications; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can read own org notifications" ON public.notifications FOR SELECT USING ((org_id IN ( SELECT organization_members.org_id
   FROM public.organization_members
  WHERE (organization_members.user_id = auth.uid()))));


--
-- Name: sub_connections Users can read their org connections; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can read their org connections" ON public.sub_connections FOR SELECT TO authenticated USING ((org_id = ( SELECT user_profiles.current_org_id
   FROM public.user_profiles
  WHERE (user_profiles.id = auth.uid()))));


--
-- Name: agent_actions Users can update agent actions assigned to them; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update agent actions assigned to them" ON public.agent_actions FOR UPDATE USING (((assigned_to = auth.uid()) OR (org_id IN ( SELECT organization_members.org_id
   FROM public.organization_members
  WHERE ((organization_members.user_id = auth.uid()) AND (organization_members.role = ANY (ARRAY['owner'::text, 'admin'::text])))))));


--
-- Name: notifications Users can update own org notifications; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update own org notifications" ON public.notifications FOR UPDATE USING ((org_id IN ( SELECT organization_members.org_id
   FROM public.organization_members
  WHERE (organization_members.user_id = auth.uid()))));


--
-- Name: user_profiles Users can update own profile; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update own profile" ON public.user_profiles FOR UPDATE USING ((auth.uid() = id));


--
-- Name: agent_actions Users can view agent actions for their org; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view agent actions for their org" ON public.agent_actions FOR SELECT USING ((org_id IN ( SELECT organization_members.org_id
   FROM public.organization_members
  WHERE (organization_members.user_id = auth.uid()))));


--
-- Name: agent_settings Users can view agent settings for their org; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view agent settings for their org" ON public.agent_settings FOR SELECT USING ((org_id IN ( SELECT organization_members.org_id
   FROM public.organization_members
  WHERE (organization_members.user_id = auth.uid()))));


--
-- Name: contracts Users can view contracts in their org; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view contracts in their org" ON public.contracts FOR SELECT USING ((org_id IN ( SELECT organization_members.org_id
   FROM public.organization_members
  WHERE (organization_members.user_id = auth.uid()))));


--
-- Name: organization_members Users can view members of their orgs; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view members of their orgs" ON public.organization_members FOR SELECT USING ((org_id IN ( SELECT public.get_user_org_ids(auth.uid()) AS get_user_org_ids)));


--
-- Name: project_assignments Users can view project assignments; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view project assignments" ON public.project_assignments FOR SELECT USING ((task_order_id IN ( SELECT task_orders.id
   FROM public.task_orders)));


--
-- Name: sub_connections Users can view their org connections; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view their org connections" ON public.sub_connections FOR SELECT USING (true);


--
-- Name: org_email_domains Users can view their org email domains; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view their org email domains" ON public.org_email_domains FOR SELECT USING ((org_id IN ( SELECT org_email_domains.org_id
   FROM public.user_profiles
  WHERE (user_profiles.id = auth.uid()))));


--
-- Name: organizations Users can view their organizations; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view their organizations" ON public.organizations FOR SELECT USING ((id IN ( SELECT organization_members.org_id
   FROM public.organization_members
  WHERE (organization_members.user_id = auth.uid()))));


--
-- Name: workflow_history Users can view workflow history for accessible projects; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view workflow history for accessible projects" ON public.workflow_history FOR SELECT USING ((task_order_id IN ( SELECT task_orders.id
   FROM public.task_orders)));


--
-- Name: user_profiles Users read own, same-org, or admin; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users read own, same-org, or admin" ON public.user_profiles FOR SELECT TO authenticated USING (((id = auth.uid()) OR public.is_global_admin() OR public.shares_org_with(id)));


--
-- Name: account_usage; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.account_usage ENABLE ROW LEVEL SECURITY;

--
-- Name: account_usage account_usage_org_access; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY account_usage_org_access ON public.account_usage USING ((org_id IN ( SELECT user_profiles.current_org_id
   FROM public.user_profiles
  WHERE (user_profiles.id = auth.uid())))) WITH CHECK ((org_id IN ( SELECT user_profiles.current_org_id
   FROM public.user_profiles
  WHERE (user_profiles.id = auth.uid()))));


--
-- Name: agent_actions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.agent_actions ENABLE ROW LEVEL SECURITY;

--
-- Name: agent_settings; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.agent_settings ENABLE ROW LEVEL SECURITY;

--
-- Name: ai_audit_log; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.ai_audit_log ENABLE ROW LEVEL SECURITY;

--
-- Name: audit_events; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.audit_events ENABLE ROW LEVEL SECURITY;

--
-- Name: beta_feedback; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.beta_feedback ENABLE ROW LEVEL SECURITY;

--
-- Name: beta_feedback beta_feedback_user_access; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY beta_feedback_user_access ON public.beta_feedback USING ((user_id = auth.uid())) WITH CHECK ((user_id = auth.uid()));


--
-- Name: beta_invitations; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.beta_invitations ENABLE ROW LEVEL SECURITY;

--
-- Name: capture_gates; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.capture_gates ENABLE ROW LEVEL SECURITY;

--
-- Name: color_team_reviews; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.color_team_reviews ENABLE ROW LEVEL SECURITY;

--
-- Name: contacts; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.contacts ENABLE ROW LEVEL SECURITY;

--
-- Name: contacts contacts_org_policy; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY contacts_org_policy ON public.contacts TO authenticated USING ((org_id IN ( SELECT contacts.org_id
   FROM public.user_profiles
  WHERE (user_profiles.id = auth.uid())))) WITH CHECK ((org_id IN ( SELECT contacts.org_id
   FROM public.user_profiles
  WHERE (user_profiles.id = auth.uid()))));


--
-- Name: contract_vehicles; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.contract_vehicles ENABLE ROW LEVEL SECURITY;

--
-- Name: contracts; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.contracts ENABLE ROW LEVEL SECURITY;

--
-- Name: cpars_ratings; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.cpars_ratings ENABLE ROW LEVEL SECURITY;

--
-- Name: database_hygiene_log; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.database_hygiene_log ENABLE ROW LEVEL SECURITY;

--
-- Name: documents docs_org_access; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY docs_org_access ON public.documents USING ((org_id IN ( SELECT user_profiles.current_org_id
   FROM public.user_profiles
  WHERE (user_profiles.id = auth.uid())))) WITH CHECK ((org_id IN ( SELECT user_profiles.current_org_id
   FROM public.user_profiles
  WHERE (user_profiles.id = auth.uid()))));


--
-- Name: documents; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;

--
-- Name: email_delivery_log; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.email_delivery_log ENABLE ROW LEVEL SECURITY;

--
-- Name: email_delivery_log email_delivery_log_org_access; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY email_delivery_log_org_access ON public.email_delivery_log USING ((org_id IN ( SELECT user_profiles.current_org_id
   FROM public.user_profiles
  WHERE (user_profiles.id = auth.uid())))) WITH CHECK ((org_id IN ( SELECT user_profiles.current_org_id
   FROM public.user_profiles
  WHERE (user_profiles.id = auth.uid()))));


--
-- Name: email_suppression_list; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.email_suppression_list ENABLE ROW LEVEL SECURITY;

--
-- Name: email_tracking; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.email_tracking ENABLE ROW LEVEL SECURITY;

--
-- Name: gate_templates; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.gate_templates ENABLE ROW LEVEL SECURITY;

--
-- Name: key_personnel; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.key_personnel ENABLE ROW LEVEL SECURITY;

--
-- Name: labor_categories; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.labor_categories ENABLE ROW LEVEL SECURITY;

--
-- Name: master_sub_certifications; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.master_sub_certifications ENABLE ROW LEVEL SECURITY;

--
-- Name: master_sub_contact_log; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.master_sub_contact_log ENABLE ROW LEVEL SECURITY;

--
-- Name: master_subcontractors; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.master_subcontractors ENABLE ROW LEVEL SECURITY;

--
-- Name: notification_preferences; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.notification_preferences ENABLE ROW LEVEL SECURITY;

--
-- Name: notifications; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

--
-- Name: opportunity_questions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.opportunity_questions ENABLE ROW LEVEL SECURITY;

--
-- Name: org_email_domains; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.org_email_domains ENABLE ROW LEVEL SECURITY;

--
-- Name: org_invitations; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.org_invitations ENABLE ROW LEVEL SECURITY;

--
-- Name: organization_settings org_settings_policy; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY org_settings_policy ON public.organization_settings TO authenticated USING ((org_id IN ( SELECT organization_settings.org_id
   FROM public.user_profiles
  WHERE (user_profiles.id = auth.uid())))) WITH CHECK ((org_id IN ( SELECT organization_settings.org_id
   FROM public.user_profiles
  WHERE (user_profiles.id = auth.uid()))));


--
-- Name: org_sso_providers; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.org_sso_providers ENABLE ROW LEVEL SECURITY;

--
-- Name: organization_members; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.organization_members ENABLE ROW LEVEL SECURITY;

--
-- Name: organization_settings; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.organization_settings ENABLE ROW LEVEL SECURITY;

--
-- Name: organizations; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;

--
-- Name: partner_payouts; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.partner_payouts ENABLE ROW LEVEL SECURITY;

--
-- Name: past_performance_citations; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.past_performance_citations ENABLE ROW LEVEL SECURITY;

--
-- Name: portal_quote_submissions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.portal_quote_submissions ENABLE ROW LEVEL SECURITY;

--
-- Name: project_assignments; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.project_assignments ENABLE ROW LEVEL SECURITY;

--
-- Name: project_comments; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.project_comments ENABLE ROW LEVEL SECURITY;

--
-- Name: project_comments project_comments_org_policy; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY project_comments_org_policy ON public.project_comments TO authenticated USING ((org_id IN ( SELECT project_comments.org_id
   FROM public.user_profiles
  WHERE (user_profiles.id = auth.uid())))) WITH CHECK ((org_id IN ( SELECT project_comments.org_id
   FROM public.user_profiles
  WHERE (user_profiles.id = auth.uid()))));


--
-- Name: project_contacts; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.project_contacts ENABLE ROW LEVEL SECURITY;

--
-- Name: project_contacts project_contacts_org_policy; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY project_contacts_org_policy ON public.project_contacts TO authenticated USING ((project_id IN ( SELECT task_orders.id
   FROM public.task_orders
  WHERE (task_orders.org_id IN ( SELECT task_orders.org_id
           FROM public.user_profiles
          WHERE (user_profiles.id = auth.uid())))))) WITH CHECK ((project_id IN ( SELECT task_orders.id
   FROM public.task_orders
  WHERE (task_orders.org_id IN ( SELECT task_orders.org_id
           FROM public.user_profiles
          WHERE (user_profiles.id = auth.uid()))))));


--
-- Name: project_key_personnel; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.project_key_personnel ENABLE ROW LEVEL SECURITY;

--
-- Name: project_past_performance; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.project_past_performance ENABLE ROW LEVEL SECURITY;

--
-- Name: project_subcontractors; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.project_subcontractors ENABLE ROW LEVEL SECURITY;

--
-- Name: project_subcontractors project_subs_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY project_subs_delete ON public.project_subcontractors FOR DELETE TO authenticated USING (true);


--
-- Name: project_subcontractors project_subs_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY project_subs_insert ON public.project_subcontractors FOR INSERT TO authenticated WITH CHECK (true);


--
-- Name: project_subcontractors project_subs_org_access; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY project_subs_org_access ON public.project_subcontractors USING ((org_id IN ( SELECT user_profiles.current_org_id
   FROM public.user_profiles
  WHERE (user_profiles.id = auth.uid())))) WITH CHECK ((org_id IN ( SELECT user_profiles.current_org_id
   FROM public.user_profiles
  WHERE (user_profiles.id = auth.uid()))));


--
-- Name: project_subcontractors project_subs_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY project_subs_select ON public.project_subcontractors FOR SELECT TO authenticated USING (true);


--
-- Name: project_subcontractors project_subs_service_role; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY project_subs_service_role ON public.project_subcontractors TO service_role USING (true);


--
-- Name: project_subcontractors project_subs_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY project_subs_update ON public.project_subcontractors FOR UPDATE TO authenticated USING (true);


--
-- Name: project_tasks; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.project_tasks ENABLE ROW LEVEL SECURITY;

--
-- Name: project_tasks project_tasks_org_policy; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY project_tasks_org_policy ON public.project_tasks TO authenticated USING ((org_id IN ( SELECT project_tasks.org_id
   FROM public.user_profiles
  WHERE (user_profiles.id = auth.uid())))) WITH CHECK ((org_id IN ( SELECT project_tasks.org_id
   FROM public.user_profiles
  WHERE (user_profiles.id = auth.uid()))));


--
-- Name: question_answer_history; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.question_answer_history ENABLE ROW LEVEL SECURITY;

--
-- Name: question_submissions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.question_submissions ENABLE ROW LEVEL SECURITY;

--
-- Name: quote_form_fields; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.quote_form_fields ENABLE ROW LEVEL SECURITY;

--
-- Name: quote_form_templates; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.quote_form_templates ENABLE ROW LEVEL SECURITY;

--
-- Name: referral_partners; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.referral_partners ENABLE ROW LEVEL SECURITY;

--
-- Name: referral_signups; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.referral_signups ENABLE ROW LEVEL SECURITY;

--
-- Name: rfq_tokens; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.rfq_tokens ENABLE ROW LEVEL SECURITY;

--
-- Name: sb_subcontracting_plans; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.sb_subcontracting_plans ENABLE ROW LEVEL SECURITY;

--
-- Name: account_usage service_role_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY service_role_all ON public.account_usage TO service_role USING (true) WITH CHECK (true);


--
-- Name: partner_payouts service_role_all_partner_payouts; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY service_role_all_partner_payouts ON public.partner_payouts TO service_role USING (true) WITH CHECK (true);


--
-- Name: referral_partners service_role_all_referral_partners; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY service_role_all_referral_partners ON public.referral_partners TO service_role USING (true) WITH CHECK (true);


--
-- Name: referral_signups service_role_all_referral_signups; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY service_role_all_referral_signups ON public.referral_signups TO service_role USING (true) WITH CHECK (true);


--
-- Name: sow_communications; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.sow_communications ENABLE ROW LEVEL SECURITY;

--
-- Name: sow_communications sow_communications_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY sow_communications_all ON public.sow_communications TO authenticated USING (true) WITH CHECK (true);


--
-- Name: sow_items; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.sow_items ENABLE ROW LEVEL SECURITY;

--
-- Name: sow_items sow_items_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY sow_items_all ON public.sow_items TO authenticated USING (true) WITH CHECK (true);


--
-- Name: sow_quotes; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.sow_quotes ENABLE ROW LEVEL SECURITY;

--
-- Name: sow_quotes sow_quotes_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY sow_quotes_all ON public.sow_quotes TO authenticated USING (true) WITH CHECK (true);


--
-- Name: sow_subcontractors; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.sow_subcontractors ENABLE ROW LEVEL SECURITY;

--
-- Name: sow_subcontractors sow_subcontractors_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY sow_subcontractors_all ON public.sow_subcontractors TO authenticated USING (true) WITH CHECK (true);


--
-- Name: sow_subcontractors sow_subs_org_access; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY sow_subs_org_access ON public.sow_subcontractors USING ((org_id IN ( SELECT user_profiles.current_org_id
   FROM public.user_profiles
  WHERE (user_profiles.id = auth.uid())))) WITH CHECK ((org_id IN ( SELECT user_profiles.current_org_id
   FROM public.user_profiles
  WHERE (user_profiles.id = auth.uid()))));


--
-- Name: sub_access_log; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.sub_access_log ENABLE ROW LEVEL SECURITY;

--
-- Name: sub_connections; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.sub_connections ENABLE ROW LEVEL SECURITY;

--
-- Name: subcontractor_questions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.subcontractor_questions ENABLE ROW LEVEL SECURITY;

--
-- Name: subcontractors; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.subcontractors ENABLE ROW LEVEL SECURITY;

--
-- Name: support_tickets; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.support_tickets ENABLE ROW LEVEL SECURITY;

--
-- Name: support_tickets support_tickets_org_access; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY support_tickets_org_access ON public.support_tickets USING ((org_id IN ( SELECT user_profiles.current_org_id
   FROM public.user_profiles
  WHERE (user_profiles.id = auth.uid())))) WITH CHECK ((org_id IN ( SELECT user_profiles.current_org_id
   FROM public.user_profiles
  WHERE (user_profiles.id = auth.uid()))));


--
-- Name: task_orders; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.task_orders ENABLE ROW LEVEL SECURITY;

--
-- Name: teaming_agreements; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.teaming_agreements ENABLE ROW LEVEL SECURITY;

--
-- Name: teaming_agreements teaming_org_access; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY teaming_org_access ON public.teaming_agreements USING ((org_id IN ( SELECT user_profiles.current_org_id
   FROM public.user_profiles
  WHERE (user_profiles.id = auth.uid())))) WITH CHECK ((org_id IN ( SELECT user_profiles.current_org_id
   FROM public.user_profiles
  WHERE (user_profiles.id = auth.uid()))));


--
-- Name: user_profiles; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;

--
-- Name: workflow_history; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.workflow_history ENABLE ROW LEVEL SECURITY;

--
-- Name: SCHEMA public; Type: ACL; Schema: -; Owner: -
--

GRANT USAGE ON SCHEMA public TO postgres;
GRANT USAGE ON SCHEMA public TO anon;
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT USAGE ON SCHEMA public TO service_role;


--
-- Name: FUNCTION archive_no_email_records(batch_limit integer); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.archive_no_email_records(batch_limit integer) TO anon;
GRANT ALL ON FUNCTION public.archive_no_email_records(batch_limit integer) TO authenticated;
GRANT ALL ON FUNCTION public.archive_no_email_records(batch_limit integer) TO service_role;


--
-- Name: FUNCTION check_search_rate_limit(p_user_id uuid, p_org_id uuid); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.check_search_rate_limit(p_user_id uuid, p_org_id uuid) TO anon;
GRANT ALL ON FUNCTION public.check_search_rate_limit(p_user_id uuid, p_org_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.check_search_rate_limit(p_user_id uuid, p_org_id uuid) TO service_role;


--
-- Name: FUNCTION enforce_connection_limit(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.enforce_connection_limit() TO anon;
GRANT ALL ON FUNCTION public.enforce_connection_limit() TO authenticated;
GRANT ALL ON FUNCTION public.enforce_connection_limit() TO service_role;


--
-- Name: FUNCTION ensure_user_org(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.ensure_user_org() TO anon;
GRANT ALL ON FUNCTION public.ensure_user_org() TO authenticated;
GRANT ALL ON FUNCTION public.ensure_user_org() TO service_role;


--
-- Name: FUNCTION freeze_connections_on_churn(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.freeze_connections_on_churn() TO anon;
GRANT ALL ON FUNCTION public.freeze_connections_on_churn() TO authenticated;
GRANT ALL ON FUNCTION public.freeze_connections_on_churn() TO service_role;


--
-- Name: FUNCTION get_org_plan(target_org_id uuid); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.get_org_plan(target_org_id uuid) TO anon;
GRANT ALL ON FUNCTION public.get_org_plan(target_org_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.get_org_plan(target_org_id uuid) TO service_role;


--
-- Name: FUNCTION get_org_status(target_org_id uuid); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.get_org_status(target_org_id uuid) TO anon;
GRANT ALL ON FUNCTION public.get_org_status(target_org_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.get_org_status(target_org_id uuid) TO service_role;


--
-- Name: FUNCTION get_sub_search_limit(p_user_id uuid, p_org_id uuid); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.get_sub_search_limit(p_user_id uuid, p_org_id uuid) TO anon;
GRANT ALL ON FUNCTION public.get_sub_search_limit(p_user_id uuid, p_org_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.get_sub_search_limit(p_user_id uuid, p_org_id uuid) TO service_role;


--
-- Name: FUNCTION get_user_org_ids(uid uuid); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.get_user_org_ids(uid uuid) TO anon;
GRANT ALL ON FUNCTION public.get_user_org_ids(uid uuid) TO authenticated;
GRANT ALL ON FUNCTION public.get_user_org_ids(uid uuid) TO service_role;


--
-- Name: FUNCTION handle_new_user(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.handle_new_user() TO anon;
GRANT ALL ON FUNCTION public.handle_new_user() TO authenticated;
GRANT ALL ON FUNCTION public.handle_new_user() TO service_role;


--
-- Name: FUNCTION increment_master_sub_field(row_id uuid, field_name text); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.increment_master_sub_field(row_id uuid, field_name text) TO anon;
GRANT ALL ON FUNCTION public.increment_master_sub_field(row_id uuid, field_name text) TO authenticated;
GRANT ALL ON FUNCTION public.increment_master_sub_field(row_id uuid, field_name text) TO service_role;


--
-- Name: FUNCTION increment_match_count(sub_id uuid); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.increment_match_count(sub_id uuid) TO anon;
GRANT ALL ON FUNCTION public.increment_match_count(sub_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.increment_match_count(sub_id uuid) TO service_role;


--
-- Name: FUNCTION is_connected_to_sub(p_sub_id uuid); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.is_connected_to_sub(p_sub_id uuid) TO anon;
GRANT ALL ON FUNCTION public.is_connected_to_sub(p_sub_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.is_connected_to_sub(p_sub_id uuid) TO service_role;


--
-- Name: FUNCTION is_global_admin(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.is_global_admin() TO anon;
GRANT ALL ON FUNCTION public.is_global_admin() TO authenticated;
GRANT ALL ON FUNCTION public.is_global_admin() TO service_role;


--
-- Name: FUNCTION purge_auth_user_by_email(target_email text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.purge_auth_user_by_email(target_email text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.purge_auth_user_by_email(target_email text) TO service_role;


--
-- Name: FUNCTION shares_org_with(target_user uuid); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.shares_org_with(target_user uuid) TO anon;
GRANT ALL ON FUNCTION public.shares_org_with(target_user uuid) TO authenticated;
GRANT ALL ON FUNCTION public.shares_org_with(target_user uuid) TO service_role;


--
-- Name: TABLE account_usage; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.account_usage TO anon;
GRANT ALL ON TABLE public.account_usage TO authenticated;
GRANT ALL ON TABLE public.account_usage TO service_role;


--
-- Name: TABLE agent_actions; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.agent_actions TO anon;
GRANT ALL ON TABLE public.agent_actions TO authenticated;
GRANT ALL ON TABLE public.agent_actions TO service_role;


--
-- Name: TABLE agent_settings; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.agent_settings TO anon;
GRANT ALL ON TABLE public.agent_settings TO authenticated;
GRANT ALL ON TABLE public.agent_settings TO service_role;


--
-- Name: TABLE ai_audit_log; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.ai_audit_log TO anon;
GRANT ALL ON TABLE public.ai_audit_log TO authenticated;
GRANT ALL ON TABLE public.ai_audit_log TO service_role;


--
-- Name: TABLE audit_events; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.audit_events TO anon;
GRANT ALL ON TABLE public.audit_events TO authenticated;
GRANT ALL ON TABLE public.audit_events TO service_role;


--
-- Name: TABLE beta_feedback; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.beta_feedback TO anon;
GRANT ALL ON TABLE public.beta_feedback TO authenticated;
GRANT ALL ON TABLE public.beta_feedback TO service_role;


--
-- Name: TABLE beta_invitations; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.beta_invitations TO anon;
GRANT ALL ON TABLE public.beta_invitations TO authenticated;
GRANT ALL ON TABLE public.beta_invitations TO service_role;


--
-- Name: TABLE capture_gates; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.capture_gates TO anon;
GRANT ALL ON TABLE public.capture_gates TO authenticated;
GRANT ALL ON TABLE public.capture_gates TO service_role;


--
-- Name: TABLE color_team_reviews; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.color_team_reviews TO anon;
GRANT ALL ON TABLE public.color_team_reviews TO authenticated;
GRANT ALL ON TABLE public.color_team_reviews TO service_role;


--
-- Name: TABLE contacts; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.contacts TO anon;
GRANT ALL ON TABLE public.contacts TO authenticated;
GRANT ALL ON TABLE public.contacts TO service_role;


--
-- Name: TABLE contract_vehicles; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.contract_vehicles TO anon;
GRANT ALL ON TABLE public.contract_vehicles TO authenticated;
GRANT ALL ON TABLE public.contract_vehicles TO service_role;


--
-- Name: TABLE contracts; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.contracts TO anon;
GRANT ALL ON TABLE public.contracts TO authenticated;
GRANT ALL ON TABLE public.contracts TO service_role;


--
-- Name: TABLE cpars_ratings; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.cpars_ratings TO anon;
GRANT ALL ON TABLE public.cpars_ratings TO authenticated;
GRANT ALL ON TABLE public.cpars_ratings TO service_role;


--
-- Name: TABLE database_hygiene_log; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.database_hygiene_log TO anon;
GRANT ALL ON TABLE public.database_hygiene_log TO authenticated;
GRANT ALL ON TABLE public.database_hygiene_log TO service_role;


--
-- Name: TABLE documents; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.documents TO anon;
GRANT ALL ON TABLE public.documents TO authenticated;
GRANT ALL ON TABLE public.documents TO service_role;


--
-- Name: TABLE email_delivery_log; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.email_delivery_log TO anon;
GRANT ALL ON TABLE public.email_delivery_log TO authenticated;
GRANT ALL ON TABLE public.email_delivery_log TO service_role;


--
-- Name: TABLE email_suppression_list; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.email_suppression_list TO anon;
GRANT ALL ON TABLE public.email_suppression_list TO authenticated;
GRANT ALL ON TABLE public.email_suppression_list TO service_role;


--
-- Name: TABLE email_tracking; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.email_tracking TO anon;
GRANT ALL ON TABLE public.email_tracking TO authenticated;
GRANT ALL ON TABLE public.email_tracking TO service_role;


--
-- Name: TABLE gate_templates; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.gate_templates TO anon;
GRANT ALL ON TABLE public.gate_templates TO authenticated;
GRANT ALL ON TABLE public.gate_templates TO service_role;


--
-- Name: TABLE key_personnel; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.key_personnel TO anon;
GRANT ALL ON TABLE public.key_personnel TO authenticated;
GRANT ALL ON TABLE public.key_personnel TO service_role;


--
-- Name: TABLE labor_categories; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.labor_categories TO anon;
GRANT ALL ON TABLE public.labor_categories TO authenticated;
GRANT ALL ON TABLE public.labor_categories TO service_role;


--
-- Name: TABLE master_sub_certifications; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.master_sub_certifications TO anon;
GRANT ALL ON TABLE public.master_sub_certifications TO authenticated;
GRANT ALL ON TABLE public.master_sub_certifications TO service_role;


--
-- Name: TABLE master_sub_contact_log; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.master_sub_contact_log TO anon;
GRANT ALL ON TABLE public.master_sub_contact_log TO authenticated;
GRANT ALL ON TABLE public.master_sub_contact_log TO service_role;


--
-- Name: TABLE master_subcontractors; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,DELETE,MAINTAIN,UPDATE ON TABLE public.master_subcontractors TO authenticated;
GRANT ALL ON TABLE public.master_subcontractors TO service_role;


--
-- Name: TABLE master_subcontractors_safe; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.master_subcontractors_safe TO anon;
GRANT ALL ON TABLE public.master_subcontractors_safe TO authenticated;
GRANT ALL ON TABLE public.master_subcontractors_safe TO service_role;


--
-- Name: TABLE notification_preferences; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.notification_preferences TO anon;
GRANT ALL ON TABLE public.notification_preferences TO authenticated;
GRANT ALL ON TABLE public.notification_preferences TO service_role;


--
-- Name: TABLE notifications; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.notifications TO anon;
GRANT ALL ON TABLE public.notifications TO authenticated;
GRANT ALL ON TABLE public.notifications TO service_role;


--
-- Name: TABLE opportunity_questions; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.opportunity_questions TO anon;
GRANT ALL ON TABLE public.opportunity_questions TO authenticated;
GRANT ALL ON TABLE public.opportunity_questions TO service_role;


--
-- Name: TABLE org_email_domains; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.org_email_domains TO anon;
GRANT ALL ON TABLE public.org_email_domains TO authenticated;
GRANT ALL ON TABLE public.org_email_domains TO service_role;


--
-- Name: TABLE org_invitations; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.org_invitations TO anon;
GRANT ALL ON TABLE public.org_invitations TO authenticated;
GRANT ALL ON TABLE public.org_invitations TO service_role;


--
-- Name: TABLE org_sso_providers; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.org_sso_providers TO anon;
GRANT ALL ON TABLE public.org_sso_providers TO authenticated;
GRANT ALL ON TABLE public.org_sso_providers TO service_role;


--
-- Name: TABLE organization_members; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.organization_members TO anon;
GRANT ALL ON TABLE public.organization_members TO authenticated;
GRANT ALL ON TABLE public.organization_members TO service_role;


--
-- Name: TABLE organization_settings; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.organization_settings TO anon;
GRANT ALL ON TABLE public.organization_settings TO authenticated;
GRANT ALL ON TABLE public.organization_settings TO service_role;


--
-- Name: TABLE organizations; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.organizations TO anon;
GRANT ALL ON TABLE public.organizations TO authenticated;
GRANT ALL ON TABLE public.organizations TO service_role;


--
-- Name: TABLE partner_payouts; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.partner_payouts TO anon;
GRANT ALL ON TABLE public.partner_payouts TO authenticated;
GRANT ALL ON TABLE public.partner_payouts TO service_role;


--
-- Name: TABLE past_performance_citations; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.past_performance_citations TO anon;
GRANT ALL ON TABLE public.past_performance_citations TO authenticated;
GRANT ALL ON TABLE public.past_performance_citations TO service_role;


--
-- Name: TABLE portal_quote_submissions; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.portal_quote_submissions TO anon;
GRANT ALL ON TABLE public.portal_quote_submissions TO authenticated;
GRANT ALL ON TABLE public.portal_quote_submissions TO service_role;


--
-- Name: TABLE project_assignments; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.project_assignments TO anon;
GRANT ALL ON TABLE public.project_assignments TO authenticated;
GRANT ALL ON TABLE public.project_assignments TO service_role;


--
-- Name: TABLE project_comments; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.project_comments TO anon;
GRANT ALL ON TABLE public.project_comments TO authenticated;
GRANT ALL ON TABLE public.project_comments TO service_role;


--
-- Name: TABLE project_contacts; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.project_contacts TO anon;
GRANT ALL ON TABLE public.project_contacts TO authenticated;
GRANT ALL ON TABLE public.project_contacts TO service_role;


--
-- Name: TABLE project_key_personnel; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.project_key_personnel TO anon;
GRANT ALL ON TABLE public.project_key_personnel TO authenticated;
GRANT ALL ON TABLE public.project_key_personnel TO service_role;


--
-- Name: TABLE project_past_performance; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.project_past_performance TO anon;
GRANT ALL ON TABLE public.project_past_performance TO authenticated;
GRANT ALL ON TABLE public.project_past_performance TO service_role;


--
-- Name: TABLE project_subcontractors; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.project_subcontractors TO anon;
GRANT ALL ON TABLE public.project_subcontractors TO authenticated;
GRANT ALL ON TABLE public.project_subcontractors TO service_role;


--
-- Name: TABLE project_tasks; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.project_tasks TO anon;
GRANT ALL ON TABLE public.project_tasks TO authenticated;
GRANT ALL ON TABLE public.project_tasks TO service_role;


--
-- Name: TABLE question_answer_history; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.question_answer_history TO anon;
GRANT ALL ON TABLE public.question_answer_history TO authenticated;
GRANT ALL ON TABLE public.question_answer_history TO service_role;


--
-- Name: TABLE question_submissions; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.question_submissions TO anon;
GRANT ALL ON TABLE public.question_submissions TO authenticated;
GRANT ALL ON TABLE public.question_submissions TO service_role;


--
-- Name: TABLE quote_form_fields; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.quote_form_fields TO anon;
GRANT ALL ON TABLE public.quote_form_fields TO authenticated;
GRANT ALL ON TABLE public.quote_form_fields TO service_role;


--
-- Name: TABLE quote_form_templates; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.quote_form_templates TO anon;
GRANT ALL ON TABLE public.quote_form_templates TO authenticated;
GRANT ALL ON TABLE public.quote_form_templates TO service_role;


--
-- Name: TABLE referral_partners; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.referral_partners TO anon;
GRANT ALL ON TABLE public.referral_partners TO authenticated;
GRANT ALL ON TABLE public.referral_partners TO service_role;


--
-- Name: TABLE referral_signups; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.referral_signups TO anon;
GRANT ALL ON TABLE public.referral_signups TO authenticated;
GRANT ALL ON TABLE public.referral_signups TO service_role;


--
-- Name: TABLE rfq_tokens; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.rfq_tokens TO anon;
GRANT ALL ON TABLE public.rfq_tokens TO authenticated;
GRANT ALL ON TABLE public.rfq_tokens TO service_role;


--
-- Name: TABLE sb_subcontracting_plans; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.sb_subcontracting_plans TO anon;
GRANT ALL ON TABLE public.sb_subcontracting_plans TO authenticated;
GRANT ALL ON TABLE public.sb_subcontracting_plans TO service_role;


--
-- Name: TABLE sow_communications; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.sow_communications TO anon;
GRANT ALL ON TABLE public.sow_communications TO authenticated;
GRANT ALL ON TABLE public.sow_communications TO service_role;


--
-- Name: TABLE sow_items; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.sow_items TO anon;
GRANT ALL ON TABLE public.sow_items TO authenticated;
GRANT ALL ON TABLE public.sow_items TO service_role;


--
-- Name: TABLE sow_quotes; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.sow_quotes TO anon;
GRANT ALL ON TABLE public.sow_quotes TO authenticated;
GRANT ALL ON TABLE public.sow_quotes TO service_role;


--
-- Name: TABLE sow_subcontractors; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.sow_subcontractors TO anon;
GRANT ALL ON TABLE public.sow_subcontractors TO authenticated;
GRANT ALL ON TABLE public.sow_subcontractors TO service_role;


--
-- Name: TABLE sub_access_log; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.sub_access_log TO anon;
GRANT ALL ON TABLE public.sub_access_log TO authenticated;
GRANT ALL ON TABLE public.sub_access_log TO service_role;


--
-- Name: TABLE sub_connections; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.sub_connections TO anon;
GRANT ALL ON TABLE public.sub_connections TO authenticated;
GRANT ALL ON TABLE public.sub_connections TO service_role;


--
-- Name: TABLE subcontractor_questions; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.subcontractor_questions TO anon;
GRANT ALL ON TABLE public.subcontractor_questions TO authenticated;
GRANT ALL ON TABLE public.subcontractor_questions TO service_role;


--
-- Name: TABLE subcontractors; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.subcontractors TO anon;
GRANT ALL ON TABLE public.subcontractors TO authenticated;
GRANT ALL ON TABLE public.subcontractors TO service_role;


--
-- Name: TABLE support_tickets; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.support_tickets TO anon;
GRANT ALL ON TABLE public.support_tickets TO authenticated;
GRANT ALL ON TABLE public.support_tickets TO service_role;


--
-- Name: TABLE task_orders; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.task_orders TO anon;
GRANT ALL ON TABLE public.task_orders TO authenticated;
GRANT ALL ON TABLE public.task_orders TO service_role;


--
-- Name: TABLE teaming_agreements; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.teaming_agreements TO anon;
GRANT ALL ON TABLE public.teaming_agreements TO authenticated;
GRANT ALL ON TABLE public.teaming_agreements TO service_role;


--
-- Name: TABLE user_profiles; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.user_profiles TO anon;
GRANT ALL ON TABLE public.user_profiles TO authenticated;
GRANT ALL ON TABLE public.user_profiles TO service_role;


--
-- Name: TABLE workflow_history; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.workflow_history TO anon;
GRANT ALL ON TABLE public.workflow_history TO authenticated;
GRANT ALL ON TABLE public.workflow_history TO service_role;


--
-- Name: DEFAULT PRIVILEGES FOR SEQUENCES; Type: DEFAULT ACL; Schema: public; Owner: -
--

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON SEQUENCES TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON SEQUENCES TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON SEQUENCES TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON SEQUENCES TO service_role;


--
-- Name: DEFAULT PRIVILEGES FOR SEQUENCES; Type: DEFAULT ACL; Schema: public; Owner: -
--

ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON SEQUENCES TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON SEQUENCES TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON SEQUENCES TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON SEQUENCES TO service_role;


--
-- Name: DEFAULT PRIVILEGES FOR FUNCTIONS; Type: DEFAULT ACL; Schema: public; Owner: -
--

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON FUNCTIONS TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON FUNCTIONS TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON FUNCTIONS TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON FUNCTIONS TO service_role;


--
-- Name: DEFAULT PRIVILEGES FOR FUNCTIONS; Type: DEFAULT ACL; Schema: public; Owner: -
--

ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON FUNCTIONS TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON FUNCTIONS TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON FUNCTIONS TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON FUNCTIONS TO service_role;


--
-- Name: DEFAULT PRIVILEGES FOR TABLES; Type: DEFAULT ACL; Schema: public; Owner: -
--

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON TABLES TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON TABLES TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON TABLES TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON TABLES TO service_role;


--
-- Name: DEFAULT PRIVILEGES FOR TABLES; Type: DEFAULT ACL; Schema: public; Owner: -
--

ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON TABLES TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON TABLES TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON TABLES TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON TABLES TO service_role;


--
-- PostgreSQL database dump complete
--

\unrestrict mt9036VhR3iwsN6bBO8ksXOkK5f2oU8JZ9qlnHgDXBYUB7Tc1n8NqTg5ZNbTxzO

