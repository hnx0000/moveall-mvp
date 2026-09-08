-- This table is accessed only by the authenticated GROOV backend, never browser DB roles.
ALTER TABLE public.sharing_crews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sharing_crews FORCE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.sharing_crews FROM PUBLIC;
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    REVOKE ALL ON TABLE public.sharing_crews FROM anon;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    REVOKE ALL ON TABLE public.sharing_crews FROM authenticated;
  END IF;
END
$$;
