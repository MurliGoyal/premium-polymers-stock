export function collapseWhitespace(value: string) {
  return value.trim().replace(/\s+/g, " ");
}

export function normalizeRecordName(value: string) {
  return collapseWhitespace(value).toLowerCase();
}
