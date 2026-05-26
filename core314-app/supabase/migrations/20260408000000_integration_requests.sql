-- Integration Requests table
-- Allows users to request new integrations and admins to manage them

create table public.integration_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  integration_name text not null,
  category text not null,
  url text,
  use_case text not null,
  status text default 'pending' check (
    status in ('pending', 'reviewing', 'planned', 'rejected', 'completed')
  ),
  priority integer default 0,
  admin_notes text,
  reviewed_at timestamp with time zone,
  completed_at timestamp with time zone,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

-- Enable RLS
alter table public.integration_requests enable row level security;

-- RLS Policies

-- Users can insert their own requests
create policy "Users can insert their own requests"
on public.integration_requests
for insert
to authenticated
with check (auth.uid() = user_id);

-- Users can view their own requests
create policy "Users can view their own requests"
on public.integration_requests
for select
to authenticated
using (auth.uid() = user_id);

-- Admin policy: admins can view all requests
-- Uses profiles table to check role
create policy "Admins can view all requests"
on public.integration_requests
for select
to authenticated
using (
  exists (
    select 1 from public.profiles
    where profiles.id = auth.uid()
    and profiles.role = 'admin'
  )
);

-- Admin policy: admins can update any request
create policy "Admins can update all requests"
on public.integration_requests
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

-- Index for common queries
create index idx_integration_requests_user_id on public.integration_requests(user_id);
create index idx_integration_requests_status on public.integration_requests(status);
create index idx_integration_requests_created_at on public.integration_requests(created_at desc);
