create table instrument_makers (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  created_at timestamptz default now()
);

create table instrument_models (
  id uuid primary key default gen_random_uuid(),
  maker_id uuid not null references instrument_makers(id) on delete cascade,
  name text not null,
  created_at timestamptz default now(),
  unique(maker_id, name)
);

-- 初期データ: Buffet Crampon
with bc as (
  insert into instrument_makers (name) values ('Buffet Crampon') returning id
)
insert into instrument_models (maker_id, name)
select bc.id, m.name from bc, (values ('R13'), ('E11'), ('Prestige'), ('RC'), ('Tosca')) as m(name);

-- 初期データ: Yamaha
with ya as (
  insert into instrument_makers (name) values ('Yamaha') returning id
)
insert into instrument_models (maker_id, name)
select ya.id, m.name from ya, (values ('YCL-650'), ('YCL-SEV'), ('YCL-CSVR')) as m(name);

-- 初期データ: Selmer
with se as (
  insert into instrument_makers (name) values ('Selmer') returning id
)
insert into instrument_models (maker_id, name)
select se.id, m.name from se, (values ('Series 10'), ('Privilege')) as m(name);
