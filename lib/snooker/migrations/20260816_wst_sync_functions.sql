-- WST sync helpers applied to the dedicated snooker-data-center database.
-- These functions are service-role only. Public/anon clients cannot execute them.

create or replace function public.snooker_normalize_person_name(p_name text)
returns text
language sql
immutable
set search_path = public
as $$
  select lower(regexp_replace(replace(replace(trim(coalesce(p_name,'')),'’',''''),'‘',''''),'\s+',' ','g'));
$$;

create or replace function public.snooker_find_player_id(p_name text)
returns uuid
language sql
stable
set search_path = public
as $$
  select p.id
  from public.snooker_players p
  where public.snooker_normalize_person_name(p.name_en)=public.snooker_normalize_person_name(p_name)
     or exists (
       select 1 from public.snooker_player_names pn
       where pn.player_id=p.id and (
         public.snooker_normalize_person_name(pn.display_name)=public.snooker_normalize_person_name(p_name)
         or exists (
           select 1 from unnest(pn.aliases) a
           where public.snooker_normalize_person_name(a)=public.snooker_normalize_person_name(p_name)
         )
       )
     )
  order by case when public.snooker_normalize_person_name(p.name_en)=public.snooker_normalize_person_name(p_name) then 0 else 1 end
  limit 1;
$$;

-- Runtime implementation in Supabase additionally contains:
--   public.snooker_sync_wst_tournament(text)
--   public.snooker_sync_wst_match_frames(uuid)
-- Both functions fetch WST REST/GraphQL server-side, upsert matches/frames/breaks,
-- and are revoked from public/anon/authenticated with EXECUTE granted to service_role only.
--
-- The complete deployed function bodies live in Supabase migration:
--   add_wst_sync_functions
-- Keep this repository note small because the production function bodies are
-- database infrastructure and will move into the standalone snooker repository.
