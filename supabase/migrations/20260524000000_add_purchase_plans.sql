create table purchase_plans (
  id                     uuid primary key default gen_random_uuid(),
  user_id                uuid not null unique references auth.users(id) on delete cascade,
  maker_id               text not null,
  maker_name             text not null,
  model_id               text not null,
  model_name             text not null,
  target_price           integer not null check (target_price > 0),
  monthly_savings_target integer not null check (monthly_savings_target > 0),
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now()
);

alter table purchase_plans enable row level security;

create policy "purchase_plans select" on purchase_plans
  for select using (auth.uid() = user_id);
create policy "purchase_plans insert" on purchase_plans
  for insert with check (auth.uid() = user_id);
create policy "purchase_plans update" on purchase_plans
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "purchase_plans delete" on purchase_plans
  for delete using (auth.uid() = user_id);

create table purchase_plan_savings (
  id                uuid primary key default gen_random_uuid(),
  purchase_plan_id  uuid not null references purchase_plans(id) on delete cascade,
  year_month        text not null,
  amount            integer not null check (amount > 0),
  memo              text,
  created_at        timestamptz not null default now()
);

alter table purchase_plan_savings enable row level security;

create policy "purchase_plan_savings select" on purchase_plan_savings
  for select using (
    exists (select 1 from purchase_plans where id = purchase_plan_id and user_id = auth.uid())
  );
create policy "purchase_plan_savings insert" on purchase_plan_savings
  for insert with check (
    exists (select 1 from purchase_plans where id = purchase_plan_id and user_id = auth.uid())
  );
create policy "purchase_plan_savings update" on purchase_plan_savings
  for update
  using (exists (select 1 from purchase_plans where id = purchase_plan_id and user_id = auth.uid()))
  with check (exists (select 1 from purchase_plans where id = purchase_plan_id and user_id = auth.uid()));
create policy "purchase_plan_savings delete" on purchase_plan_savings
  for delete using (
    exists (select 1 from purchase_plans where id = purchase_plan_id and user_id = auth.uid())
  );
