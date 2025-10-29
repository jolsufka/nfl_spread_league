---
name: nfl-deploy
description: Handles complete deployment workflow with testing, building, and validation for the NFL spread league React app
allowed-tools: ["Bash", "Read", "Write", "Edit", "LS", "WebFetch"]
---

# NFL Deployment Pipeline

This skill automates the complete deployment process for the NFL spread league React application with comprehensive testing and validation.

## What This Skill Does

1. **Pre-deployment Validation**: Checks data files, dependencies, and app configuration
2. **Testing**: Runs available tests and linting to ensure code quality
3. **Build Process**: Creates optimized production build
4. **Deployment**: Deploys to GitHub Pages with error handling
5. **Post-deployment Validation**: Verifies deployment success and functionality
6. **Rollback Support**: Provides rollback options if deployment fails

## Prerequisites

- React app in `nfl-pickem/` directory
- npm dependencies installed
- Current week's CSV data files in `public/` directory
- Git repository with GitHub Pages configured

## Usage Examples

User says any of:
- "Deploy the app"
- "Build and deploy to GitHub Pages"
- "Push the website live"
- "Deploy NFL app with testing"
- "Update the live site"

## Workflow Steps

### 1. Pre-deployment Checks
- Verify React app directory exists
- Check that npm dependencies are installed
- Validate current week's CSV files are present
- Confirm App.tsx has correct week configuration
- Check git status for uncommitted changes

### 2. Code Quality Checks
- Run linting if available (`npm run lint`)
- Run type checking if available (`npm run typecheck`)
- Run tests if available (`npm test` in CI mode)
- Check for build warnings or errors

### 3. Build Process
```bash
cd nfl-pickem
npm run build
```
- Create optimized production build
- Validate build completed successfully
- Check build size and warnings
- Verify all assets are included

### 4. Deployment
```bash
cd nfl-pickem
npm run deploy
```
- Deploy build to GitHub Pages
- Monitor deployment progress
- Handle deployment errors gracefully
- Verify GitHub Pages deployment status

### 5. Post-deployment Validation
- Wait for GitHub Pages to update (2-5 minutes)
- Fetch the live site to verify it's accessible
- Check that current week's games are displayed
- Validate core functionality works
- Verify no JavaScript errors in console

### 6. Success Reporting
- Confirm deployment URL is live
- Report any warnings or issues found
- Provide summary of deployed changes
- Estimate when changes will be fully live

## Error Handling

### Build Failures
- **Dependencies missing**: Run `npm install` and retry
- **TypeScript errors**: Report specific errors for fixing
- **Linting failures**: Show linting issues to resolve
- **Build warnings**: Report but continue unless critical

### Deployment Failures
- **Git authentication**: Check GitHub credentials
- **Branch protection**: Verify gh-pages branch permissions
- **Disk space**: Check for storage issues
- **Network issues**: Retry deployment after delay

### Validation Failures
- **Site not loading**: Check GitHub Pages status
- **Missing data**: Verify CSV files deployed correctly
- **JavaScript errors**: Report console errors found
- **Broken functionality**: Identify specific issues

## Success Criteria

- ✅ Build completes without errors
- ✅ Deployment to GitHub Pages succeeds
- ✅ Live site loads successfully
- ✅ Current week's games display correctly
- ✅ No critical JavaScript errors
- ✅ Core functionality works (user selection, picks display)

## Validation Tests

The skill performs these validation checks on the live site:
- Site loads within 10 seconds
- Current week's games are visible
- Team logos display properly
- User dropdown functions
- Pick submission interface works
- Leaderboard displays data

## Rollback Process

If deployment fails or breaks functionality:
1. Identify the issue and severity
2. Provide quick fix options if available
3. Guide through manual rollback if needed
4. Suggest debugging steps for complex issues

## Performance Monitoring

- Monitor build time and size
- Check deployment duration
- Validate site loading speed
- Report any performance regressions

## Output Information

The skill provides:
- Build status and warnings
- Deployment progress updates
- Live site validation results
- Performance metrics
- Direct link to deployed application

## Common Scenarios

### First-time Deployment
- Verify GitHub Pages is configured
- Check repository settings
- Validate branch permissions

### Weekly Updates
- Ensure new CSV data is included
- Verify week number updates
- Check that old data is preserved

### Emergency Fixes
- Prioritize critical issues
- Fast-track deployment process
- Skip non-essential validations if needed

## Important Notes

- Deployment URL: `https://jolsufka.github.io/nfl_spread_league`
- GitHub Pages can take 2-10 minutes to fully update
- Build process typically takes 30-60 seconds
- Always verify changes on live site before notifying users
- Keep deployment logs for troubleshooting

## Integration with Other Skills

- **nfl-week-setup**: Automatically triggers deployment after week setup
- **nfl-results-processor**: Can trigger deployment after results are processed
- Works with any manual code changes that need to go live