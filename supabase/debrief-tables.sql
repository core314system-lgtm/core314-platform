-- Task Order Debriefs
create table if not exists public.task_order_debriefs (
  id uuid primary key default gen_random_uuid(),
  task_order_id uuid not null references public.task_orders on delete cascade,
  outcome text not null check (outcome in ('awarded', 'not_awarded', 'no_bid', 'withdrawn')),
  award_date date,
  final_award_price numeric,
  our_proposed_price numeric,
  government_estimate numeric,
  winning_competitor text,
  winning_competitor_price numeric,
  loss_reasons text[] default '{}',
  strengths text[] default '{}',
  weaknesses text[] default '{}',
  lessons_learned text,
  pricing_notes text,
  sub_performance_notes text,
  what_to_repeat text,
  what_to_change text,
  evaluator_feedback text,
  tags text[] default '{}',
  created_by uuid references auth.users,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.task_order_debriefs enable row level security;
create policy "Authenticated users can view debriefs" on public.task_order_debriefs for select using (auth.uid() is not null);
create policy "Authenticated users can insert debriefs" on public.task_order_debriefs for insert with check (auth.uid() is not null);
create policy "Authenticated users can update debriefs" on public.task_order_debriefs for update using (auth.uid() is not null);
create policy "Authenticated users can delete debriefs" on public.task_order_debriefs for delete using (auth.uid() is not null);

-- Competitor Intelligence (built from debriefs over time)
create table if not exists public.competitors (
  id uuid primary key default gen_random_uuid(),
  company_name text not null,
  known_services text[] default '{}',
  known_regions text[] default '{}',
  wins_against_us integer default 0,
  losses_against_us integer default 0,
  avg_price_difference numeric,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.competitors enable row level security;
create policy "Authenticated users can view competitors" on public.competitors for select using (auth.uid() is not null);
create policy "Authenticated users can insert competitors" on public.competitors for insert with check (auth.uid() is not null);
create policy "Authenticated users can update competitors" on public.competitors for update using (auth.uid() is not null);
create policy "Authenticated users can delete competitors" on public.competitors for delete using (auth.uid() is not null);

-- Intelligence Insights (AI-generated insights from historical data)
create table if not exists public.intelligence_insights (
  id uuid primary key default gen_random_uuid(),
  category text not null check (category in ('pricing', 'subcontractor', 'competitive', 'compliance', 'general')),
  insight text not null,
  confidence numeric default 0.5,
  data_points integer default 1,
  related_task_orders uuid[] default '{}',
  related_service_categories text[] default '{}',
  related_regions text[] default '{}',
  metadata jsonb default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.intelligence_insights enable row level security;
create policy "Authenticated users can view insights" on public.intelligence_insights for select using (auth.uid() is not null);
create policy "Authenticated users can insert insights" on public.intelligence_insights for insert with check (auth.uid() is not null);
create policy "Authenticated users can update insights" on public.intelligence_insights for update using (auth.uid() is not null);
create policy "Authenticated users can delete insights" on public.intelligence_insights for delete using (auth.uid() is not null);
