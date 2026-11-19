import { describe, it, expect } from 'vitest';
import { LanguageDetector } from '../../src/utils/languageDetector';

describe('LanguageDetector', () => {
  it('should accurately detect JavaScript, TypeScript, and modern modules', () => {
    expect(LanguageDetector.detect('app.js').id).toBe('javascript');
    expect(LanguageDetector.detect('server.mjs').id).toBe('javascript');
    expect(LanguageDetector.detect('main.ts').id).toBe('typescript');
    expect(LanguageDetector.detect('config.cts').id).toBe('typescript');
  });

  it('should detect React framework from JSX/TSX and code content', () => {
    const jsx = LanguageDetector.detect('Button.jsx');
    expect(jsx.framework).toBe('react');
    expect(jsx.id).toBe('javascriptreact');

    const tsx = LanguageDetector.detect('Header.tsx');
    expect(tsx.framework).toBe('react');
    expect(tsx.id).toBe('typescriptreact');

    // Content detection in regular .js file
    const jsWithReact = LanguageDetector.detect(
      'component.js',
      'javascript',
      "import React from 'react'; export function App() { return <div />; }"
    );
    expect(jsWithReact.framework).toBe('react');
  });

  it('should detect Node.js framework from system imports', () => {
    const nodeFile = LanguageDetector.detect(
      'server.js',
      'javascript',
      "const fs = require('fs'); const port = process.env.PORT || 3000;"
    );
    expect(nodeFile.framework).toBe('nodejs');
    expect(nodeFile.name).toContain('Node.js');
  });

  it('should accurately detect Python, Java, C, and C++', () => {
    expect(LanguageDetector.detect('script.py').id).toBe('python');
    expect(LanguageDetector.detect('App.java').id).toBe('java');
    expect(LanguageDetector.detect('main.c').id).toBe('c');
    expect(LanguageDetector.detect('algo.cpp').id).toBe('cpp');
    expect(LanguageDetector.detect('types.hpp').id).toBe('cpp');
  });

  it('should accurately detect PHP, HTML, CSS, SCSS, and SQL', () => {
    expect(LanguageDetector.detect('index.php').id).toBe('php');
    expect(LanguageDetector.detect('index.html').id).toBe('html');
    expect(LanguageDetector.detect('style.css').id).toBe('css');
    expect(LanguageDetector.detect('theme.scss').id).toBe('scss');
    expect(LanguageDetector.detect('query.sql').id).toBe('sql');
  });

  it('should identify all 12 languages as supported', () => {
    const extensions = ['.js', '.ts', '.py', '.java', '.c', '.cpp', '.jsx', '.php', '.html', '.css', '.sql'];
    for (const ext of extensions) {
      const info = LanguageDetector.detect(`file${ext}`);
      expect(info.isSupported).toBe(true);
    }
  });

  it('should handle unknown extensions gracefully', () => {
    const unknown = LanguageDetector.detect('data.unknownformat');
    expect(unknown.isSupported).toBe(false);
    expect(unknown.id).toBe('plaintext');
  });
});
