-- User Profiles
create table if not exists public.user_profiles (
  id uuid references auth.users on delete cascade primary key,
  email text not null,
  full_name text,
  role text not null default 'read_only' check (role in ('admin', 'market_sector_lead', 'program_manager', 'procurement', 'contracts', 'talent_acquisition', 'read_only')),
  created_at timestamptz not null default now()
);

alter table public.user_profiles enable row level security;

create policy "Users can view all profiles" on public.user_profiles for select using (true);
create policy "Users can update own profile" on public.user_profiles for update using (auth.uid() = id);

-- Auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.user_profiles (id, email, full_name, role)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', ''),
    'admin'
  );
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Task Orders
create table if not exists public.task_orders (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  solicitation_number text,
  task_order_number text,
  site_name text,
  location_city text,
  location_state text,
  status text not null default 'draft' check (status in ('draft', 'in_progress', 'under_review', 'submitted', 'awarded', 'not_awarded')),
  due_date date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users,
  notes text
);

alter table public.task_orders enable row level security;

create policy "Authenticated users can view task orders" on public.task_orders for select using (auth.uid() is not null);
create policy "Authenticated users can insert task orders" on public.task_orders for insert with check (auth.uid() is not null);
create policy "Authenticated users can update task orders" on public.task_orders for update using (auth.uid() is not null);
create policy "Authenticated users can delete task orders" on public.task_orders for delete using (auth.uid() is not null);

-- Documents
create table if not exists public.documents (
  id uuid primary key default gen_random_uuid(),
  task_order_id uuid not null references public.task_orders on delete cascade,
  file_name text not null,
  file_path text not null,
  file_size bigint not null default 0,
  file_type text,
  category text not null default 'other' check (category in ('sow', 'pricing_sheet', 'exhibit', 'amendment', 'qa_response', 'wage_determination', 'site_info', 'subcontractor_quote', 'internal_notes', 'other')),
  version integer not null default 1,
  uploaded_by uuid references auth.users,
  uploaded_at timestamptz not null default now()
);

alter table public.documents enable row level security;

create policy "Authenticated users can view documents" on public.documents for select using (auth.uid() is not null);
create policy "Authenticated users can insert documents" on public.documents for insert with check (auth.uid() is not null);
create policy "Authenticated users can delete documents" on public.documents for delete using (auth.uid() is not null);

-- Subcontractors
create table if not exists public.subcontractors (
  id uuid primary key default gen_random_uuid(),
  company_name text not null,
  contact_name text,
  contact_email text,
  contact_phone text,
  service_categories text[] default '{}',
  geographic_coverage text[] default '{}',
  preferred boolean not null default false,
  incumbent_status text not null default 'unknown' check (incumbent_status in ('known', 'suspected', 'not_incumbent', 'unknown')),
  performance_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.subcontractors enable row level security;

create policy "Authenticated users can view subcontractors" on public.subcontractors for select using (auth.uid() is not null);
create policy "Authenticated users can insert subcontractors" on public.subcontractors for insert with check (auth.uid() is not null);
create policy "Authenticated users can update subcontractors" on public.subcontractors for update using (auth.uid() is not null);
create policy "Authenticated users can delete subcontractors" on public.subcontractors for delete using (auth.uid() is not null);

-- Storage bucket for documents
insert into storage.buckets (id, name, public)
values ('task-order-documents', 'task-order-documents', false)
on conflict (id) do nothing;

create policy "Authenticated users can upload documents" on storage.objects
  for insert with check (bucket_id = 'task-order-documents' and auth.uid() is not null);

create policy "Authenticated users can view documents" on storage.objects
  for select using (bucket_id = 'task-order-documents' and auth.uid() is not null);

create policy "Authenticated users can delete documents" on storage.objects
  for delete using (bucket_id = 'task-order-documents' and auth.uid() is not null);
