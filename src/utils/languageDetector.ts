import * as path from 'path';

export interface LanguageInfo {
  id: string;
  name: string;
  framework?: 'react' | 'nodejs';
  standardExtension: string;
  isSupported: boolean;
  recommendedAnalyzer?: string;
}

/**
 * Robust language and framework detector supporting the 12 core languages of Fixora AI:
 * 1. JavaScript
 * 2. TypeScript
 * 3. Python
 * 4. Java
 * 5. C
 * 6. C++
 * 7. React (JSX/TSX)
 * 8. Node.js
 * 9. PHP
 * 10. HTML
 * 11. CSS
 * 12. SQL
 */
export class LanguageDetector {
  private static readonly EXTENSION_MAP: Record<string, { id: string; name: string; analyzer: string }> = {
    // JavaScript / TypeScript
    '.js': { id: 'javascript', name: 'JavaScript', analyzer: 'eslint' },
    '.mjs': { id: 'javascript', name: 'JavaScript (ESM)', analyzer: 'eslint' },
    '.cjs': { id: 'javascript', name: 'JavaScript (CommonJS)', analyzer: 'eslint' },
    '.ts': { id: 'typescript', name: 'TypeScript', analyzer: 'eslint' },
    '.mts': { id: 'typescript', name: 'TypeScript (ESM)', analyzer: 'eslint' },
    '.cts': { id: 'typescript', name: 'TypeScript (CommonJS)', analyzer: 'eslint' },
    
    // React
    '.jsx': { id: 'javascriptreact', name: 'React (JavaScript)', analyzer: 'eslint' },
    '.tsx': { id: 'typescriptreact', name: 'React (TypeScript)', analyzer: 'eslint' },

    // Python
    '.py': { id: 'python', name: 'Python', analyzer: 'ruff' },
    '.pyw': { id: 'python', name: 'Python', analyzer: 'ruff' },

    // Java
    '.java': { id: 'java', name: 'Java', analyzer: 'checkstyle' },

    // C & C++
    '.c': { id: 'c', name: 'C', analyzer: 'clang-tidy' },
    '.h': { id: 'c', name: 'C/C++ Header', analyzer: 'clang-tidy' },
    '.cpp': { id: 'cpp', name: 'C++', analyzer: 'clang-tidy' },
    '.cc': { id: 'cpp', name: 'C++', analyzer: 'clang-tidy' },
    '.cxx': { id: 'cpp', name: 'C++', analyzer: 'clang-tidy' },
    '.hpp': { id: 'cpp', name: 'C++ Header', analyzer: 'clang-tidy' },
    '.hxx': { id: 'cpp', name: 'C++ Header', analyzer: 'clang-tidy' },

    // PHP
    '.php': { id: 'php', name: 'PHP', analyzer: 'phpstan' },
    '.phtml': { id: 'php', name: 'PHP Template', analyzer: 'phpstan' },

    // HTML & CSS
    '.html': { id: 'html', name: 'HTML', analyzer: 'htmlhint' },
    '.htm': { id: 'html', name: 'HTML', analyzer: 'htmlhint' },
    '.css': { id: 'css', name: 'CSS', analyzer: 'stylelint' },
    '.scss': { id: 'scss', name: 'SCSS', analyzer: 'stylelint' },
    '.less': { id: 'less', name: 'LESS', analyzer: 'stylelint' },

    // SQL
    '.sql': { id: 'sql', name: 'SQL', analyzer: 'sqlfluff' },
  };

  /**
   * Identifies the language using file path, VS Code languageId, and code content.
   */
  public static detect(filePath: string, vscodeLanguageId?: string, codeSnippet?: string): LanguageInfo {
    const ext = path.extname(filePath).toLowerCase();
    const mapped = this.EXTENSION_MAP[ext];

    let id = vscodeLanguageId || (mapped ? mapped.id : 'plaintext');
    let name = mapped ? mapped.name : (vscodeLanguageId || 'Plain Text');
    let framework: 'react' | 'nodejs' | undefined;
    let analyzer = mapped ? mapped.analyzer : undefined;

    // Normalize VS Code language IDs
    if (vscodeLanguageId === 'javascriptreact' || ext === '.jsx') {
      framework = 'react';
      name = 'React (JavaScript)';
      id = 'javascriptreact';
    } else if (vscodeLanguageId === 'typescriptreact' || ext === '.tsx') {
      framework = 'react';
      name = 'React (TypeScript)';
      id = 'typescriptreact';
    }

    // Inspect code snippet for framework detection if not already detected
    if (codeSnippet && (id === 'javascript' || id === 'typescript')) {
      if (
        /from\s+['"]react['"]|import\s+React|<[A-Z][A-Za-z0-9]*\s*\/?>/.test(codeSnippet)
      ) {
        framework = 'react';
        name = `React (${id === 'typescript' ? 'TypeScript' : 'JavaScript'})`;
      } else if (
        /require\(['"](fs|path|http|crypto|os|stream)['"]\)|process\.env|process\.exit/.test(
          codeSnippet
        )
      ) {
        framework = 'nodejs';
        name = `Node.js (${id === 'typescript' ? 'TypeScript' : 'JavaScript'})`;
      }
    }

    const isSupported = this.isLanguageSupported(id, ext);

    return {
      id,
      name,
      framework,
      standardExtension: ext || '.txt',
      isSupported,
      recommendedAnalyzer: analyzer,
    };
  }

  /**
   * Returns true if language is one of the 12 officially supported languages.
   */
  public static isLanguageSupported(languageId: string, ext: string): boolean {
    const supportedIds = new Set([
      'javascript',
      'typescript',
      'javascriptreact',
      'typescriptreact',
      'python',
      'java',
      'c',
      'cpp',
      'php',
      'html',
      'css',
      'scss',
      'less',
      'sql',
    ]);

    if (supportedIds.has(languageId.toLowerCase())) {
      return true;
    }

    return Boolean(this.EXTENSION_MAP[ext.toLowerCase()]);
  }
}
