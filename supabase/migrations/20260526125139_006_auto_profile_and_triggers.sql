/*
  # Auto Profile Creation and Demo User Setup

  1. Creates a trigger function that auto-creates a profile
     when a new user signs up via Supabase Auth
  2. Links the profile to the demo school with admin role

  Note: The user must still register via the app's signup page.
  This trigger ensures their profile is automatically created
  with the correct school and role assignments.
*/

-- Function to auto-create profile on user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  INSERT INTO public.profiles (id, school_id, role_id, first_name, last_name, phone, active)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_app_meta_data->>'school_id', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'),
    (SELECT id FROM public.roles WHERE name = COALESCE(NEW.raw_app_meta_data->>'role', 'admin')),
    COALESCE(NEW.raw_user_meta_data->>'first_name', ''),
    COALESCE(NEW.raw_user_meta_data->>'last_name', ''),
    COALESCE(NEW.raw_user_meta_data->>'phone', ''),
    true
  );
  RETURN NEW;
END;
$$;

-- Create trigger
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
