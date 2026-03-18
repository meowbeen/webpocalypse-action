import * as core from '@actions/core';
import * as exec from '@actions/exec';
import { ActionInputs, CliJsonOutput } from './types';

/**
 * Assembles the argument list for the webpocalypse CLI.
 * targets can be a mix of file paths (changed-only mode) or directories.
 */
export function buildCliArgs(inputs: ActionInputs, targets: string[]): string[] {
  const args: string[] = [...targets, '--in-place', '--json'];

  args.push('--format', inputs.format);
  args.push('--quality', String(inputs.quality));

  if (inputs.lossless) {
    args.push('--lossless');
  }
  if (inputs.maxWidth !== undefined) {
    args.push('--max-width', String(inputs.maxWidth));
  }
  if (inputs.maxHeight !== undefined) {
    args.push('--max-height', String(inputs.maxHeight));
  }

  return args;
}

/**
 * Invokes `npx webpocalypse` with the resolved arguments and returns the
 * parsed JSON output. Falls back to an empty result if JSON is unavailable
 * (e.g. the installed CLI version predates the --json flag).
 */
export async function runConversion(
  inputs: ActionInputs,
  targets: string[]
): Promise<CliJsonOutput> {
  const cliArgs = buildCliArgs(inputs, targets);

  core.info(`Running: npx webpocalypse ${cliArgs.join(' ')}`);

  let stdout = '';
  let stderr = '';

  const exitCode = await exec.exec('npx', ['webpocalypse', ...cliArgs], {
    listeners: {
      stdout: (data: Buffer) => {
        stdout += data.toString();
      },
      stderr: (data: Buffer) => {
        stderr += data.toString();
      },
    },
    ignoreReturnCode: true,
  });

  if (exitCode !== 0) {
    core.warning(`webpocalypse exited with code ${exitCode}.`);
    if (stderr.trim()) {
      core.warning(`stderr:\n${stderr.trim()}`);
    }
  }

  return parseCliOutput(stdout);
}

/**
 * Finds the JSON block produced by `webpocalypse --json` in stdout.
 * The CLI may emit progress/table text before the JSON object, so we search
 * for the outermost `{...}` that contains the expected keys.
 */
function parseCliOutput(stdout: string): CliJsonOutput {
  // Locate the first '{' and the matching closing '}'
  const start = stdout.indexOf('{');
  const end = stdout.lastIndexOf('}');

  if (start !== -1 && end !== -1 && end > start) {
    try {
      const candidate = stdout.slice(start, end + 1);
      const parsed = JSON.parse(candidate) as CliJsonOutput;

      if (Array.isArray(parsed.files)) {
        return parsed;
      }
    } catch {
      core.warning(
        'webpocalypse produced output that looked like JSON but could not be parsed. ' +
          'Stats will not be available.'
      );
      core.debug(`Raw stdout:\n${stdout}`);
    }
  } else {
    core.warning(
      'No JSON output detected from webpocalypse. ' +
        'Ensure you are using a version of the CLI that supports the --json flag. ' +
        'Stats will not be available, but files may still have been converted.'
    );
    core.debug(`Raw stdout:\n${stdout}`);
  }

  return { files: [], totalOriginalBytes: 0, totalConvertedBytes: 0 };
}
