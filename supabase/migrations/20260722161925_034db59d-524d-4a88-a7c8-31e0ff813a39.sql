
ALTER FUNCTION public.enforce_contact_limit() SET search_path = public;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.enforce_contact_limit() FROM PUBLIC, anon, authenticated;
