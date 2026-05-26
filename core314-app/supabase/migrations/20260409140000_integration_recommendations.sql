-- AI Recommendation Layer
-- Phase 2D of Integration Demand Intelligence Engine

-- 1. Create integration_recommendations table
create table public.integration_recommendations (
  id uuid primary key default gen_random_uuid(),

  integration_catalog_id uuid references public.integration_catalog(id) on delete cascade,

  recommendation_type text not null check (
    recommendation_type in ('build_now', 'high_demand', 'trending_up', 'category_gap', 'low_priority')
  ),
  title text not null,
  description text not null,

  priority_score_snapshot numeric,

  created_at timestamp with time zone default now()
);

-- 2. Unique constraint: no duplicate recommendations per integration/type
create unique index idx_recommendation_unique
on public.integration_recommendations(integration_catalog_id, recommendation_type);

-- 3. Enable RLS
alter table public.integration_recommendations enable row level security;

-- 4. RLS Policies
-- All authenticated users can read recommendations
create policy "Authenticated users can view recommendations"
on public.integration_recommendations
for select
to authenticated
using (true);

-- Admins can insert recommendations
create policy "Admins can insert recommendations"
on public.integration_recommendations
for insert
to authenticated
with check (
  exists (
    select 1 from public.profiles
    where profiles.id = auth.uid()
    and profiles.role = 'admin'
  )
);

-- Admins can update recommendations
create policy "Admins can update recommendations"
on public.integration_recommendations
for update
to authenticated
using (
  exists (
    select 1 from public.profiles
    where profiles.id = auth.uid()
    and profiles.role = 'admin'
  )
)
with check (
  exists (
    select 1 from public.profiles
    where profiles.id = auth.uid()
    and profiles.role = 'admin'
  )
);

-- Admins can delete recommendations
create policy "Admins can delete recommendations"
on public.integration_recommendations
for delete
to authenticated
using (
  exists (
    select 1 from public.profiles
    where profiles.id = auth.uid()
    and profiles.role = 'admin'
  )
);

-- 5. Index for sorting by type priority
create index idx_recommendations_type on public.integration_recommendations(recommendation_type);
create index idx_recommendations_catalog on public.integration_recommendations(integration_catalog_id);
