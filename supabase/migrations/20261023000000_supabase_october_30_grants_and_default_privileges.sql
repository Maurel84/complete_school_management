-- ==============================================================================
-- Migration : Supabase October 30 Security Compliance & Universal Grants
-- ==============================================================================
-- Cette migration assure la conformité avec la mise à jour Supabase du 30 octobre.
-- 1. Elle réaffirme explicitement les droits sur TOUTES les tables existantes.
-- 2. Elle configure les DEFAULT PRIVILEGES pour que TOUTES les futures tables créées
--    dans le schéma public reçoivent automatiquement les permissions d'accès Data API
--    (évite les erreurs "permission denied" lors de l'utilisation de supabase-js).
-- ==============================================================================

-- 1. Donner les droits sur le schéma public
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;

-- 2. Accorder les droits d'accès sur toutes les tables existantes
GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated, service_role;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO anon;

-- 3. Accorder les droits sur toutes les séquences existantes (IDs automatiques)
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO authenticated, service_role;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO anon;

-- 4. Accorder les droits sur les fonctions / procédures stockées existantes
GRANT ALL ON ALL ROUTINES IN SCHEMA public TO authenticated, service_role;

-- ==============================================================================
-- 5. CONFIGURATION DES DROITS PAR DÉFAUT POUR LES FUTURES TABLES
-- Ces commandes ordonnent à PostgreSQL d'attribuer automatiquement ces droits
-- à chaque nouvelle table créée à partir du 30 octobre et au-delà.
-- ==============================================================================
ALTER DEFAULT PRIVILEGES IN SCHEMA public 
GRANT ALL ON TABLES TO authenticated, service_role;

ALTER DEFAULT PRIVILEGES IN SCHEMA public 
GRANT SELECT ON TABLES TO anon;

ALTER DEFAULT PRIVILEGES IN SCHEMA public 
GRANT ALL ON SEQUENCES TO authenticated, service_role;

ALTER DEFAULT PRIVILEGES IN SCHEMA public 
GRANT ALL ON ROUTINES TO authenticated, service_role;
