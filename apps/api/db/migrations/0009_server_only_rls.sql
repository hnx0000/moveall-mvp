DO $$
DECLARE
  table_name text;
  application_tables constant text[] := ARRAY[
    'users',
    'sports',
    'routines',
    'workout_sessions',
    'posts',
    'comments',
    'knowledge_articles',
    'knowledge_feedback',
    'oauth_identities',
    'follows',
    'user_blocks',
    'direct_messages',
    'post_shares',
    'auth_sessions',
    'user_consents',
    'media_objects',
    'health_integrations',
    'content_reports',
    'notifications'
  ];
BEGIN
  FOREACH table_name IN ARRAY application_tables LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', table_name);
    EXECUTE format('ALTER TABLE public.%I FORCE ROW LEVEL SECURITY', table_name);

    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
      EXECUTE format('REVOKE ALL ON TABLE public.%I FROM anon', table_name);
    END IF;
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
      EXECUTE format('REVOKE ALL ON TABLE public.%I FROM authenticated', table_name);
    END IF;
  END LOOP;
END
$$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM anon;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM authenticated;
  END IF;
END
$$;
