/*
  # Fix profile trigger - Simplify to avoid casting issues
  
  The trigger was failing because raw_app_meta_data might not 
  contain the school_id key when created via admin API.
  This version handles all edge cases safely.
*/

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_school_id uuid;
  v_role_id uuid;
BEGIN
  -- Safely get school_id with fallback to demo school
  BEGIN
    IF NEW.raw_app_meta_data ? 'school_id' THEN
      v_school_id := (NEW.raw_app_meta_data->>'school_id')::uuid;
    ELSE
      v_school_id := 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'::uuid;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    v_school_id := 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'::uuid;
  END;

  -- Safely get role with fallback to admin
  BEGIN
    IF NEW.raw_app_meta_data ? 'role' THEN
      SELECT id INTO v_role_id FROM public.roles WHERE name = NEW.raw_app_meta_data->>'role';
    END IF;
    IF v_role_id IS NULL THEN
      SELECT id INTO v_role_id FROM public.roles WHERE name = 'admin';
    END IF;
  EXCEPTION WHEN OTHERS THEN
    SELECT id INTO v_role_id FROM public.roles WHERE name = 'admin';
  END;

  INSERT INTO public.profiles (id, school_id, role_id, first_name, last_name, phone, active)
  VALUES (
    NEW.id,
    v_school_id,
    v_role_id,
    COALESCE(NEW.raw_user_meta_data->>'first_name', NEW.raw_app_meta_data->>'first_name', ''),
    COALESCE(NEW.raw_user_meta_data->>'last_name', NEW.raw_app_meta_data->>'last_name', ''),
    COALESCE(NEW.raw_user_meta_data->>'phone', NEW.raw_app_meta_data->>'phone', ''),
    true
  );
  RETURN NEW;
END;
$$;
