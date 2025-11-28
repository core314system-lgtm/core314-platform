
create table if not exists beta_access_codes (
  id uuid primary key default uuid_generate_v4(),
  code text unique not null,
  max_uses int not null default 1,
  uses int not null default 0,
  assigned_to text,
  expires_at timestamptz,
  notes text,
  created_by uuid references auth.users (id),
  created_at timestamptz default now()
);

create table if not exists beta_access_code_usage (
  id uuid primary key default uuid_generate_v4(),
  code_id uuid references beta_access_codes(id),
  used_by uuid references auth.users(id),
  used_at timestamptz default now(),
  metadata jsonb
);

alter table beta_access_codes enable row level security;
alter table beta_access_code_usage enable row level security;

create policy "Admins read codes" on beta_access_codes for select using (auth.jwt() ->> 'role' = 'admin');
create policy "Admins insert codes" on beta_access_codes for insert with check (auth.jwt() ->> 'role' = 'admin');
create policy "Admins update codes" on beta_access_codes for update using (auth.jwt() ->> 'role' = 'admin');
create policy "No delete codes" on beta_access_codes for delete using (false);

create policy "Admins read usage" on beta_access_code_usage for select using (auth.jwt() ->> 'role' = 'admin');
create policy "Admins insert usage" on beta_access_code_usage for insert with check (auth.jwt() ->> 'role' = 'admin');

COMMENT ON TABLE beta_access_codes IS 'Beta access codes for gated signup';
COMMENT ON TABLE beta_access_code_usage IS 'Tracks usage of beta access codes';
