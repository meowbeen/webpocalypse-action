export type OutputFormat = 'webp' | 'avif' | 'both';

export interface ActionInputs {
  format: OutputFormat;
  quality: number;
  lossless: boolean;
  maxWidth?: number;
  maxHeight?: number;
  /** Directories to scan when changedOnly is false */
  paths: string[];
  changedOnly: boolean;
  commitBack: boolean;
  commitMessage: string;
  token: string;
}

/** Shape of each file entry in --json output from webpocalypse CLI */
export interface ConvertedFileResult {
  path: string;
  originalBytes: number;
  convertedBytes: number;
}

/** Shape of the full --json output from webpocalypse CLI */
export interface CliJsonOutput {
  files: ConvertedFileResult[];
  totalOriginalBytes: number;
  totalConvertedBytes: number;
}

export interface ActionOutputs {
  filesConverted: number;
  bytesSaved: number;
  savingsPercent: number;
}
