# Forgejo workflows

This directory is intentionally present and intentionally empty of workflows.

Forgejo resolves a repository's workflow directory as `.forgejo/workflows` →
`.gitea/workflows` → `.github/workflows`, and uses the **first one that exists** —
whether or not it contains any workflow files. Because this directory exists, Forgejo
never falls through to `.github/workflows/`, whose `CD.yml` deploys to production and
was written for GitHub only.

**Do not delete this directory, and do not leave it without a tracked file, while
`.github/workflows/` still exists in the tree.** Removing it silently re-arms a
production deploy on every push to `main`, `staging` or `development`.

Rationale and evidence: `docs/migration-decisions.md#d9` (see also `#d7`, `#d8`).
Story 2.1 replaces this placeholder with the real CI workflows.
