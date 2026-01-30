import { FISH_TYPE_MAP } from './fishTypes.mjs'

export function classifySeafood(title) {
  if (!title) {
    return {
      fish_type: 'Unknown',
      confidence: 'none',
    }
  }

  const t = title.toLowerCase()

  for (const [needle, label] of FISH_TYPE_MAP) {
    if (t.includes(needle)) {
      return {
        fish_type: label,
        confidence: 'high',
      }
    }
  }

  return {
    fish_type: 'Unknown',
    confidence: 'low',
  }
}
