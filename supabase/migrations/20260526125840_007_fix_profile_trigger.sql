/*
  # Fix auto profile trigger - Cast school_id to uuid

  The handle_new_user function was failing because
  raw_app_meta_data->>'school_id' returns text, not uuid.
  This fix adds proper casting.
*/

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  INSERT INTO public.profiles (id, school_id, role_id, first_name, last_name, phone, active)
  VALUES (
    NEW.id,
    COALESCE((NEW.raw_app_meta_data->>'school_id')::uuid, 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'::uuid),
    (SELECT id FROM public.roles WHERE name = COALESCE(NEW.raw_app_meta_data->>'role', 'admin')),
    COALESCE(NEW.raw_user_meta_data->>'first_name', ''),
    COALESCE(NEW.raw_user_meta_data->>'last_name', ''),
    COALESCE(NEW.raw_user_meta_data->>'phone', ''),
    true
  );
  RETURN NEW;
END;
$$;
