# GitHub Actions Troubleshooting Guide for POD-COM

## Quick Debugging Steps

### 1. Check Action Logs
- Go to the **Actions** tab in your repository
- Click on the failed workflow run
- Expand each step to see detailed logs
- Look for red error messages or warnings

### 2. Common Issues and Solutions

#### SonarQube Token Issues
```bash
# Verify your SONAR_TOKEN secret is set
# Navigate to: Settings > Secrets and variables > Actions
# Ensure `SONAR_TOKEN` contains your valid SonarCloud token
```
If the token is incorrect or missing the analysis step will fail with an "unauthorized" message. Re‑add the token and re‑run the workflow.

#### Node and Package Setup
- Verify the Node.js version in `actions/setup-node` matches the version used locally.
- If you rely on `npm ci`, ensure the lock file is committed and up to date.
- Delete any existing `node_modules` caches from the Actions settings when you change Node.js versions.

#### Docker and Build Failures
- For Dockerized builds, check that the base image pulls successfully. A cached image may be outdated or missing.
- Inspect the logs for any missing environment variables required by the build scripts.

#### Runner Disk Space
Large artifacts or caches can fill the runner's disk. If you see "No space left on device" errors, add cleanup steps or reduce artifact size. Using `actions/cache` with a `max-size` limit can prevent overuse.

#### Test Flakiness
- Rerun failed jobs with "Run workflow" to confirm if failures are transient.
- Check that tests do not rely on external services without retries.
- Consider running problematic tests in debug mode using `tmate` for interactive troubleshooting.

### Further Resources
- [GitHub Actions Documentation](https://docs.github.com/actions)
- [Actions Runner Troubleshooting](https://github.com/actions/runner/blob/main/docs/adrs/0257-troubleshooting.md)
