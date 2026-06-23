# OSS Upload Script Design

**Context**
- The project builds static assets into `dist/`.
- Deployment needs a reusable Bash script that packages the contents of `dist/` into `itsm-2.zip` and uploads the archive to OSS.

**Goal**
- Add a repository-local script that:
  - validates required tools and environment variables,
  - zips the contents under `dist/` without nesting the `dist` folder itself,
  - uploads the archive to `oss://sre-uniops/web/itsm-2.zip`.

**Design**
- Add `scripts/package-and-upload-oss.sh` as the operational entrypoint.
- Read credentials from environment variables:
  - required: `OSS_ACCESS_KEY_ID`, `OSS_ACCESS_KEY_SECRET`
  - optional: `OSS_SECURITY_TOKEN` or `OSS_SESSION_TOKEN`
- Export the endpoint in-process so `ossutil` can read it from environment variables instead of CLI flags.
- Keep the bucket name and object path fixed in the script to match the requested deployment target.

**Validation**
- Add a small Bash smoke test that:
  - creates a temporary fake repo layout,
  - stubs `ossutil`,
  - runs the script,
  - checks that `itsm-2.zip` is created and upload arguments target the requested OSS path.
