-- リモート DB に過去セッションで作られた user_equipment テーブル
-- (旧スキーマ: instrument_name のシンプル形式、リポジトリには未記録) が
-- 残っているため、整合性のために drop してから作り直す。
drop table if exists user_equipment;

create table user_equipment (
  user_id                    uuid    primary key references auth.users(id) on delete cascade,

  -- 楽器 (clarinet)
  instrument_maker_id        uuid    references instrument_makers(id) on delete restrict,
  instrument_model_id        uuid    references instrument_models(id) on delete restrict,
  instrument_purchase_price  integer,
  instrument_start_date      date,
  instrument_photo_uri       text,

  -- リード
  reed_name                  text,
  reed_start_date            date,

  -- リガチャー
  ligature_name              text,
  ligature_start_date        date,

  -- マウスピース
  mouthpiece_name            text,
  mouthpiece_start_date      date,

  updated_at                 timestamptz default now()
);

alter table user_equipment enable row level security;

create policy "ユーザーは自分の楽器情報を参照できる"
  on user_equipment for select
  using (auth.uid() = user_id);

create policy "ユーザーは自分の楽器情報を追加できる"
  on user_equipment for insert
  with check (auth.uid() = user_id);

create policy "ユーザーは自分の楽器情報を更新できる"
  on user_equipment for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "ユーザーは自分の楽器情報を削除できる"
  on user_equipment for delete
  using (auth.uid() = user_id);
