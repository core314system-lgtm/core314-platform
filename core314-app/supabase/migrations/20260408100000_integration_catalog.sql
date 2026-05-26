-- Integration Catalog: Canonical integration normalization + demand aggregation
-- Phase 2A of Integration Request System

-- 1. Create integration_catalog table
create table public.integration_catalog (
  id uuid primary key default gen_random_uuid(),
  canonical_name text not null unique,
  normalized_key text not null unique,
  category text,
  total_requests integer default 0,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

-- Enable RLS on integration_catalog
alter table public.integration_catalog enable row level security;

-- RLS Policies for integration_catalog
-- All authenticated users can read the catalog (needed for normalization lookups)
create policy "Authenticated users can view catalog"
on public.integration_catalog
for select
to authenticated
using (true);

-- All authenticated users can insert into catalog (needed during request submission)
create policy "Authenticated users can insert catalog entries"
on public.integration_catalog
for insert
to authenticated
with check (true);

-- All authenticated users can update catalog counts (needed during request submission)
create policy "Authenticated users can update catalog counts"
on public.integration_catalog
for update
to authenticated
using (true)
with check (true);

-- Admins can delete catalog entries
create policy "Admins can delete catalog entries"
on public.integration_catalog
for delete
to authenticated
using (
  exists (
    select 1 from public.profiles
    where profiles.id = auth.uid()
    and profiles.role = 'admin'
  )
);

-- 2. Add integration_catalog_id column to integration_requests
alter table public.integration_requests
add column integration_catalog_id uuid references public.integration_catalog(id);

-- 3. Index for performance
create index idx_integration_catalog_normalized_key on public.integration_catalog(normalized_key);
create index idx_integration_catalog_total_requests on public.integration_catalog(total_requests desc);
create index idx_integration_requests_catalog_id on public.integration_requests(integration_catalog_id);

-- 4. Backfill existing data
-- This creates catalog entries for all existing requests and links them
do $$
declare
  req record;
  norm_key text;
  catalog_id uuid;
  existing_catalog record;
begin
  for req in
    select id, integration_name, category
    from public.integration_requests
    where integration_catalog_id is null
    order by created_at asc
  loop
    -- Normalize: lowercase, trim, remove spaces/dashes/underscores/special chars
    norm_key := regexp_replace(lower(trim(req.integration_name)), '[^a-z0-9]', '', 'g');

    -- Check if catalog entry exists
    select * into existing_catalog
    from public.integration_catalog
    where normalized_key = norm_key
    limit 1;

    if existing_catalog.id is not null then
      catalog_id := existing_catalog.id;
    else
      -- Create new catalog entry
      insert into public.integration_catalog (canonical_name, normalized_key, category)
      values (req.integration_name, norm_key, req.category)
      returning id into catalog_id;
    end if;

    -- Link request to catalog
    update public.integration_requests
    set integration_catalog_id = catalog_id
    where id = req.id;
  end loop;

  -- Recalculate all counts
  update public.integration_catalog c
  set total_requests = (
    select count(*)
    from public.integration_requests r
    where r.integration_catalog_id = c.id
  ),
  updated_at = now();
end $$;
