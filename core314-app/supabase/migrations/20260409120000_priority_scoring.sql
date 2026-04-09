-- Priority Scoring Engine
-- Phase 2C of Integration Demand Intelligence Engine

-- 1. Add priority scoring columns to integration_catalog
alter table public.integration_catalog
add column priority_score numeric default 0,
add column unique_users_count integer default 0,
add column last_requested_at timestamp with time zone;

-- 2. Create category weights table
create table public.integration_category_weights (
  id uuid primary key default gen_random_uuid(),
  category text not null unique,
  weight numeric default 1.0,
  created_at timestamp with time zone default now()
);

-- 3. Enable RLS on category weights
alter table public.integration_category_weights enable row level security;

-- RLS Policies for integration_category_weights
-- All authenticated users can read weights (needed for score display)
create policy "Authenticated users can view category weights"
on public.integration_category_weights
for select
to authenticated
using (true);

-- Admins can insert category weights
create policy "Admins can insert category weights"
on public.integration_category_weights
for insert
to authenticated
with check (
  exists (
    select 1 from public.profiles
    where profiles.id = auth.uid()
    and profiles.role = 'admin'
  )
);

-- Admins can update category weights
create policy "Admins can update category weights"
on public.integration_category_weights
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

-- Admins can delete category weights
create policy "Admins can delete category weights"
on public.integration_category_weights
for delete
to authenticated
using (
  exists (
    select 1 from public.profiles
    where profiles.id = auth.uid()
    and profiles.role = 'admin'
  )
);

-- 4. Insert default category weights
insert into public.integration_category_weights (category, weight)
values
  ('CRM', 1.2),
  ('Finance', 1.3),
  ('Project Management', 1.0),
  ('Communication', 1.1),
  ('Marketing', 1.0),
  ('Support', 1.0),
  ('Dev Tools', 0.9),
  ('Other', 0.8)
on conflict (category) do nothing;

-- 5. Backfill: compute unique_users_count, last_requested_at, and priority_score for all existing catalog entries
do $$
declare
  cat record;
  u_count integer;
  last_req timestamp with time zone;
  recency numeric;
  cat_weight numeric;
  score numeric;
begin
  for cat in
    select id, category, total_requests
    from public.integration_catalog
  loop
    -- unique users count
    select count(distinct user_id) into u_count
    from public.integration_requests
    where integration_catalog_id = cat.id;

    -- last requested timestamp
    select max(created_at) into last_req
    from public.integration_requests
    where integration_catalog_id = cat.id;

    -- recency score
    if last_req >= now() - interval '7 days' then
      recency := 1.0;
    elsif last_req >= now() - interval '30 days' then
      recency := 0.7;
    elsif last_req >= now() - interval '90 days' then
      recency := 0.4;
    else
      recency := 0.1;
    end if;

    -- category weight
    select coalesce(w.weight, 1.0) into cat_weight
    from public.integration_category_weights w
    where w.category = cat.category;

    if cat_weight is null then
      cat_weight := 1.0;
    end if;

    -- priority score formula
    score := (cat.total_requests * 0.4)
           + (u_count * 0.3)
           + (recency * 0.2)
           + (cat_weight * 0.1);

    -- update catalog entry
    update public.integration_catalog
    set unique_users_count = u_count,
        last_requested_at = last_req,
        priority_score = score,
        updated_at = now()
    where id = cat.id;
  end loop;
end $$;

-- 6. Index for priority score ordering
create index idx_integration_catalog_priority_score on public.integration_catalog(priority_score desc);
