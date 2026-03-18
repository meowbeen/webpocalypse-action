import * as core from '@actions/core';
import { ActionInputs, OutputFormat } from './types';

const VALID_FORMATS: OutputFormat[] = ['webp', 'avif', 'both'];

export function parseInputs(): ActionInputs {
  const format = (core.getInput('format') || 'webp') as OutputFormat;
  if (!VALID_FORMATS.includes(format)) {
    throw new Error(
      `Invalid format: "${format}". Must be one of: ${VALID_FORMATS.join(', ')}.`
    );
  }

  const qualityRaw = core.getInput('quality') || '80';
  const quality = parseInt(qualityRaw, 10);
  if (isNaN(quality) || quality < 1 || quality > 100) {
    throw new Error(
      `Invalid quality: "${qualityRaw}". Must be an integer between 1 and 100.`
    );
  }

  const lossless = core.getBooleanInput('lossless');

  const maxWidthRaw = core.getInput('max-width');
  let maxWidth: number | undefined;
  if (maxWidthRaw) {
    maxWidth = parseInt(maxWidthRaw, 10);
    if (isNaN(maxWidth) || maxWidth <= 0) {
      throw new Error(
        `Invalid max-width: "${maxWidthRaw}". Must be a positive integer.`
      );
    }
  }

  const maxHeightRaw = core.getInput('max-height');
  let maxHeight: number | undefined;
  if (maxHeightRaw) {
    maxHeight = parseInt(maxHeightRaw, 10);
    if (isNaN(maxHeight) || maxHeight <= 0) {
      throw new Error(
        `Invalid max-height: "${maxHeightRaw}". Must be a positive integer.`
      );
    }
  }

  const pathsRaw = core.getInput('paths') || '.';
  const paths = pathsRaw
    .split(',')
    .map((p) => p.trim())
    .filter(Boolean);
  if (paths.length === 0) {
    throw new Error('Input "paths" must contain at least one directory.');
  }

  const changedOnly = core.getBooleanInput('changed-only');
  const commitBack = core.getBooleanInput('commit-back');
  const commitMessage =
    core.getInput('commit-message') || 'chore: optimize images [webpocalypse]';
  const token = core.getInput('token');

  if (commitBack && !token) {
    throw new Error(
      'Input "token" is required when "commit-back" is true.'
    );
  }

  return {
    format,
    quality,
    lossless,
    maxWidth,
    maxHeight,
    paths,
    changedOnly,
    commitBack,
    commitMessage,
    token,
  };
}
