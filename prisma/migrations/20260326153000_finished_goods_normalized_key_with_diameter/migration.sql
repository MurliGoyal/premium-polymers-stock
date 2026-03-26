-- Rebuild finished_goods.normalized_name to include warehouse and optional diameter,
-- allowing same-name finished goods to coexist when diameter differs.
UPDATE finished_goods
SET normalized_name = CASE
  WHEN diameter_value IS NULL THEN
    lower(trim(warehouse_code)) || '::' || lower(trim(name))
  ELSE
    lower(trim(warehouse_code)) || '::' || lower(trim(name)) || '::' || (diameter_value::text) ||
    COALESCE('::' || NULLIF(lower(trim(diameter_unit)), ''), '')
END;
