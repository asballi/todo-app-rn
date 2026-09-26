-- v4 senkronizasyon şeması (docs/PLAN.md → v4, X6–X11).
--
-- Her koleksiyon kendi tablosunda; satırlar (user_id, id) ile tanımlanır, böylece
-- her kullanıcının kendi "inbox" kaydı olur. İstemci yalnızca push / pull RPC'leriyle
-- konuşur. Alan adları istemcideki camelCase'in snake_case karşılığıdır
-- (dueDate → due_date); eşleme istemcide yapılır.
--
-- Sunucu sütunları (istemci gönderse de tetikleyici üzerine yazar):
--   server_seq         → her yazmada sync_seq'ten yeni değer; pull imleci bununla ilerler
--   server_updated_at  → sunucu saatiyle son yazma; 30 günlük temizlik bununla ölçülür

create sequence public.sync_seq;

-- Tek satırlık ayar: bu sürümden eski istemciler senkron yapamaz (X8).
create table public.sync_meta (
  id boolean primary key default true check (id),
  min_schema_version int not null
);
insert into public.sync_meta (min_schema_version) values (3);

-- Kullanıcı başına temizlik sınırı: kalıcı silinen en büyük server_seq (X10).
create table public.sync_users (
  user_id uuid primary key references auth.users on delete cascade,
  purged_seq bigint not null default 0
);

create table public.tasks (
  user_id uuid not null references auth.users on delete cascade,
  id text not null,
  created_at timestamptz not null,
  updated_at timestamptz not null,
  deleted_at timestamptz,
  title text not null,
  notes text not null,
  category_id text not null,
  due_date date,
  due_time text check (due_time ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'),
  priority smallint not null check (priority between 0 and 3),
  completed_at timestamptz,
  reminders jsonb not null check (jsonb_typeof(reminders) = 'array'),
  recurrence jsonb check (recurrence is null or jsonb_typeof(recurrence) = 'object'),
  next_task_id text,
  checklist jsonb not null check (jsonb_typeof(checklist) = 'array'),
  server_seq bigint not null,
  server_updated_at timestamptz not null,
  primary key (user_id, id),
  -- Saat yalnızca bir güne bağlı olarak anlamlıdır (K6).
  check (due_time is null or due_date is not null)
);

create table public.categories (
  user_id uuid not null references auth.users on delete cascade,
  id text not null,
  created_at timestamptz not null,
  updated_at timestamptz not null,
  deleted_at timestamptz,
  name text not null,
  color text not null,
  icon text not null,
  is_system boolean not null,
  sort_order double precision not null,
  server_seq bigint not null,
  server_updated_at timestamptz not null,
  primary key (user_id, id)
);

create table public.tags (
  user_id uuid not null references auth.users on delete cascade,
  id text not null,
  created_at timestamptz not null,
  updated_at timestamptz not null,
  deleted_at timestamptz,
  name text not null,
  name_key text not null,
  color text,
  server_seq bigint not null,
  server_updated_at timestamptz not null,
  primary key (user_id, id)
);

create table public.task_tags (
  user_id uuid not null references auth.users on delete cascade,
  id text not null,
  created_at timestamptz not null,
  updated_at timestamptz not null,
  deleted_at timestamptz,
  task_id text not null,
  tag_id text not null,
  server_seq bigint not null,
  server_updated_at timestamptz not null,
  primary key (user_id, id)
);

-- Tablolar arasında yabancı anahtar yok (task.category_id → categories gibi):
-- kayıtlar herhangi bir sırayla gelebilir ve temizlik birini diğerinden önce
-- silebilir. Bağlantıların tutarlılığı istemcinin kuralıdır.

create index tasks_pull_idx on public.tasks (user_id, server_seq);
create index categories_pull_idx on public.categories (user_id, server_seq);
create index tags_pull_idx on public.tags (user_id, server_seq);
create index task_tags_pull_idx on public.task_tags (user_id, server_seq);

create index tasks_purge_idx on public.tasks (server_updated_at) where deleted_at is not null;
create index categories_purge_idx on public.categories (server_updated_at) where deleted_at is not null;
create index tags_purge_idx on public.tags (server_updated_at) where deleted_at is not null;
create index task_tags_purge_idx on public.task_tags (server_updated_at) where deleted_at is not null;

-- Her yazmada sunucu sütunlarını doldurur. Kullanıcı başına kilit, aynı
-- kullanıcının yazmalarını sıraya koyar: bir işlem server_seq aldıktan sonra
-- commit edilene kadar o kullanıcının başka yazması bekler. Böylece daha küçük
-- bir server_seq, daha büyüğünden sonra görünür olmaz ve pull imleci onu atlamaz.
create function public.stamp_server_columns()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform pg_advisory_xact_lock(hashtextextended(new.user_id::text, 0));
  new.server_seq := nextval('public.sync_seq');
  new.server_updated_at := now();
  return new;
end;
$$;

create trigger stamp_server_columns before insert or update on public.tasks
  for each row execute function public.stamp_server_columns();
create trigger stamp_server_columns before insert or update on public.categories
  for each row execute function public.stamp_server_columns();
create trigger stamp_server_columns before insert or update on public.tags
  for each row execute function public.stamp_server_columns();
create trigger stamp_server_columns before insert or update on public.task_tags
  for each row execute function public.stamp_server_columns();

-- Satır düzeyi güvenlik: herkes yalnızca kendi satırlarını görür ve yazar.
-- Kalıcı silme istemciye kapalı (yalnızca temizlik ve hesap silme).
alter table public.tasks enable row level security;
alter table public.categories enable row level security;
alter table public.tags enable row level security;
alter table public.task_tags enable row level security;
alter table public.sync_meta enable row level security;
alter table public.sync_users enable row level security;

create policy own_rows_select on public.tasks for select to authenticated
  using (user_id = (select auth.uid()));
create policy own_rows_insert on public.tasks for insert to authenticated
  with check (user_id = (select auth.uid()));
create policy own_rows_update on public.tasks for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

create policy own_rows_select on public.categories for select to authenticated
  using (user_id = (select auth.uid()));
create policy own_rows_insert on public.categories for insert to authenticated
  with check (user_id = (select auth.uid()));
create policy own_rows_update on public.categories for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

create policy own_rows_select on public.tags for select to authenticated
  using (user_id = (select auth.uid()));
create policy own_rows_insert on public.tags for insert to authenticated
  with check (user_id = (select auth.uid()));
create policy own_rows_update on public.tags for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

create policy own_rows_select on public.task_tags for select to authenticated
  using (user_id = (select auth.uid()));
create policy own_rows_insert on public.task_tags for insert to authenticated
  with check (user_id = (select auth.uid()));
create policy own_rows_update on public.task_tags for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

create policy read_all on public.sync_meta for select to authenticated using (true);
create policy own_row_select on public.sync_users for select to authenticated
  using (user_id = (select auth.uid()));

-- Supabase yeni tablolarda anon ve authenticated rollerine varsayılan olarak tüm
-- yetkileri verir; burada açıkça daraltılır. Realtime değişiklik olayları için
-- authenticated rolünün SELECT yetkisi gerekir.
revoke all on public.tasks, public.categories, public.tags, public.task_tags,
  public.sync_meta, public.sync_users from anon, authenticated;
grant select, insert, update on public.tasks, public.categories, public.tags, public.task_tags
  to authenticated;
grant select on public.sync_meta, public.sync_users to authenticated;
-- Sıra yalnızca tetikleyici (security definer) tarafından ilerletilir.
revoke all on sequence public.sync_seq from anon, authenticated;

-- Oturum açmış kullanıcının kimliği; yoksa hata.
create function public.require_user()
returns uuid
language plpgsql
stable
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;
  return uid;
end;
$$;

-- İstemcinin şema sürümü yeterli değilse 'client_outdated' hatası (detail: en küçük sürüm).
create function public.assert_client_schema(client_schema int)
returns void
language plpgsql
stable
set search_path = ''
as $$
declare
  min_version int := (select min_schema_version from public.sync_meta);
begin
  if client_schema is null or client_schema < min_version then
    raise exception 'client_outdated' using errcode = 'P0001', detail = min_version::text;
  end if;
end;
$$;

-- Değişiklikleri yazar. changes: { tasks: [...], categories: [...], tags: [...], task_tags: [...] },
-- her kayıt snake_case sütun adlarıyla. Bir kayıt yalnızca gelen updated_at mevcut
-- kayıttan daha yeniyse yazılır (X6; eşitlikte sunucudaki kalır). user_id her zaman
-- oturumdaki kullanıcıdır; kayıtta gelen değer yok sayılır.
-- Dönüş: { written: { tasks: [id, ...], ... } }. Gönderilip yazılmayanlar, sunucuda
-- daha yeni (ya da aynı) sürümü olan kayıtlardır; istemci onları sonraki pull'da alır.
create function public.push(client_schema int, changes jsonb)
returns jsonb
language plpgsql
set search_path = ''
as $$
declare
  uid uuid := public.require_user();
  written jsonb := '{}';
  ids text[];
begin
  perform public.assert_client_schema(client_schema);

  -- Aynı kayıt bir gönderimde iki kez gelirse yalnızca en yenisi alınır
  -- (ON CONFLICT aynı satırı iki kez güncelleyemez).
  with input as (
    select distinct on (r.id) r.*
    from jsonb_populate_recordset(null::public.tasks, coalesce(changes -> 'tasks', '[]')) r
    order by r.id, r.updated_at desc
  ), written_rows as (
    insert into public.tasks as t (
      user_id, id, created_at, updated_at, deleted_at, title, notes, category_id, due_date,
      due_time, priority, completed_at, reminders, recurrence, next_task_id, checklist
    )
    select uid, i.id, i.created_at, i.updated_at, i.deleted_at, i.title, i.notes, i.category_id,
      i.due_date, i.due_time, i.priority, i.completed_at, i.reminders, i.recurrence,
      i.next_task_id, i.checklist
    from input i
    on conflict (user_id, id) do update set
      created_at = excluded.created_at, updated_at = excluded.updated_at,
      deleted_at = excluded.deleted_at, title = excluded.title, notes = excluded.notes,
      category_id = excluded.category_id, due_date = excluded.due_date,
      due_time = excluded.due_time, priority = excluded.priority,
      completed_at = excluded.completed_at, reminders = excluded.reminders,
      recurrence = excluded.recurrence, next_task_id = excluded.next_task_id,
      checklist = excluded.checklist
    where excluded.updated_at > t.updated_at
    returning t.id
  )
  select coalesce(array_agg(id), '{}') into ids from written_rows;
  written := written || jsonb_build_object('tasks', to_jsonb(ids));

  with input as (
    select distinct on (r.id) r.*
    from jsonb_populate_recordset(null::public.categories, coalesce(changes -> 'categories', '[]')) r
    order by r.id, r.updated_at desc
  ), written_rows as (
    insert into public.categories as t (
      user_id, id, created_at, updated_at, deleted_at, name, color, icon, is_system, sort_order
    )
    select uid, i.id, i.created_at, i.updated_at, i.deleted_at, i.name, i.color, i.icon,
      i.is_system, i.sort_order
    from input i
    on conflict (user_id, id) do update set
      created_at = excluded.created_at, updated_at = excluded.updated_at,
      deleted_at = excluded.deleted_at, name = excluded.name, color = excluded.color,
      icon = excluded.icon, is_system = excluded.is_system, sort_order = excluded.sort_order
    where excluded.updated_at > t.updated_at
    returning t.id
  )
  select coalesce(array_agg(id), '{}') into ids from written_rows;
  written := written || jsonb_build_object('categories', to_jsonb(ids));

  with input as (
    select distinct on (r.id) r.*
    from jsonb_populate_recordset(null::public.tags, coalesce(changes -> 'tags', '[]')) r
    order by r.id, r.updated_at desc
  ), written_rows as (
    insert into public.tags as t (
      user_id, id, created_at, updated_at, deleted_at, name, name_key, color
    )
    select uid, i.id, i.created_at, i.updated_at, i.deleted_at, i.name, i.name_key, i.color
    from input i
    on conflict (user_id, id) do update set
      created_at = excluded.created_at, updated_at = excluded.updated_at,
      deleted_at = excluded.deleted_at, name = excluded.name, name_key = excluded.name_key,
      color = excluded.color
    where excluded.updated_at > t.updated_at
    returning t.id
  )
  select coalesce(array_agg(id), '{}') into ids from written_rows;
  written := written || jsonb_build_object('tags', to_jsonb(ids));

  with input as (
    select distinct on (r.id) r.*
    from jsonb_populate_recordset(null::public.task_tags, coalesce(changes -> 'task_tags', '[]')) r
    order by r.id, r.updated_at desc
  ), written_rows as (
    insert into public.task_tags as t (
      user_id, id, created_at, updated_at, deleted_at, task_id, tag_id
    )
    select uid, i.id, i.created_at, i.updated_at, i.deleted_at, i.task_id, i.tag_id
    from input i
    on conflict (user_id, id) do update set
      created_at = excluded.created_at, updated_at = excluded.updated_at,
      deleted_at = excluded.deleted_at, task_id = excluded.task_id, tag_id = excluded.tag_id
    where excluded.updated_at > t.updated_at
    returning t.id
  )
  select coalesce(array_agg(id), '{}') into ids from written_rows;
  written := written || jsonb_build_object('task_tags', to_jsonb(ids));

  return jsonb_build_object('written', written);
end;
$$;

-- server_seq'i `since`'ten büyük kayıtları, sırayla ve en fazla `lim` tane döndürür.
-- Dönüş: {
--   records: [{ collection, record }],  -- record: satırın sütunları (user_id hariç)
--   next: bir sonraki çağrının since değeri,
--   has_more: daha fazla kayıt var mı,
--   purged_seq: since bundan küçükse (ve 0 değilse) istemci tam eşitleme yapmalı
-- }
create function public.pull(client_schema int, since bigint, lim int default 500)
returns jsonb
language plpgsql
stable
set search_path = ''
as $$
declare
  uid uuid := public.require_user();
  page_size int := least(greatest(coalesce(lim, 500), 1), 1000);
  rows jsonb;
  has_more boolean;
begin
  perform public.assert_client_schema(client_schema);

  select coalesce(jsonb_agg(jsonb_build_object('collection', u.collection, 'record', u.record)
                            order by u.seq), '[]')
  into rows
  from (
    select * from (
      select 'tasks' as collection, r.server_seq as seq, to_jsonb(r) - 'user_id' as record
        from public.tasks r where r.user_id = uid and r.server_seq > since
      union all
      select 'categories', r.server_seq, to_jsonb(r) - 'user_id'
        from public.categories r where r.user_id = uid and r.server_seq > since
      union all
      select 'tags', r.server_seq, to_jsonb(r) - 'user_id'
        from public.tags r where r.user_id = uid and r.server_seq > since
      union all
      select 'task_tags', r.server_seq, to_jsonb(r) - 'user_id'
        from public.task_tags r where r.user_id = uid and r.server_seq > since
    ) all_rows
    order by seq
    limit page_size + 1
  ) u;

  has_more := jsonb_array_length(rows) > page_size;
  if has_more then
    rows := rows - page_size;
  end if;

  return jsonb_build_object(
    'records', rows,
    'next', coalesce((rows -> -1 -> 'record' ->> 'server_seq')::bigint, since),
    'has_more', has_more,
    'purged_seq', coalesce((select s.purged_seq from public.sync_users s where s.user_id = uid), 0)
  );
end;
$$;

-- Silineli `retention`'dan uzun süre geçmiş kayıtları kalıcı siler ve her kullanıcının
-- purged_seq'ini ilerletir (X10). pg_cron ile günde bir çalışır; istemciye kapalıdır.
create function public.purge_deleted(retention interval default interval '30 days')
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  cutoff timestamptz := now() - retention;
  removed bigint;
begin
  with t as (
    delete from public.tasks where deleted_at is not null and server_updated_at < cutoff
    returning user_id, server_seq
  ), c as (
    delete from public.categories where deleted_at is not null and server_updated_at < cutoff
    returning user_id, server_seq
  ), g as (
    delete from public.tags where deleted_at is not null and server_updated_at < cutoff
    returning user_id, server_seq
  ), l as (
    delete from public.task_tags where deleted_at is not null and server_updated_at < cutoff
    returning user_id, server_seq
  ), purged as (
    select * from t union all select * from c union all select * from g union all select * from l
  ), per_user as (
    insert into public.sync_users as s (user_id, purged_seq)
    select user_id, max(server_seq) from purged group by user_id
    on conflict (user_id) do update set purged_seq = greatest(s.purged_seq, excluded.purged_seq)
  )
  select count(*) into removed from purged;
  return removed;
end;
$$;

-- Oturumdaki kullanıcıyı ve (cascade ile) tüm verisini siler (X11).
create function public.delete_account()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := public.require_user();
begin
  delete from auth.users where id = uid;
end;
$$;

-- Supabase yeni fonksiyonlarda da anon'a çalıştırma yetkisi verir; daraltılır.
revoke execute on function
  public.stamp_server_columns(),
  public.require_user(),
  public.assert_client_schema(int),
  public.push(int, jsonb),
  public.pull(int, bigint, int),
  public.purge_deleted(interval),
  public.delete_account()
from public, anon, authenticated;
grant execute on function
  public.require_user(),
  public.assert_client_schema(int),
  public.push(int, jsonb),
  public.pull(int, bigint, int),
  public.delete_account()
to authenticated;

-- Realtime (X5): tablolardaki değişiklikler "şimdi çek" sinyali olarak yayınlanır.
-- Yayın Supabase'de hazır gelir; başka bir Postgres'te yoksa atlanır.
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime
      add table public.tasks, public.categories, public.tags, public.task_tags;
  end if;
end;
$$;
