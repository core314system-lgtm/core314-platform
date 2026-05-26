
create table if not exists fusion_governance_policies (
  id uuid primary key default uuid_generate_v4(),
  policy_name text not null,
  description text,
  policy_type text not null check (policy_type in ('confidence', 'fairness', 'audit', 'risk', 'ethics')),
  condition jsonb not null,
  action jsonb not null,
  active boolean default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists fusion_governance_audit (
  id uuid primary key default uuid_generate_v4(),
  organization_id uuid references organizations(id) on delete cascade,
  event_type text not null check (event_type in ('optimization', 'simulation', 'recommendation', 'automation', 'recalibration')),
  decision_context jsonb not null,
  policy_triggered text[],
  governance_action text not null check (governance_action in ('approved', 'flagged', 'halted', 'auto_adjusted')),
  explanation text,
  confidence_score numeric,
  ethical_risk_score numeric check (ethical_risk_score >= 0 and ethical_risk_score <= 1),
  created_at timestamptz default now()
);

alter table fusion_governance_audit enable row level security;

alter table fusion_governance_policies enable row level security;

create policy "tenant_isolation_governance_audit"
  on fusion_governance_audit
  for select
  using (
    organization_id in (
      select organization_id 
      from organization_members 
      where user_id = auth.uid()
    )
  );

create policy "read_all_governance_policies"
  on fusion_governance_policies
  for select
  using (auth.role() = 'authenticated');

grant select on fusion_governance_audit to authenticated;
grant all on fusion_governance_audit to service_role;

grant select on fusion_governance_policies to authenticated;
grant all on fusion_governance_policies to service_role;

create index if not exists idx_governance_audit_org on fusion_governance_audit(organization_id);
create index if not exists idx_governance_audit_created on fusion_governance_audit(created_at desc);
create index if not exists idx_governance_audit_action on fusion_governance_audit(governance_action);
create index if not exists idx_governance_policies_active on fusion_governance_policies(active) where active = true;

insert into fusion_governance_policies (policy_name, description, policy_type, condition, action) values
  ('Low Confidence Halt', 'Halt optimizations when AI confidence drops below 70%', 'confidence', 
   '{"metric":"confidence","operator":"<","value":0.7}'::jsonb,
   '{"type":"halt_optimization","message":"Confidence too low for autonomous execution"}'::jsonb),
  
  ('High Variance Flag', 'Flag for review when variance exceeds 40%', 'risk',
   '{"metric":"variance","operator":">","value":0.4}'::jsonb,
   '{"type":"require_manual_approval","message":"High variance detected - manual review required"}'::jsonb),
  
  ('High Ethical Risk Halt', 'Halt when ethical risk score exceeds 0.8', 'ethics',
   '{"metric":"ethical_risk_score","operator":">","value":0.8}'::jsonb,
   '{"type":"halt_optimization","message":"High ethical risk - human oversight required"}'::jsonb),
  
  ('Rapid Optimization Audit', 'Flag when more than 5 optimizations applied per day', 'audit',
   '{"metric":"optimization_count","operator":">","value":5,"timeframe":"24h"}'::jsonb,
   '{"type":"flag_for_review","message":"Unusually high optimization rate detected"}'::jsonb);
