import { Logger } from '../utils/logger';

export interface RepairResult {
  code: string;
  repaired: boolean;
  fixes: string[];
}

/**
 * Intelligent Syntax Healer for Fixora AI.
 * Automatically detects and repairs common syntax errors:
 * - Unclosed braces, brackets, and parentheses: { ... }, [ ... ], ( ... )
 * - Unclosed HTML / JSX tags: <div> ... </div>
 * - Stray trailing syntax tokens at EOF (e.g., lone |, +, ,, .)
 * - Unclosed string quotes ('...', "...", `...`)
 */
export class SyntaxHealer {
  private static logger = Logger.getInstance();

  /**
   * Main entry point to repair broken syntax in source code.
   */
  public static repair(code: string, languageId: string): RepairResult {
    const fixes: string[] = [];
    let currentCode = code;

    // 1. Clean up stray trailing tokens at EOF (e.g., stray |, +, &, ,, .)
    const trailingCleaned = this.cleanTrailingStrayTokens(currentCode);
    if (trailingCleaned !== currentCode) {
      fixes.push('Cleaned stray trailing tokens at EOF');
      currentCode = trailingCleaned;
    }

    // 2. Heal unclosed string literals / template strings
    const stringsHealed = this.healUnclosedStrings(currentCode);
    if (stringsHealed !== currentCode) {
      fixes.push('Closed unclosed string or template literal');
      currentCode = stringsHealed;
    }

    // 3. Heal unclosed brackets, braces, and parentheses
    const bracketsHealed = this.healUnclosedBrackets(currentCode);
    if (bracketsHealed !== currentCode) {
      fixes.push('Balanced and closed missing brackets/braces');
      currentCode = bracketsHealed;
    }

    // 4. Heal unclosed HTML / JSX tags if applicable
    if (['html', 'vue', 'javascriptreact', 'typescriptreact', 'xml'].includes(languageId)) {
      const tagsHealed = this.healUnclosedTags(currentCode);
      if (tagsHealed !== currentCode) {
        fixes.push('Closed unclosed HTML/JSX tags');
        currentCode = tagsHealed;
      }
    }

    const repaired = fixes.length > 0;
    if (repaired) {
      this.logger.info(`SyntaxHealer repaired ${fixes.length} issue(s): ${fixes.join(', ')}`);
    }

    return {
      code: currentCode,
      repaired,
      fixes,
    };
  }

  /**
   * Removes stray lone tokens at the end of the file that cause parser crashes.
   * e.g., trailing lone |, +, &, -, *, /, ,, ., ;, \
   */
  public static cleanTrailingStrayTokens(code: string): string {
    const lines = code.split(/\r?\n/);
    if (lines.length === 0) return code;

    let modified = false;

    // Check last few non-empty lines for stray tokens
    for (let i = lines.length - 1; i >= 0; i--) {
      const trimmed = lines[i].trim();
      if (!trimmed) continue;

      // Match lone punctuation line like "|" or "+" or "&" or "," or ";"
      if (/^[|&+\-*/=,.<>?\\~`^!]+$/.test(trimmed)) {
        lines.splice(i, 1);
        modified = true;
        continue;
      }

      // Check if line ends with an illegal trailing operator like `foo |`
      if (/[^\s|&+\-*/=,.]\s*[|&+\-*/=,]$/.test(lines[i])) {
        // Strip trailing operator if not inside comment/string
        lines[i] = lines[i].replace(/\s*[|&+\-*/=,]\s*$/, '');
        modified = true;
      }

      break;
    }

    return modified ? lines.join('\n') : code;
  }

  /**
   * Automatically closes unclosed string literals or template strings at EOF.
   */
  public static healUnclosedStrings(code: string): string {
    let inSingle = false;
    let inDouble = false;
    let inTemplate = false;
    let escaped = false;

    for (let i = 0; i < code.length; i++) {
      const char = code[i];

      if (escaped) {
        escaped = false;
        continue;
      }

      if (char === '\\') {
        escaped = true;
        continue;
      }

      if (char === "'" && !inDouble && !inTemplate) {
        inSingle = !inSingle;
      } else if (char === '"' && !inSingle && !inTemplate) {
        inDouble = !inDouble;
      } else if (char === '`' && !inSingle && !inDouble) {
        inTemplate = !inTemplate;
      }
    }

    let healed = code;
    if (inSingle) healed += "'";
    if (inDouble) healed += '"';
    if (inTemplate) healed += '`';

    return healed;
  }

  /**
   * Tracks opening { [ ( and appends missing matching closing brackets ) ] } at EOF.
   */
  public static healUnclosedBrackets(code: string): string {
    const stack: { char: string; index: number }[] = [];
    let inString: string | null = null;
    let inLineComment = false;
    let inBlockComment = false;
    let escaped = false;

    for (let i = 0; i < code.length; i++) {
      const char = code[i];
      const next = i + 1 < code.length ? code[i + 1] : '';

      if (escaped) {
        escaped = false;
        continue;
      }

      if (char === '\\') {
        escaped = true;
        continue;
      }

      // Handle comments
      if (inLineComment) {
        if (char === '\n') inLineComment = false;
        continue;
      }
      if (inBlockComment) {
        if (char === '*' && next === '/') {
          inBlockComment = false;
          i++;
        }
        continue;
      }

      // Handle strings
      if (inString) {
        if (char === inString) inString = null;
        continue;
      }

      if (char === '/' && next === '/') {
        inLineComment = true;
        i++;
        continue;
      }
      if (char === '/' && next === '*') {
        inBlockComment = true;
        i++;
        continue;
      }

      if (char === "'" || char === '"' || char === '`') {
        inString = char;
        continue;
      }

      // Track brackets
      if (char === '{' || char === '(' || char === '[') {
        stack.push({ char, index: i });
      } else if (char === '}' || char === ')' || char === ']') {
        const top = stack[stack.length - 1];
        if (
          top &&
          ((top.char === '{' && char === '}') ||
            (top.char === '(' && char === ')') ||
            (top.char === '[' && char === ']'))
        ) {
          stack.pop();
        }
      }
    }

    if (stack.length === 0) {
      return code;
    }

    // Append matching closing brackets in reverse order
    let closers = '';
    while (stack.length > 0) {
      const unclosed = stack.pop()!;
      if (unclosed.char === '{') closers += '\n}';
      else if (unclosed.char === '(') closers += ')';
      else if (unclosed.char === '[') closers += ']';
    }

    return code + closers;
  }

  /**
   * Tracks unclosed HTML / JSX tags and appends missing closing tags.
   */
  public static healUnclosedTags(code: string): string {
    const voidTags = new Set([
      'area',
      'base',
      'br',
      'col',
      'embed',
      'hr',
      'img',
      'input',
      'link',
      'meta',
      'param',
      'source',
      'track',
      'wbr',
    ]);

    const tagRegex = /<\/?([a-zA-Z0-9_-]+)(?:\s+[^>]*?)?(\/?)>/g;
    const tagStack: string[] = [];
    let match: RegExpExecArray | null;

    while ((match = tagRegex.exec(code)) !== null) {
      const full = match[0];
      const tagName = match[1].toLowerCase();
      const isSelfClosing = match[2] === '/' || full.endsWith('/>') || voidTags.has(tagName);
      const isClosing = full.startsWith('</');

      if (isSelfClosing) continue;

      if (isClosing) {
        if (tagStack.length > 0 && tagStack[tagStack.length - 1] === tagName) {
          tagStack.pop();
        }
      } else {
        tagStack.push(tagName);
      }
    }

    if (tagStack.length === 0) {
      return code;
    }

    // Append closing tags in reverse order
    let closingTags = '';
    while (tagStack.length > 0) {
      const tag = tagStack.pop()!;
      closingTags += `\n</${tag}>`;
    }

    return code + closingTags;
  }
}
