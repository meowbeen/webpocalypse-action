# webpocalypse-action

> Automatically optimize images (WebP / AVIF) in pull requests and pushes using the [`webpocalypse`](https://www.npmjs.com/package/webpocalypse) CLI.

[![GitHub Action](https://img.shields.io/badge/GitHub-Action-blue?logo=github)](https://github.com/marketplace)

---

## What it does

On every pull request or push, this action:

1. **Detects** which image files (`.jpg`, `.jpeg`, `.png`, `.webp`) were added or changed.
2. **Converts** them in-place using `npx webpocalypse` (WebP / AVIF / both).
3. **Reports** savings via Action outputs and summary logs.
4. Optionally **commits the optimized images back** to the source branch.

No Docker. No pre-installed tools required. Just `node20` and `npx`.

---

## Quick start

```yaml
# .github/workflows/optimize-images.yml
name: Optimize Images

on:
  pull_request:
    paths:
      - '**.jpg'
      - '**.jpeg'
      - '**.png'
  push:
    branches: [main]
    paths:
      - '**.jpg'
      - '**.jpeg'
      - '**.png'

jobs:
  optimize:
    runs-on: ubuntu-latest
    permissions:
      contents: write   # required only when commit-back: true

    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0   # needed for git diff between commits

      - name: Optimize images
        uses: your-handle/webpocalypse-action@v1
        with:
          format: webp
          quality: 82
          commit-back: true
          token: ${{ secrets.GITHUB_TOKEN }}
```

---

## Inputs

| Input | Default | Description |
|---|---|---|
| `format` | `webp` | Output format: `webp` \| `avif` \| `both` |
| `quality` | `80` | Compression quality (1–100) |
| `lossless` | `false` | Enable lossless compression |
| `max-width` | — | Maximum output width in pixels |
| `max-height` | — | Maximum output height in pixels |
| `paths` | `.` | Comma-separated directories to scan when `changed-only` is `false` |
| `changed-only` | `true` | Only process files changed in this PR or push |
| `commit-back` | `false` | Commit optimized images back to the branch |
| `commit-message` | `chore: optimize images [webpocalypse]` | Commit message |
| `token` | `${{ github.token }}` | GitHub token (needed for `commit-back`) |

---

## Outputs

| Output | Description |
|---|---|
| `files-converted` | Number of image files converted |
| `bytes-saved` | Total bytes saved |
| `savings-percent` | Overall size reduction as a percentage |

### Using outputs

```yaml
- name: Optimize images
  id: optimize
  uses: your-handle/webpocalypse-action@v1

- name: Print savings
  run: |
    echo "Converted: ${{ steps.optimize.outputs.files-converted }} files"
    echo "Saved:     ${{ steps.optimize.outputs.bytes-saved }} bytes (${{ steps.optimize.outputs.savings-percent }}%)"
```

---

## Examples

### Convert only changed files in a PR (default)

```yaml
- uses: your-handle/webpocalypse-action@v1
  with:
    format: webp
    quality: 80
    changed-only: true
    commit-back: true
```

### Convert a specific directory on push (full scan)

```yaml
- uses: your-handle/webpocalypse-action@v1
  with:
    format: avif
    quality: 70
    paths: public/images,assets
    changed-only: false
    commit-back: true
    commit-message: 'chore(images): convert to AVIF'
```

### Convert to both WebP and AVIF with max-width

```yaml
- uses: your-handle/webpocalypse-action@v1
  with:
    format: both
    quality: 85
    max-width: 1920
    commit-back: true
```

---

## Permissions

When `commit-back: true`, the workflow job needs write access to the repository contents:

```yaml
permissions:
  contents: write
```

---

## `--json` flag requirement

This action passes `--json` to the CLI to obtain structured output for the savings summary and for precise file staging before committing. Ensure your installed version of `webpocalypse` supports the `--json` flag.

If the flag is not available, the action will still run and convert images — it will just log a warning that stats are unavailable. For `commit-back`, it falls back to `git status` to discover changed image files.

---

## Development

### Build

```bash
npm install
npm run build          # produces dist/index.js via @vercel/ncc
```

The bundled `dist/index.js` is committed to the repository so consumers don't need to install anything at runtime.

### Typecheck

```bash
npm run typecheck
```

---

## License

MIT © Mubeen Khan
