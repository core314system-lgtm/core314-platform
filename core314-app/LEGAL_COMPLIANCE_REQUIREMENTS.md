# Core314 Legal Compliance Requirements

## Overview

This document outlines the legal documents and information needed to achieve GA-ready compliance status.

## Required Legal Documents

### 1. Terms of Service

**Status**: ⏸️ Placeholder content only

**Required Information:**
- Legal entity name (e.g., "Core314, Inc." or "Core314 LLC")
- State/country of incorporation
- Business address
- Contact email for legal inquiries
- Effective date
- Governing law jurisdiction

**Content Sections Needed:**
- Account registration and eligibility
- Subscription terms and pricing
- Payment terms and refunds
- Service availability and uptime SLA
- Intellectual property rights
- User data and privacy
- Limitation of liability
- Termination and suspension
- Dispute resolution and arbitration
- Changes to terms

**Template Location**: `/home/ubuntu/core314-landing/public/legal/terms.html`

### 2. Privacy Policy

**Status**: ⏸️ Placeholder content only

**Required Information:**
- Legal entity name and DPO contact
- Business address
- Privacy contact email
- Effective date
- Data protection registration number (if applicable)

**Content Sections Needed:**
- What data we collect (personal info, usage data, cookies)
- How we use data (service delivery, analytics, marketing)
- Legal basis for processing (GDPR compliance)
- Data sharing and third parties (Stripe, SendGrid, OpenAI, Supabase)
- Data retention periods
- User rights (access, deletion, portability, objection)
- International data transfers
- Security measures
- Children's privacy (COPPA compliance)
- Changes to privacy policy
- Contact information

**Template Location**: `/home/ubuntu/core314-landing/public/legal/privacy.html`

### 3. Data Processing Addendum (DPA)

**Status**: ⏸️ Placeholder content only

**Required Information:**
- Legal entity name
- Business address
- DPO contact information
- Data processing details
- Sub-processors list (Stripe, SendGrid, OpenAI, Supabase, Netlify)

**Content Sections Needed:**
- Definitions (Controller, Processor, Personal Data, etc.)
- Scope and purpose of processing
- Data subject categories
- Types of personal data processed
- Processing instructions
- Security measures (encryption, access controls, RLS)
- Sub-processor authorization
- Data subject rights assistance
- Data breach notification procedures
- International data transfers (Standard Contractual Clauses)
- Audit rights
- Term and termination

**Template Location**: `/home/ubuntu/core314-landing/public/legal/dpa.html`

### 4. Cookie Policy

**Status**: ⏸️ Placeholder content only

**Required Information:**
- Legal entity name
- Contact email
- Effective date

**Content Sections Needed:**
- What are cookies
- Types of cookies we use:
  - Essential cookies (authentication, session)
  - Analytics cookies (usage tracking)
  - Marketing cookies (if applicable)
- Third-party cookies (Stripe, analytics providers)
- How to control cookies
- Changes to cookie policy

**Template Location**: `/home/ubuntu/core314-landing/public/legal/cookies.html`

## Legal Version Tracking

### Database Schema

Create table to track legal document versions:

```sql
CREATE TABLE IF NOT EXISTS public.legal_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_type TEXT NOT NULL CHECK (document_type IN ('terms', 'privacy', 'dpa', 'cookies')),
  version TEXT NOT NULL,
  effective_date DATE NOT NULL,
  content_hash TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id)
);

CREATE INDEX idx_legal_versions_type_date ON public.legal_versions(document_type, effective_date DESC);

COMMENT ON TABLE public.legal_versions IS 'Tracks versions of legal documents for audit and compliance';
```

### User Consent Tracking

Track when users accept terms:

```sql
CREATE TABLE IF NOT EXISTS public.user_legal_consents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id),
  document_type TEXT NOT NULL,
  version TEXT NOT NULL,
  consented_at TIMESTAMPTZ DEFAULT NOW(),
  ip_address TEXT,
  user_agent TEXT
);

CREATE INDEX idx_user_consents_user ON public.user_legal_consents(user_id, document_type);

COMMENT ON TABLE public.user_legal_consents IS 'Records user acceptance of legal documents';
```

## Third-Party Services to Disclose

### Data Processors (Sub-processors)

1. **Stripe** (Payment Processing)
   - Purpose: Payment processing and subscription management
   - Data: Name, email, payment information
   - Location: United States
   - DPA: https://stripe.com/legal/dpa

2. **SendGrid** (Email Delivery)
   - Purpose: Transactional emails (welcome, password reset, notifications)
   - Data: Email address, name
   - Location: United States
   - DPA: https://www.twilio.com/legal/data-protection-addendum

3. **OpenAI** (AI Processing)
   - Purpose: AI-powered insights and recommendations
   - Data: System metrics, user queries (no PII)
   - Location: United States
   - DPA: https://openai.com/policies/data-processing-addendum

4. **Supabase** (Database and Backend)
   - Purpose: Data storage and backend services
   - Data: All user data and system data
   - Location: United States (AWS us-east-1)
   - DPA: https://supabase.com/legal/dpa

5. **Netlify** (Hosting)
   - Purpose: Website and application hosting
   - Data: Usage logs, IP addresses
   - Location: United States
   - DPA: https://www.netlify.com/legal/dpa/

## Compliance Checklist

### GDPR Compliance (EU Users)

- [ ] Privacy Policy includes all required disclosures
- [ ] Legal basis for processing documented
- [ ] Data subject rights procedures implemented
- [ ] DPA available for enterprise customers
- [ ] Cookie consent banner (if using non-essential cookies)
- [ ] Data breach notification procedures
- [ ] International data transfer mechanisms (SCCs)
- [ ] DPO appointed (if required)

### CCPA Compliance (California Users)

- [ ] Privacy Policy includes CCPA disclosures
- [ ] "Do Not Sell My Personal Information" link (if applicable)
- [ ] Consumer rights request procedures
- [ ] Data deletion procedures

### SOC 2 Preparation (Future)

- [ ] Security policies documented
- [ ] Access control procedures
- [ ] Incident response plan
- [ ] Change management procedures
- [ ] Vendor management procedures

## Implementation Steps

### Step 1: Gather Information

User must provide:
1. Legal entity name: _______________
2. State/country of incorporation: _______________
3. Business address: _______________
4. Legal contact email: _______________
5. DPO name and contact (if applicable): _______________
6. Data protection registration number (if applicable): _______________

### Step 2: Draft Documents

Options:
1. **Use Template Service**: Termly, iubenda, or similar (recommended for speed)
2. **Hire Lawyer**: For custom drafting (recommended for accuracy)
3. **Customize Templates**: Use open-source templates and customize

### Step 3: Review and Approve

- [ ] Legal review by qualified attorney
- [ ] Technical review for accuracy of data processing descriptions
- [ ] Executive approval

### Step 4: Implement

1. Replace placeholder files in `/home/ubuntu/core314-landing/public/legal/`
2. Insert legal version records into database
3. Add footer links across all apps
4. Implement consent tracking on signup
5. Add "Last Updated" dates to all documents

### Step 5: Ongoing Maintenance

- Review and update annually
- Update when services or data processing changes
- Track versions in database
- Notify users of material changes

## Current Status

**Blocker**: Missing legal entity information and finalized document content

**Risk**: Cannot launch to production without legally binding terms

**Priority**: P0 for GA launch

**Estimated Time**: 
- Template service: 2-4 hours
- Custom drafting: 1-2 weeks

## Next Steps

1. ⏸️ User provides legal entity information
2. ⏸️ Choose document creation method (template vs. lawyer)
3. ⏸️ Draft or customize documents
4. ⏸️ Legal review
5. ⏸️ Implement in codebase
6. ⏸️ Create legal_versions migration
7. ⏸️ Add consent tracking
8. ⏸️ Deploy to production

## Resources

- **GDPR Templates**: https://gdpr.eu/privacy-notice/
- **Termly Generator**: https://termly.io/products/terms-and-conditions-generator/
- **iubenda**: https://www.iubenda.com/
- **Stripe Legal Docs**: https://stripe.com/legal
- **Supabase DPA**: https://supabase.com/legal/dpa
