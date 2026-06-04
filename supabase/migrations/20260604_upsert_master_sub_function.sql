-- Function to insert/update master_subcontractors with proper ON CONFLICT handling.
-- PostgREST can't handle ON CONFLICT (sam_uei) when there's also a slug unique constraint,
-- so we do it directly in SQL via this RPC function.

CREATE OR REPLACE FUNCTION upsert_master_sub(
  p_company_name TEXT,
  p_slug TEXT,
  p_sam_uei TEXT,
  p_state TEXT DEFAULT NULL,
  p_city TEXT DEFAULT NULL,
  p_zip_code TEXT DEFAULT NULL,
  p_naics_codes TEXT[] DEFAULT '{}',
  p_trade_categories TEXT[] DEFAULT '{}',
  p_service_categories TEXT[] DEFAULT '{}',
  p_geographic_coverage TEXT[] DEFAULT '{}',
  p_small_business BOOLEAN DEFAULT FALSE,
  p_small_business_types TEXT[] DEFAULT '{}',
  p_verification_status TEXT DEFAULT 'unverified',
  p_data_source TEXT DEFAULT 'sam_gov',
  p_sam_registration_status TEXT DEFAULT 'Active',
  p_entity_type TEXT DEFAULT 'Business',
  p_profile_completeness INT DEFAULT 30,
  p_contact_name TEXT DEFAULT NULL,
  p_website TEXT DEFAULT NULL,
  p_cage_code TEXT DEFAULT NULL,
  p_source_id TEXT DEFAULT NULL
)
RETURNS void AS $$
BEGIN
  INSERT INTO master_subcontractors (
    company_name, slug, sam_uei, state, city, zip_code,
    naics_codes, trade_categories, service_categories,
    geographic_coverage, small_business, small_business_types,
    verification_status, data_source, sam_registration_status,
    entity_type, profile_completeness, contact_name, website,
    cage_code, source_id
  ) VALUES (
    p_company_name, p_slug, p_sam_uei, p_state, p_city, p_zip_code,
    p_naics_codes, p_trade_categories, p_service_categories,
    p_geographic_coverage, p_small_business, p_small_business_types,
    p_verification_status, p_data_source, p_sam_registration_status,
    p_entity_type, p_profile_completeness, p_contact_name, p_website,
    p_cage_code, p_source_id
  )
  ON CONFLICT (sam_uei) DO UPDATE SET
    company_name = EXCLUDED.company_name,
    slug = EXCLUDED.slug,
    state = COALESCE(EXCLUDED.state, master_subcontractors.state),
    city = COALESCE(EXCLUDED.city, master_subcontractors.city),
    zip_code = COALESCE(EXCLUDED.zip_code, master_subcontractors.zip_code),
    naics_codes = EXCLUDED.naics_codes,
    trade_categories = EXCLUDED.trade_categories,
    service_categories = EXCLUDED.service_categories,
    geographic_coverage = EXCLUDED.geographic_coverage,
    small_business = EXCLUDED.small_business,
    small_business_types = EXCLUDED.small_business_types,
    data_source = EXCLUDED.data_source,
    sam_registration_status = EXCLUDED.sam_registration_status,
    entity_type = EXCLUDED.entity_type,
    profile_completeness = EXCLUDED.profile_completeness,
    updated_at = now();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
