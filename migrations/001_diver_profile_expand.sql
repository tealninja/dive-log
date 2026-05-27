-- Adds body, medical, emergency contact, and gear-owned fields to divers.
-- Run once against an existing DB:
--   wrangler d1 execute dive-log --remote --file=migrations/001_diver_profile_expand.sql
ALTER TABLE divers ADD COLUMN height_in REAL;
ALTER TABLE divers ADD COLUMN body_weight_lbs REAL;
ALTER TABLE divers ADD COLUMN allergies TEXT;
ALTER TABLE divers ADD COLUMN medications TEXT;
ALTER TABLE divers ADD COLUMN health_conditions TEXT;
ALTER TABLE divers ADD COLUMN emergency_name TEXT;
ALTER TABLE divers ADD COLUMN emergency_phone TEXT;
ALTER TABLE divers ADD COLUMN gear TEXT;
