-- Integration Execution + User Commitment System
-- Phase 3A of Integration Intelligence Engine

-- 1. Create integration_commitments table
create table public.integration_commitments (
  id uuid primary key default gen_random_uuid(),

  integration_catalog_id uuid not null references public.integration_catalog(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,

  commitment_type text default 'interested' check (
    commitment_type in ('interested', 'high_priority')
  ),

  created_at timestamp with time zone default now()
);

-- Unique constraint: no duplicate commitments per user per integration
create unique index idx_unique_user_commitment
on public.integration_commitments(integration_catalog_id, user_id);

-- 2. Create integration_execution table
create table public.integration_execution (
  id uuid primary key default gen_random_uuid(),

  integration_catalog_id uuid not null references public.integration_catalog(id) on delete cascade,

  status text default 'not_started' check (
    status in ('not_started', 'planned', 'in_progress', 'beta', 'completed')
  ),

  estimated_completion_date timestamp with time zone,

  notes text,

  monetization_potential text default 'low' check (
    monetization_potential in ('low', 'medium', 'high')
  ),

  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

-- 3. Enable RLS on both tables
alter table public.integration_commitments enable row level security;
alter table public.integration_execution enable row level security;

-- 4. RLS Policies — integration_commitments

-- Users can view their own commitments
create policy "Users can view own commitments"
on public.integration_commitments
for select
to authenticated
using (user_id = auth.uid());

-- Admins can view all commitments
create policy "Admins can view all commitments"
on public.integration_commitments
for select
to authenticated
using (
  exists (
    select 1 from public.profiles
    where profiles.id = auth.uid()
    and profiles.role = 'admin'
  )
);

-- Users can insert their own commitments
create policy "Users can insert own commitments"
on public.integration_commitments
for insert
to authenticated
with check (user_id = auth.uid());

-- Users can update their own commitments
create policy "Users can update own commitments"
on public.integration_commitments
for update
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

-- Users can delete their own commitments
create policy "Users can delete own commitments"
on public.integration_commitments
for delete
to authenticated
using (user_id = auth.uid());

-- 5. RLS Policies — integration_execution

-- All authenticated users can view execution status (except monetization — filtered in app)
create policy "Authenticated users can view execution"
on public.integration_execution
for select
to authenticated
using (true);

-- Admins can insert execution records
create policy "Admins can insert execution"
on public.integration_execution
for insert
to authenticated
with check (
  exists (
    select 1 from public.profiles
    where profiles.id = auth.uid()
    and profiles.role = 'admin'
  )
);

-- Admins can update execution records
create policy "Admins can update execution"
on public.integration_execution
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

-- Admins can delete execution records
create policy "Admins can delete execution"
on public.integration_execution
for delete
to authenticated
using (
  exists (
    select 1 from public.profiles
    where profiles.id = auth.uid()
    and profiles.role = 'admin'
  )
);

-- 6. Indexes
create index idx_commitments_catalog on public.integration_commitments(integration_catalog_id);
create index idx_commitments_user on public.integration_commitments(user_id);
create index idx_execution_catalog on public.integration_execution(integration_catalog_id);
create index idx_execution_status on public.integration_execution(status);
