-- Phase 3B: Private Offer System
-- Admin-initiated private offers for user-specific delivery

-- 1. Create integration_private_offers table
create table public.integration_private_offers (
  id uuid primary key default gen_random_uuid(),
  integration_catalog_id uuid not null references public.integration_catalog(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  offer_title text not null,
  offer_description text not null,
  status text default 'pending' check (
    status in ('pending', 'accepted', 'declined')
  ),
  created_at timestamp with time zone default now(),
  responded_at timestamp with time zone
);

-- 2. Index for user lookups
create index idx_private_offers_user
on public.integration_private_offers(user_id);

-- 3. Index for catalog lookups
create index idx_private_offers_catalog
on public.integration_private_offers(integration_catalog_id);

-- 4. Enable RLS
alter table public.integration_private_offers enable row level security;

-- 5. RLS Policies

-- Users can view ONLY their own offers
create policy "Users can view own offers"
on public.integration_private_offers
for select
using (auth.uid() = user_id);

-- Admin can view all offers
create policy "Admins can view all offers"
on public.integration_private_offers
for select
using (
  exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  )
);

-- Admin can create offers
create policy "Admins can create offers"
on public.integration_private_offers
for insert
with check (
  exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  )
);

-- Users can update ONLY their own offers (accept/decline)
create policy "Users can update own offers"
on public.integration_private_offers
for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

-- Admin can update any offer
create policy "Admins can update all offers"
on public.integration_private_offers
for update
using (
  exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  )
);
