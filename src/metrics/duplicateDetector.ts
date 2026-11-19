import { ReviewFinding } from '../types';

export interface DuplicateBlock {
  startLine1: number;
  endLine1: number;
  startLine2: number;
  endLine2: number;
  lineCount: number;
  snippet: string;
}

/**
 * Deterministic, offline duplicate code detector.
 * Identifies copy-pasted code blocks within a source file.
 */
export class DuplicateDetector {
  /**
   * Scans a file for duplicate code blocks of at least minBlockLines.
   */
  public static detect(code: string, filePath: string, minBlockLines = 4): ReviewFinding[] {
    const rawLines = code.split(/\r?\n/);
    const normalizedLines = rawLines.map((l) => l.trim().replace(/\s+/g, ' '));
    const findings: ReviewFinding[] = [];
    const duplicates: DuplicateBlock[] = [];

    const numLines = normalizedLines.length;
    if (numLines < minBlockLines * 2) {
      return findings;
    }

    // Build block signatures
    const blocks: Map<string, number[]> = new Map();

    for (let i = 0; i <= numLines - minBlockLines; i++) {
      // Skip empty or trivial blocks
      const slice = normalizedLines.slice(i, i + minBlockLines);
      const isMeaningful = slice.some((l) => l.length > 5 && !l.startsWith('//') && !l.startsWith('/*') && l !== '{' && l !== '}');
      if (!isMeaningful) {
        continue;
      }

      const key = slice.join(';');
      const existing = blocks.get(key);
      if (existing) {
        existing.push(i);
      } else {
        blocks.set(key, [i]);
      }
    }

    // Find overlapping or repeated blocks
    const reportedRanges = new Set<string>();

    for (const [, startIndices] of blocks.entries()) {
      if (startIndices.length < 2) continue;

      for (let a = 0; a < startIndices.length; a++) {
        for (let b = a + 1; b < startIndices.length; b++) {
          const idx1 = startIndices[a];
          const idx2 = startIndices[b];

          // Ensure blocks do not overlap heavily
          if (Math.abs(idx1 - idx2) < minBlockLines) continue;

          // Extend match length
          let matchLen = minBlockLines;
          while (
            idx1 + matchLen < numLines &&
            idx2 + matchLen < numLines &&
            normalizedLines[idx1 + matchLen] === normalizedLines[idx2 + matchLen] &&
            normalizedLines[idx1 + matchLen].length > 0
          ) {
            matchLen++;
          }

          const signature = `${idx1}-${idx2}-${matchLen}`;
          if (reportedRanges.has(signature)) continue;
          reportedRanges.add(signature);

          const snippet = rawLines.slice(idx1, idx1 + Math.min(3, matchLen)).join('\n');

          findings.push({
            id: `duplicate-${idx1 + 1}-${idx2 + 1}`,
            title: `Duplicate Code Block (${matchLen} lines)`,
            severity: 'info',
            category: 'quality',
            filePath,
            line: idx2 + 1,
            endLine: idx2 + matchLen,
            explanation: `Identical code block of ${matchLen} lines was duplicated from line ${idx1 + 1}.`,
            whyItMatters: 'Duplicated code increases technical debt, bloats file size, and requires fixing bugs in multiple places when logic changes.',
            suggestedSolution: 'Extract the duplicated logic into a shared helper function or utility module.',
            suggestedFix: snippet,
            confidence: 0.99,
            source: 'static',
          });
        }
      }
    }

    return findings;
  }
}
