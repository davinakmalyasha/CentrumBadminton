-- ============================================================
-- Fix: grant EXECUTE on role helpers (Phase 1 gap — is_owner()
-- was never callable by authenticated sessions, breaking every
-- owner check at runtime)
-- ============================================================

grant execute on function public.is_owner() to anon, authenticated;
grant execute on function public.is_staff() to anon, authenticated;
