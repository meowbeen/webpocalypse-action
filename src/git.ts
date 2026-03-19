import * as core from '@actions/core';
import * as exec from '@actions/exec';
import * as github from '@actions/github';

const IMAGE_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.webp', '.avif'];

function isImageFile(filePath: string): boolean {
  const lower = filePath.toLowerCase();
  return IMAGE_EXTENSIONS.some((ext) => lower.endsWith(ext));
}

/**
 * Returns the list of image files that were added or modified between two refs.
 * Falls back gracefully if git diff fails (e.g. shallow clone with only one commit).
 */
export async function getChangedImageFiles(
  baseSha: string | undefined,
  headSha: string | undefined
): Promise<string[]> {
  let base: string;
  let head: string;

  if (baseSha && headSha) {
    base = baseSha;
    head = headSha;
    core.info(
      `Detecting changed images between ${base.slice(0, 7)} → ${head.slice(0, 7)}`
    );
  } else {
    base = 'HEAD~1';
    head = 'HEAD';
    core.info('Detecting changed images between HEAD~1 → HEAD');
  }

  let output = '';
  const exitCode = await exec.exec(
    'git',
    ['diff', '--name-only', '--diff-filter=ACMR', base, head],
    {
      listeners: {
        stdout: (data: Buffer) => {
          output += data.toString();
        },
      },
      silent: true,
      ignoreReturnCode: true,
    }
  );

  if (exitCode !== 0) {
    core.warning(
      `git diff exited with code ${exitCode}. Attempting unshallow fetch...`
    );
    await exec.exec('git', ['fetch', '--unshallow'], { ignoreReturnCode: true });
    output = '';
    await exec.exec(
      'git',
      ['diff', '--name-only', '--diff-filter=ACMR', base, head],
      {
        listeners: {
          stdout: (data: Buffer) => {
            output += data.toString();
          },
        },
        silent: true,
        ignoreReturnCode: true,
      }
    );
  }

  return output
    .split('\n')
    .map((f) => f.trim())
    .filter((f) => f.length > 0 && isImageFile(f));
}

/**
 * Returns all files that are currently modified or untracked compared to HEAD,
 * restricted to image extensions. Used to discover what the CLI actually changed
 * on disk so we can stage exactly those files for commit.
 */
export async function getWorkingTreeChanges(): Promise<string[]> {
  let output = '';
  await exec.exec('git', ['status', '--porcelain'], {
    listeners: {
      stdout: (data: Buffer) => {
        output += data.toString();
      },
    },
    silent: true,
  });

  return output
    .split('\n')
    .filter((line) => line.trim().length > 0)
    .map((line) => line.slice(3).trim()) // strip "XY " status prefix
    .filter(isImageFile);
}

/**
 * Stages the given files, commits, and pushes back to the source branch.
 */
export async function commitAndPush(
  filesToStage: string[],
  commitMessage: string,
  token: string
): Promise<void> {
  if (filesToStage.length === 0) {
    core.info('No files to stage — skipping commit.');
    return;
  }

  const { owner, repo } = github.context.repo;

  // Resolve the target branch
  let branch: string;
  if (github.context.eventName === 'pull_request') {
    branch = (github.context.payload.pull_request?.head?.ref as string) ?? '';
  } else {
    branch = github.context.ref.replace('refs/heads/', '');
  }

  if (!branch) {
    throw new Error('Could not determine the target branch for the commit.');
  }

  core.info(`Target branch: ${branch}`);

  // Configure bot identity
  await exec.exec('git', [
    'config',
    'user.name',
    'github-actions[bot]',
  ]);
  await exec.exec('git', [
    'config',
    'user.email',
    'github-actions[bot]@users.noreply.github.com',
  ]);

  // Stage files
  await exec.exec('git', ['add', '--', ...filesToStage]);

  // Guard against empty commits
  let statusOutput = '';
  await exec.exec('git', ['status', '--porcelain'], {
    listeners: {
      stdout: (data: Buffer) => {
        statusOutput += data.toString();
      },
    },
    silent: true,
  });

  if (!statusOutput.trim()) {
    core.info('Nothing to commit — images were already optimized.');
    return;
  }

  await exec.exec('git', ['commit', '-m', commitMessage]);

  const remoteUrl = `https://x-access-token:${token}@github.com/${owner}/${repo}.git`;
  await exec.exec('git', ['push', remoteUrl, `HEAD:refs/heads/${branch}`]);

  core.info(
    `✓ Committed and pushed ${filesToStage.length} optimized file(s) to "${branch}".`
  );
}
