import * as core from '@actions/core';
import * as github from '@actions/github';
import * as path from 'path';
import { parseInputs } from './inputs';
import { getChangedImageFiles, getWorkingTreeChanges, commitAndPush } from './git';
import { runConversion } from './converter';

/**
 * Given a list of file paths, returns the minimal set of unique parent
 * directories — removing any sub-directory already covered by a parent.
 * e.g. ['public/images/home/a.png', 'public/images/b.png']
 *   → ['public/images']
 */
function toUniqueDirs(filePaths: string[]): string[] {
  const dirs = filePaths.map((f) => {
    const dir = path.dirname(f);
    // path.dirname returns '.' for bare filenames — normalise to '.'
    return dir === '' ? '.' : dir;
  });

  // Sort so that parent paths appear before their children ('a' < 'a/b')
  const unique = [...new Set(dirs)].sort();

  // Drop any directory that is already covered by a shorter ancestor in the list
  return unique.filter(
    (dir) => !unique.some((other) => other !== dir && dir.startsWith(other + path.sep))
  );
}

async function run(): Promise<void> {
  try {
    core.info('━━━ Webpocalypse Action ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    const inputs = parseInputs();
    const context = github.context;

    // ── Step 1: Resolve what to convert ─────────────────────────────────────
    let targets: string[];

    if (inputs.changedOnly) {
      const baseSha: string | undefined =
        context.payload.pull_request?.base?.sha;
      const headSha: string | undefined =
        context.payload.pull_request?.head?.sha ?? context.sha;

      const changedFiles = await getChangedImageFiles(baseSha, headSha);

      // Optionally filter by the configured paths
      const scopedFiles =
        inputs.paths.length === 1 && inputs.paths[0] === '.'
          ? changedFiles
          : changedFiles.filter((file) =>
              inputs.paths.some(
                (p) => file === p || file.startsWith(p.endsWith('/') ? p : `${p}/`)
              )
            );

      if (scopedFiles.length === 0) {
        core.info('No changed image files found in the configured paths. Nothing to do.');
        setOutputs(0, 0, 0);
        return;
      }

      core.info(`Found ${scopedFiles.length} changed image file(s) to process:`);
      for (const f of scopedFiles) {
        core.info(`  • ${f}`);
      }

      // The CLI requires a directory — resolve changed file paths to their
      // unique parent directories (removing redundant sub-directories).
      const uniqueDirs = toUniqueDirs(scopedFiles);
      core.info(
        `Resolved to ${uniqueDirs.length} unique director${uniqueDirs.length === 1 ? 'y' : 'ies'}: ${uniqueDirs.join(', ')}`
      );
      targets = uniqueDirs;
    } else {
      core.info(`Processing directories: ${inputs.paths.join(', ')}`);
      targets = inputs.paths;
    }

    // ── Step 2: Run conversion ───────────────────────────────────────────────
    core.startGroup('Image conversion');
    const result = await runConversion(inputs, targets);
    core.endGroup();

    // ── Step 3: Compute summary ──────────────────────────────────────────────
    const filesConverted = result.files.length;
    const bytesSaved = result.totalOriginalBytes - result.totalConvertedBytes;
    const savingsPercent =
      result.totalOriginalBytes > 0
        ? Math.round((bytesSaved / result.totalOriginalBytes) * 10000) / 100
        : 0;

    core.info('━━━ Conversion Summary ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    core.info(`Files converted : ${filesConverted}`);
    core.info(`Original size   : ${formatBytes(result.totalOriginalBytes)}`);
    core.info(`Converted size  : ${formatBytes(result.totalConvertedBytes)}`);
    core.info(
      `Bytes saved     : ${formatBytes(bytesSaved)} (${savingsPercent}%)`
    );
    core.info('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    setOutputs(filesConverted, bytesSaved, savingsPercent);

    // ── Step 4: Optionally commit back ───────────────────────────────────────
    if (inputs.commitBack) {
      core.startGroup('Committing optimized images');

      // Use working-tree diff to find every file the CLI actually touched,
      // including newly created .webp / .avif siblings (non-in-place mode).
      let filesToCommit: string[];

      if (result.files.length > 0) {
        filesToCommit = result.files.map((f) => f.path);
      } else {
        // JSON was unavailable — fall back to git working-tree scan
        filesToCommit = await getWorkingTreeChanges();
        if (filesToCommit.length > 0) {
          core.info(
            `JSON output unavailable; detected ${filesToCommit.length} changed image(s) via git status.`
          );
        }
      }

      if (filesToCommit.length === 0) {
        core.info('No image changes detected in the working tree. Skipping commit.');
      } else {
        await commitAndPush(filesToCommit, inputs.commitMessage, inputs.token);
      }

      core.endGroup();
    }

    core.info('Webpocalypse Action complete.');
  } catch (error) {
    core.setFailed(error instanceof Error ? error.message : String(error));
  }
}

function setOutputs(
  filesConverted: number,
  bytesSaved: number,
  savingsPercent: number
): void {
  core.setOutput('files-converted', filesConverted);
  core.setOutput('bytes-saved', bytesSaved);
  core.setOutput('savings-percent', savingsPercent);
}

function formatBytes(bytes: number): string {
  if (bytes < 0) return `-${formatBytes(-bytes)}`;
  if (bytes === 0) return '0 B';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

run();
