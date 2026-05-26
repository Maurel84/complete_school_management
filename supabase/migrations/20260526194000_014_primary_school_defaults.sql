/*
  # Primary school defaults

  New schools created after this migration default to a
  `maternelle_primaire` setup.
*/

ALTER TABLE schools
  ALTER COLUMN establishment_type SET DEFAULT 'maternelle_primaire';
