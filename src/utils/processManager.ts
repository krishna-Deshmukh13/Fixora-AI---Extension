import { spawn } from 'child_process';
import { Logger } from './logger';

export interface ProcessExecutionOptions {
  timeoutMs?: number;
  maxBufferBytes?: number;
  cwd?: string;
}

export interface ProcessResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}

/**
 * Safe, controlled process execution for external static linters and compilers.
 * Strictly avoids shell injection by requiring argument arrays and disabling shell construction.
 */
export class ProcessManager {
  private static logger = Logger.getInstance();

  /**
   * Safely checks whether an executable is available on the host PATH.
   */
  public static async isCommandAvailable(command: string): Promise<boolean> {
    const isWindows = process.platform === 'win32';
    const checkCmd = isWindows ? 'where.exe' : 'which';

    try {
      const result = await this.execute(checkCmd, [command], { timeoutMs: 3000 });
      return result.exitCode === 0 && result.stdout.trim().length > 0;
    } catch {
      return false;
    }
  }

  /**
   * Executes a command with array arguments, strict timeout, and bounded buffer size.
   */
  public static execute(
    executable: string,
    args: string[],
    options: ProcessExecutionOptions = {}
  ): Promise<ProcessResult> {
    const timeoutMs = options.timeoutMs || 10000;
    const maxBuffer = options.maxBufferBytes || 5 * 1024 * 1024; // 5MB limit
    const cwd = options.cwd || process.cwd();

    return new Promise((resolve, reject) => {
      let stdout = '';
      let stderr = '';
      let timedOut = false;

      // spawn without shell to prevent command injection
      const proc = spawn(executable, args, {
        cwd,
        shell: false,
        windowsHide: true,
      });

      const timer = setTimeout(() => {
        timedOut = true;
        proc.kill('SIGTERM');
        reject(new Error(`Execution timed out after ${timeoutMs}ms: ${executable}`));
      }, timeoutMs);

      proc.stdout.on('data', (chunk) => {
        if (stdout.length < maxBuffer) {
          stdout += chunk.toString();
        }
      });

      proc.stderr.on('data', (chunk) => {
        if (stderr.length < maxBuffer) {
          stderr += chunk.toString();
        }
      });

      proc.on('error', (err) => {
        clearTimeout(timer);
        if (!timedOut) {
          reject(err);
        }
      });

      proc.on('close', (code) => {
        clearTimeout(timer);
        if (!timedOut) {
          resolve({
            stdout,
            stderr,
            exitCode: code ?? 0,
          });
        }
      });
    });
  }
}
