import * as vscode from 'vscode';
import * as path from 'path';

/**
 * File path utilities and pattern matching for Fixora AI.
 */
export class FileUtils {
  /**
   * Checks whether a file should be excluded from review based on configured excludePatterns.
   */
  public static isFileExcluded(filePath: string, customPatterns?: string[]): boolean {
    if (!filePath || typeof filePath !== 'string') {
      return false;
    }
    const config = vscode.workspace.getConfiguration('fixora');
    const patterns = customPatterns || config.get<string[]>('excludePatterns', [
      '**/node_modules/**',
      '**/.git/**',
      '**/dist/**',
      '**/build/**',
      '**/out/**',
      '**/.env*',
      '**/*.min.js',
      '**/vendor/**',
      '**/venv/**',
      '**/__pycache__/**',
      '**/coverage/**',
      '**/*.lock',
      '**/package-lock.json',
    ]);

    const normalizedPath = filePath.replace(/\\/g, '/');

    for (const pattern of patterns) {
      if (this.matchGlob(normalizedPath, pattern.replace(/\\/g, '/'))) {
        return true;
      }
    }

    return false;
  }

  /**
   * Lightweight glob matcher supporting standard wildcards:
   * ** (any directory hierarchy)
   * * (any characters except slash)
   * ? (single character)
   */
  public static matchGlob(filePath: string, globPattern: string): boolean {
    // Exact or basename match
    if (filePath === globPattern || path.basename(filePath) === globPattern) {
      return true;
    }

    // Convert glob pattern to regular expression
    let regexPattern = globPattern
      .replace(/[.+^${}()|[\]\\]/g, '\\$&') // escape regex characters
      .replace(/\*\*/g, '§§') // temporary placeholder for **
      .replace(/\*/g, '[^/]*') // * matches anything except /
      .replace(/\?/g, '[^/]') // ? matches one character
      .replace(/§§/g, '.*'); // ** matches any characters including /

    // If pattern doesn't start with / or .*, allow matching anywhere in path
    if (!globPattern.startsWith('/') && !globPattern.startsWith('**')) {
      regexPattern = '(^|.*/)' + regexPattern;
    }

    const regex = new RegExp(`^${regexPattern}$`, 'i');
    return regex.test(filePath) || regex.test(path.basename(filePath));
  }
}
