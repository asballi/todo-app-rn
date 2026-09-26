-- Silinmiş kayıtların günlük temizliği (X10). Supabase'de pg_cron hazır gelir;
-- pg_cron'u olmayan bir Postgres'te (ör. yerel testler) bu adım uyarıyla atlanır ve
-- purge_deleted() başka bir zamanlayıcıyla ya da elle çalıştırılmalıdır.
do $$
begin
  create extension if not exists pg_cron with schema pg_catalog;
  -- Aynı adla yeniden zamanlamak mevcut işi günceller.
  perform cron.schedule('purge-deleted', '17 3 * * *', 'select public.purge_deleted()');
exception
  when others then
    raise notice 'pg_cron kullanılamıyor (%); purge_deleted() zamanlanmadı', sqlerrm;
end;
$$;
