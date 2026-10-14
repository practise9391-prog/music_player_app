// ──────────────────────────────────────────────────────────
// LyricsLanguageDetector — Part 14
// Zero-network, offline-first language detector based on
// Unicode script analysis and character set distributions.
// Never calls the network.
// ──────────────────────────────────────────────────────────

export interface LanguageDetectionResult {
  code: string;
  name: string;
  confidence: number; // 0 to 1
  label: string;      // e.g. "Language: Telugu" or "Language: Unknown"
}

// Unicode ranges for reliable script identification
const SCRIPT_RANGES: Array<{ name: string; code: string; regex: RegExp }> = [
  { name: 'Telugu', code: 'te', regex: /[\u0C00-\u0C7F]/g },
  { name: 'Hindi', code: 'hi', regex: /[\u0900-\u097F]/g },
  { name: 'Tamil', code: 'ta', regex: /[\u0B80-\u0BFF]/g },
  { name: 'Kannada', code: 'kn', regex: /[\u0C80-\u0CFF]/g },
  { name: 'Malayalam', code: 'ml', regex: /[\u0D00-\u0D7F]/g },
  { name: 'Bengali', code: 'bn', regex: /[\u0980-\u09FF]/g },
  { name: 'Gujarati', code: 'gu', regex: /[\u0A80-\u0AFF]/g },
  { name: 'Punjabi (Gurmukhi)', code: 'pa', regex: /[\u0A00-\u0A7F]/g },
  { name: 'Japanese', code: 'ja', regex: /[\u3040-\u309F\u30A0-\u30FF]/g },
  { name: 'Korean', code: 'ko', regex: /[\uAC00-\uD7AF\u1100-\u11FF]/g },
  { name: 'Chinese', code: 'zh', regex: /[\u4E00-\u9FFF]/g },
  { name: 'Russian / Cyrillic', code: 'ru', regex: /[\u0400-\u04FF]/g },
  { name: 'Arabic', code: 'ar', regex: /[\u0600-\u06FF]/g },
  { name: 'Greek', code: 'el', regex: /[\u0370-\u03FF]/g },
  { name: 'Thai', code: 'th', regex: /[\u0E00-\u0E7F]/g },
  { name: 'Hebrew', code: 'he', regex: /[\u0590-\u05FF]/g },
];

/** Latin alphabet common word clues for basic Western language distinction */
const LATIN_HINTS: Array<{ name: string; code: string; words: string[] }> = [
  { name: 'Spanish', code: 'es', words: ['el', 'la', 'de', 'que', 'en', 'los', 'por', 'con', 'para', 'corazon'] },
  { name: 'French', code: 'fr', words: ['le', 'la', 'de', 'et', 'un', 'une', 'je', 'tu', 'dans', 'pour', 'amour'] },
  { name: 'German', code: 'de', words: ['der', 'die', 'das', 'und', 'in', 'den', 'von', 'zu', 'mit', 'ich', 'nicht'] },
  { name: 'Italian', code: 'it', words: ['il', 'la', 'che', 'di', 'per', 'un', 'in', 'mio', 'con', 'amore', 'questo'] },
  { name: 'Portuguese', code: 'pt', words: ['que', 'de', 'para', 'com', 'uma', 'como', 'mais', 'meu', 'voce', 'coracao'] },
  { name: 'English', code: 'en', words: ['the', 'and', 'to', 'of', 'in', 'you', 'is', 'that', 'it', 'for', 'love', 'me', 'my'] },
];

/**
 * Detect the primary language of lyrics text completely offline.
 */
export function detectLyricsLanguage(text: string): LanguageDetectionResult {
  if (!text || text.trim().length === 0) {
    return {
      code: 'unknown',
      name: 'Unknown',
      confidence: 0,
      label: 'Language: Unknown',
    };
  }

  // Strip timestamp tags and brackets first
  const clean = text
    .replace(/\[\d{1,3}:\d{2}(?:[.:]\d{1,3})?\]/g, '')
    .replace(/<\d{1,3}:\d{2}(?:[.:]\d{1,3})?>/g, '')
    .replace(/\[(?:ti|ar|al|by|offset):.*?\]/gi, '')
    .trim();

  if (clean.length < 5) {
    return {
      code: 'unknown',
      name: 'Unknown',
      confidence: 0,
      label: 'Language: Unknown',
    };
  }

  // 1. Check Non-Latin script Unicode blocks
  const scriptCounts: Record<string, number> = {};
  let totalNonAscii = 0;

  for (const script of SCRIPT_RANGES) {
    const matches = clean.match(script.regex);
    if (matches && matches.length > 0) {
      scriptCounts[script.name] = matches.length;
      totalNonAscii += matches.length;
    }
  }

  if (totalNonAscii >= 5) {
    // Find dominant script
    let dominantScript = '';
    let maxCount = 0;
    for (const [name, count] of Object.entries(scriptCounts)) {
      if (count > maxCount) {
        maxCount = count;
        dominantScript = name;
      }
    }

    if (dominantScript) {
      const entry = SCRIPT_RANGES.find((s) => s.name === dominantScript);
      const confidence = Math.min(1, Math.round((maxCount / totalNonAscii) * 100) / 100);
      return {
        code: entry?.code || 'und',
        name: dominantScript,
        confidence,
        label: `Language: ${dominantScript}`,
      };
    }
  }

  // 2. Check Latin text
  const latinMatches = clean.match(/[a-zA-Z]/g);
  if (latinMatches && latinMatches.length >= 10) {
    const lowerWords = clean
      .toLowerCase()
      .replace(/[^a-z\s]/g, ' ')
      .split(/\s+/)
      .filter((w) => w.length > 1);

    const scores: Record<string, number> = {};
    for (const hint of LATIN_HINTS) {
      let score = 0;
      for (const w of lowerWords) {
        if (hint.words.includes(w)) {
          score++;
        }
      }
      scores[hint.name] = score;
    }

    let bestLang = 'English';
    let bestScore = scores['English'] || 0;

    for (const [lang, score] of Object.entries(scores)) {
      if (score > bestScore) {
        bestScore = score;
        bestLang = lang;
      }
    }

    if (bestScore >= 2) {
      const entry = LATIN_HINTS.find((h) => h.name === bestLang);
      return {
        code: entry?.code || 'en',
        name: bestLang,
        confidence: 0.85,
        label: `Language: ${bestLang}`,
      };
    }

    // Default Latin fallback
    return {
      code: 'en',
      name: 'English / Latin',
      confidence: 0.7,
      label: 'Language: English / Latin',
    };
  }

  return {
    code: 'unknown',
    name: 'Unknown',
    confidence: 0,
    label: 'Language: Unknown',
  };
}
