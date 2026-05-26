-- Migration v2: Enhanced subcontractor fields and task order metadata

-- Add new columns to subcontractors
alter table public.subcontractors add column if not exists availability text default 'available' check (availability in ('available', 'busy', 'unavailable', 'seasonal'));
alter table public.subcontractors add column if not exists nationwide boolean default false;
alter table public.subcontractors add column if not exists regions text[] default '{}';
alter table public.subcontractors add column if not exists certifications text[] default '{}';
alter table public.subcontractors add column if not exists website text;
alter table public.subcontractors add column if not exists address text;
alter table public.subcontractors add column if not exists duns_number text;
alter table public.subcontractors add column if not exists cage_code text;
alter table public.subcontractors add column if not exists small_business boolean default false;
alter table public.subcontractors add column if not exists active boolean default true;

-- Add new columns to task_orders for AI auto-extraction
alter table public.task_orders add column if not exists contract_number text;
alter table public.task_orders add column if not exists contract_vehicle text;
alter table public.task_orders add column if not exists contracting_officer text;
alter table public.task_orders add column if not exists co_email text;
alter table public.task_orders add column if not exists co_phone text;
alter table public.task_orders add column if not exists period_of_performance_start date;
alter table public.task_orders add column if not exists period_of_performance_end date;
alter table public.task_orders add column if not exists estimated_value text;
alter table public.task_orders add column if not exists naics_code text;
alter table public.task_orders add column if not exists set_aside text;

-- Company profile table for first-time setup
create table if not exists public.company_profile (
  id uuid primary key default gen_random_uuid(),
  company_name text not null,
  cage_code text,
  duns_number text,
  naics_codes text[] default '{}',
  contract_vehicles text[] default '{}',
  primary_contact_name text,
  primary_contact_email text,
  primary_contact_phone text,
  address text,
  setup_complete boolean default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.company_profile enable row level security;

create policy "Auth users view company" on public.company_profile for select using (auth.uid() is not null);
create policy "Auth users insert company" on public.company_profile for insert with check (auth.uid() is not null);
create policy "Auth users update company" on public.company_profile for update using (auth.uid() is not null);
