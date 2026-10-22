-- =====================================================================
--  Mise à jour 3 : voir les parents de ses familles et leur dernière connexion
-- =====================================================================
create or replace function public.family_parents()
returns table(family_id uuid, email text, role text, last_sign_in timestamptz)
language sql stable security definer set search_path = public as $$
  select m.family_id, u.email::text, m.role, u.last_sign_in_at
  from family_members m join auth.users u on u.id = m.user_id
  where public.is_member(m.family_id)
  order by m.created_at;
$$;
revoke all on function public.family_parents() from public;
grant execute on function public.family_parents() to authenticated;
