-- Rebuild raw_materials.normalized_name to include dimensional specs,
-- allowing same-name raw materials to coexist when their tracked specs differ.
UPDATE "raw_materials"
SET "normalized_name" =
  lower(regexp_replace(trim("name"), '\s+', ' ', 'g'))
  || '::gsm=' || COALESCE("gsm"::text, 'na')
  || '::micron=' || COALESCE("micron"::text, 'na')
  || '::thickness=' || COALESCE("thickness_value"::text, 'na')
  || '::thickness-unit=' || CASE
    WHEN "thickness_value" IS NULL THEN 'na'
    ELSE COALESCE(NULLIF(lower(regexp_replace(trim("thickness_unit"), '\s+', ' ', 'g')), ''), 'na')
  END
  || '::size=' || COALESCE(NULLIF(lower(regexp_replace(trim("size_value"), '\s+', ' ', 'g')), ''), 'na')
  || '::size-unit=' || CASE
    WHEN NULLIF(lower(regexp_replace(trim("size_value"), '\s+', ' ', 'g')), '') IS NULL THEN 'na'
    ELSE COALESCE(NULLIF(lower(regexp_replace(trim("size_unit"), '\s+', ' ', 'g')), ''), 'na')
  END;
