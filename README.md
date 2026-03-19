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
    # contents: write is only required when commit-back: true.
    # Use contents: read for a reporting-only setup.
    permissions:
      contents: read

    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 2   # see "Checkout depth" section below

      - name: Optimize images
        uses: meowbeen/webpocalypse-action@v1
        with:
          format: webp
          quality: 82
          # commit-back: when true, the action pushes a bot commit to this
          # branch with the optimized images. Requires contents: write above.
          # Leave false (the default) to report savings without touching the branch.
          commit-back: false
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
| `paths` | `.` | Comma-separated directories. Behaviour depends on `changed-only` — see [note below](#paths-and-changed-only). |
| `changed-only` | `true` | Only process image files changed in this PR or push |
| `commit-back` | `false` | Push a bot commit with optimized images back to the branch — see [note below](#commit-back) |
| `commit-message` | `chore: optimize images [webpocalypse]` | Commit message used when `commit-back` is `true` |
| `token` | `${{ github.token }}` | GitHub token — **only read when `commit-back: true`**, ignored otherwise |

---

## Outputs

| Output | Description |
|---|---|
| `files-converted` | Number of image files converted |
| `bytes-saved` | Total bytes saved |
| `savings-percent` | Overall size reduction as a percentage |

### Using outputs

```yaml
- uses: actions/checkout@v4
  with:
    fetch-depth: 2

- name: Optimize images
  id: optimize
  uses: meowbeen/webpocalypse-action@v1

- name: Print savings
  run: |
    echo "Converted: ${{ steps.optimize.outputs.files-converted }} files"
    echo "Saved:     ${{ steps.optimize.outputs.bytes-saved }} bytes (${{ steps.optimize.outputs.savings-percent }}%)"
```

---

## Examples

### Convert only changed files in a PR (default, reporting only)

```yaml
- uses: actions/checkout@v4
  with:
    fetch-depth: 2

- uses: meowbeen/webpocalypse-action@v1
  with:
    format: webp
    quality: 80
    changed-only: true
    commit-back: false   # report savings without touching the branch
```

### Convert only changed files and commit them back

```yaml
# job must have: permissions: contents: write
- uses: actions/checkout@v4
  with:
    fetch-depth: 2

- uses: meowbeen/webpocalypse-action@v1
  with:
    format: webp
    quality: 80
    changed-only: true
    # bot commit is pushed to this branch with the optimized images
    commit-back: true
    token: ${{ secrets.GITHUB_TOKEN }}
```

### Full directory scan on push (changed-only: false)

```yaml
# paths is the scan target when changed-only is false
- uses: meowbeen/webpocalypse-action@v1
  with:
    format: avif
    quality: 70
    paths: public/images,assets   # scans these directories in full
    changed-only: false
    # bot commit is pushed to this branch with the optimized images
    commit-back: true
    commit-message: 'chore(images): convert to AVIF'
    token: ${{ secrets.GITHUB_TOKEN }}
```

### Convert to both WebP and AVIF with max-width

```yaml
- uses: meowbeen/webpocalypse-action@v1
  with:
    format: both
    quality: 85
    max-width: 1920
    commit-back: false
```

---

## Checkout depth

Use `fetch-depth: 2` — not `fetch-depth: 0`.

```yaml
- uses: actions/checkout@v4
  with:
    fetch-depth: 2
```

- **Push events** diff `HEAD~1..HEAD`, which requires exactly 2 commits in history.
- **Pull request events** use `base.sha` and `head.sha` from the event payload, so checkout depth is irrelevant — they are explicit SHAs, not relative refs.

`fetch-depth: 0` (full history) can add 30–60 seconds on large repos. `fetch-depth: 2` is the safe minimum.

If the clone somehow ends up too shallow (e.g. in a non-standard workflow setup), the action automatically retries the git diff after running `git fetch --unshallow`. You do not need to work around this yourself.

---

## `commit-back`

`commit-back` defaults to `false` deliberately. When set to `true`, the action pushes a new commit authored by `github-actions[bot]` to the source branch containing the optimized images.

**Before enabling it, understand the implications:**

- The bot commit appears directly in your PR's commit history.
- If your branch protection rules require status checks to pass before merging, the bot commit may re-trigger CI — including this action itself. Guard against that by adding a path filter to your `on:` trigger (as in the example workflow), so the action only fires when image files change.
- The job needs `permissions: contents: write`.

```yaml
jobs:
  optimize:
    permissions:
      contents: write   # only needed when commit-back: true

    steps:
      - uses: meowbeen/webpocalypse-action@v1
        with:
          commit-back: true
          # token defaults to GITHUB_TOKEN — only override with a PAT if
          # you need the bot commit to trigger other workflows.
          token: ${{ secrets.GITHUB_TOKEN }}
```

If you only want savings reported in logs and outputs without touching the branch, leave `commit-back: false` (the default) and omit `token` entirely.

---

## `paths` and `changed-only`

The `paths` input behaves differently depending on `changed-only`:

| `changed-only` | Effect of `paths` |
|---|---|
| `true` (default) | **Scope filter** — only changed images whose path starts with one of these directories are processed. Other changed images are ignored. |
| `false` | **Scan target** — these directories are passed directly to the CLI for a full recursive scan. |

This means the same input serves two different purposes. Examples:

```yaml
# Only process changed images inside public/ (scope filter)
changed-only: true
paths: public

# Scan all of public/ and assets/ regardless of what changed
changed-only: false
paths: public,assets
```

The default `paths: .` means "the whole repository" in both modes. If you set `paths: public` and `changed-only: true`, changed images outside `public/` are silently skipped — that is intentional behaviour, not a bug.

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
