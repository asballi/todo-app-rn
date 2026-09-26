-- Testler için Supabase'in migration'ların dayandığı parçalarının küçük bir taklidi:
-- roller, auth.users, auth.uid() ve Realtime yayını. Gerçek Supabase'de bunlar hazır
-- gelir; bu dosya yalnızca `npm run test:db` tarafından kullanılır.
create role anon nologin;
create role authenticated nologin;
create role service_role nologin bypassrls;

create schema auth;
grant usage on schema auth to anon, authenticated, service_role;
grant usage on schema public to anon, authenticated, service_role;

create table auth.users (
  id uuid primary key,
  email text
);

-- Supabase'deki tanımla aynı: kimlik, isteğin JWT'sindeki "sub" alanıdır.
create function auth.uid()
returns uuid
language sql
stable
as $$
  select coalesce(
    nullif(current_setting('request.jwt.claim.sub', true), ''),
    (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub')
  )::uuid
$$;

-- Supabase yeni tablo ve fonksiyonlarda bu rollere varsayılan yetki verir;
-- migration'ların bunları doğru daralttığı böylece test edilir.
alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
alter default privileges in schema public grant execute on functions to anon, authenticated, service_role;

create publication supabase_realtime;
