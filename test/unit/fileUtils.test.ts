import { describe, it, expect } from 'vitest';
import { FileUtils } from '../../src/utils/fileUtils';

describe('FileUtils', () => {
  it('should exclude standard build and environment paths by default', () => {
    expect(FileUtils.isFileExcluded('C:/project/node_modules/lodash/index.js')).toBe(true);
    expect(FileUtils.isFileExcluded('C:/project/.git/HEAD')).toBe(true);
    expect(FileUtils.isFileExcluded('C:/project/.env')).toBe(true);
    expect(FileUtils.isFileExcluded('C:/project/.env.local')).toBe(true);
    expect(FileUtils.isFileExcluded('C:/project/dist/bundle.js')).toBe(true);
    expect(FileUtils.isFileExcluded('C:/project/vendor/bundle.php')).toBe(true);
    expect(FileUtils.isFileExcluded('C:/project/app.min.js')).toBe(true);
  });

  it('should allow regular application source code files', () => {
    expect(FileUtils.isFileExcluded('C:/project/src/index.ts')).toBe(false);
    expect(FileUtils.isFileExcluded('C:/project/app/components/Header.tsx')).toBe(false);
    expect(FileUtils.isFileExcluded('C:/project/backend/main.py')).toBe(false);
  });

  it('should match custom glob patterns', () => {
    const custom = ['**/generated/**', '*.tmp'];
    expect(FileUtils.isFileExcluded('C:/src/generated/types.ts', custom)).toBe(true);
    expect(FileUtils.isFileExcluded('C:/scratch.tmp', custom)).toBe(true);
    expect(FileUtils.isFileExcluded('C:/src/main.ts', custom)).toBe(false);
  });
});
