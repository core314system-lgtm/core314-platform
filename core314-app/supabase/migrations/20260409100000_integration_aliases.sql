-- Integration Aliases: Smart Clustering + Semantic Matching
-- Phase 2B of Integration Demand Intelligence Engine

-- 1. Create integration_aliases table
create table public.integration_aliases (
  id uuid primary key default gen_random_uuid(),
  integration_catalog_id uuid not null references public.integration_catalog(id) on delete cascade,
  alias_name text not null,
  normalized_key text not null,
  created_at timestamp with time zone default now()
);

-- 2. Unique constraint on normalized_key to prevent duplicate aliases
create unique index idx_alias_normalized_unique
on public.integration_aliases(normalized_key);

-- 3. Enable RLS on integration_aliases
alter table public.integration_aliases enable row level security;

-- 4. RLS Policies for integration_aliases
-- All authenticated users can read aliases (needed for matching lookups)
create policy "Authenticated users can view aliases"
on public.integration_aliases
for select
to authenticated
using (true);

-- All authenticated users can insert aliases (needed during request submission for auto-alias)
create policy "Authenticated users can insert aliases"
on public.integration_aliases
for insert
to authenticated
with check (true);

-- Admins can update aliases (reassign to different catalog entry)
create policy "Admins can update aliases"
on public.integration_aliases
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

-- Admins can delete aliases
create policy "Admins can delete aliases"
on public.integration_aliases
for delete
to authenticated
using (
  exists (
    select 1 from public.profiles
    where profiles.id = auth.uid()
    and profiles.role = 'admin'
  )
);

-- 5. Auto-create aliases for existing catalog entries
-- Each catalog entry gets an alias matching its own normalized_key
do $$
declare
  cat record;
begin
  for cat in
    select id, canonical_name, normalized_key
    from public.integration_catalog
  loop
    -- Insert alias only if not already present
    insert into public.integration_aliases (integration_catalog_id, alias_name, normalized_key)
    values (cat.id, cat.canonical_name, cat.normalized_key)
    on conflict (normalized_key) do nothing;
  end loop;
end $$;
