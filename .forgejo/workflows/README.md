# Forgejo workflows

This directory holds this repository's real Forgejo Actions workflows (added starting
Story 2.1; stale as of that story, corrected here — this directory was NOT left empty):

- `ci.yml` — lint/typecheck/test/build gate on `push`/`pull_request`, plus the image job
  that builds and publishes a container for every branch (Story 2.x, 3.x).
- `build.yml` — the callee `ci.yml`'s image job wraps; also dispatchable on its own.
- `build-buildkit-cni-image.yml`, `verify-cni-netns-isolation.yml` — the CNI-isolated
  BuildKit base image and its own verification workflow (Epic 3).
- `deploy-dev.yml` — on-demand deploy to the DEV stand on s1 (Story 4.3). First workflow
  in this repo to authenticate a `git fetch` with `github.token` and to talk to a job's
  own host docker daemon over a mounted `docker.sock`; see its own header comment and
  `docs/migration-decisions.md#d29`.
- `probe-deploy-dev-preprod.yml` — throwaway, dispatch-only diagnostic probe kept
  alongside `deploy-dev.yml` as a free, cheap confirmation offer (Story 4.3, Task 2.7).

Forgejo resolves a repository's workflow directory as `.forgejo/workflows` →
`.gitea/workflows` → `.github/workflows`, and uses the **first one that exists** —
whether or not it contains any workflow files. Because this directory exists (and is
now populated), Forgejo never falls through to `.github/workflows/`, whose `CD.yml`
deploys to production and was written for GitHub only.

**Do not delete this directory, and do not leave it without a tracked file, while
`.github/workflows/` still exists in the tree.** Removing it silently re-arms a
production deploy on every push to `main`, `staging` or `development`.

Rationale and evidence: `docs/migration-decisions.md#d9` (see also `#d7`, `#d8`).
