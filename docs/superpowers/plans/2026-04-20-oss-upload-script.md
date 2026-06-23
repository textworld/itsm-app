# OSS Upload Script Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a Bash deployment helper that packages `dist/` contents into `itsm-2.zip` and uploads it to the requested OSS object using environment-based credentials.

**Architecture:** Keep the implementation in one focused shell script under `scripts/`. Add one lightweight Bash smoke test that stubs `ossutil` so the script can be verified without real OSS access.

**Tech Stack:** Bash, `zip`, `ossutil`

---

### Task 1: Add smoke test

**Files:**
- Create: `scripts/test-package-and-upload-oss.sh`
- Test: `scripts/test-package-and-upload-oss.sh`

- [ ] **Step 1: Write the failing test**
- [ ] **Step 2: Run test to verify it fails**
- [ ] **Step 3: Write minimal implementation**
- [ ] **Step 4: Run test to verify it passes**

### Task 2: Add deployment script

**Files:**
- Create: `scripts/package-and-upload-oss.sh`
- Test: `scripts/test-package-and-upload-oss.sh`

- [ ] **Step 1: Validate tools and env vars**
- [ ] **Step 2: Zip `dist/` contents**
- [ ] **Step 3: Upload archive with `ossutil`**
- [ ] **Step 4: Print resulting OSS path**
