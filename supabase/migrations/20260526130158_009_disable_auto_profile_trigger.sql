/*
  # Disable auto profile trigger temporarily
  
  The trigger is causing issues with the admin API user creation.
  We'll manage profiles manually instead.
*/

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_user();
