-- ============================================================================
-- Storefronts: PLACES Pass members open up to 5 shops (everyone else 1; admins as many as they need),
-- and the three launch shops belong to the PLACES admin, so launch products are sold by PLACES itself.
--
-- Safe to run more than once. Removes only the one-shop-per-member rule; no data is dropped.
-- ============================================================================

alter table public.shops drop constraint if exists shops_owner_id_key;
create index if not exists shops_owner_idx on public.shops (owner_id);

/** How many storefronts someone may run. Keep in step with STOREFRONTS in lib/config.ts. */
create or replace function public.shop_limit(p_owner text)
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when exists (select 1 from public.admin_users where user_id::text = p_owner) then 50
    when public.has_plan(p_owner, 'pass') then 5
    else 1
  end;
$$;
revoke all on function public.shop_limit(text) from public;
grant execute on function public.shop_limit(text) to anon, authenticated;

create or replace function public.check_shop_limit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- Changes made by PLACES itself (migrations, the service role) aren't members opening shops.
  if (select auth.uid()) is null then
    return new;
  end if;
  perform pg_advisory_xact_lock(hashtext('places_shops_' || new.owner_id));
  if (select count(*) from public.shops where owner_id = new.owner_id and id <> new.id) >= public.shop_limit(new.owner_id) then
    raise exception using
      errcode = 'P0001',
      message = case when public.shop_limit(new.owner_id) = 1
        then 'You already have a shop. PLACES Pass lets you open up to 5 storefronts.'
        else 'You’ve reached your storefront limit.' end;
  end if;
  return new;
end;
$$;
revoke all on function public.check_shop_limit() from public, anon, authenticated;

drop trigger if exists shops_limit on public.shops;
create trigger shops_limit before insert or update of owner_id on public.shops
  for each row execute function public.check_shop_limit();

-- The launch shops are PLACES's own: they belong to the first admin (once that admin has a profile).
update public.shops s
   set owner_id = a.id
  from (
    select p.id
      from public.admin_users au
      join public.profiles p on p.id = au.user_id::text
     order by au.created_at
     limit 1
  ) a
 where s.id in ('shp_sunsoil', 'shp_luna', 'shp_bloom')
   and s.owner_id <> a.id;
