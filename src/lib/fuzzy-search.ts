function normalizeFuzzyText(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

export function fuzzyScore(needle: string, haystack: string) {
  const normalizedNeedle = normalizeFuzzyText(needle);
  const normalizedHaystack = normalizeFuzzyText(haystack);

  if (!normalizedNeedle || !normalizedHaystack) {
    return 0;
  }

  let score = 0;
  let searchIndex = 0;
  let previousMatchIndex = -1;
  let firstMatchIndex = -1;
  let consecutiveMatches = 0;

  for (const character of normalizedNeedle) {
    const matchIndex = normalizedHaystack.indexOf(character, searchIndex);
    if (matchIndex === -1) {
      return 0;
    }

    if (firstMatchIndex === -1) {
      firstMatchIndex = matchIndex;
    }

    if (previousMatchIndex !== -1 && matchIndex === previousMatchIndex + 1) {
      consecutiveMatches += 1;
    } else {
      consecutiveMatches = 0;
    }

    const gap = previousMatchIndex === -1 ? matchIndex : matchIndex - previousMatchIndex - 1;

    score += 10;
    score += Math.max(0, 16 - gap * 3);
    score += consecutiveMatches * 4;

    if (matchIndex === 0) {
      score += 14;
    }

    previousMatchIndex = matchIndex;
    searchIndex = matchIndex + 1;
  }

  if (normalizedHaystack.startsWith(normalizedNeedle)) {
    score += 40;
  }

  score += Math.max(0, 20 - firstMatchIndex * 2);
  score += Math.max(0, normalizedNeedle.length * 2);

  if (normalizedHaystack === normalizedNeedle) {
    score += 50;
  }

  return score;
}
