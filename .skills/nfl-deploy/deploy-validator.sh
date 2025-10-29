#!/bin/bash

# NFL Deploy Validation Script
# Validates the React app before and after deployment

set -e  # Exit on any error

DEPLOY_URL="https://jolsufka.github.io/nfl_spread_league"
APP_DIR="nfl-pickem"

echo "🏈 NFL Deploy Validation"
echo "======================="

# Function to check if URL is accessible
check_url() {
    local url=$1
    local timeout=${2:-10}
    
    echo "🌐 Checking $url..."
    
    if curl -s --max-time $timeout --head "$url" | head -n 1 | grep -q "200 OK"; then
        echo "✅ URL is accessible"
        return 0
    else
        echo "❌ URL is not accessible"
        return 1
    fi
}

# Function to validate build directory
validate_build() {
    echo ""
    echo "🔧 Validating Build"
    echo "=================="
    
    if [ ! -d "$APP_DIR/build" ]; then
        echo "❌ Build directory not found"
        return 1
    fi
    
    echo "✅ Build directory exists"
    
    # Check for essential files
    local essential_files=("index.html" "static/js" "static/css")
    
    for file in "${essential_files[@]}"; do
        if [ -e "$APP_DIR/build/$file" ]; then
            echo "✅ $file found"
        else
            echo "❌ $file missing"
            return 1
        fi
    done
    
    # Check build size
    local build_size=$(du -sh "$APP_DIR/build" | cut -f1)
    echo "📦 Build size: $build_size"
    
    return 0
}

# Function to validate CSV data files
validate_data_files() {
    echo ""
    echo "📊 Validating Data Files"
    echo "======================"
    
    # Check for CSV files in public directory
    if ls "$APP_DIR/public"/nfl_lines_week*.csv 1> /dev/null 2>&1; then
        echo "✅ NFL lines CSV files found"
        for file in "$APP_DIR/public"/nfl_lines_week*.csv; do
            echo "  📄 $(basename "$file")"
        done
    else
        echo "⚠️  No NFL lines CSV files found"
    fi
    
    if ls "$APP_DIR/public"/nfl_results_week*.csv 1> /dev/null 2>&1; then
        echo "✅ NFL results CSV files found"
        for file in "$APP_DIR/public"/nfl_results_week*.csv; do
            echo "  📄 $(basename "$file")"
        done
    else
        echo "⚠️  No NFL results CSV files found"
    fi
    
    return 0
}

# Function to check dependencies
check_dependencies() {
    echo ""
    echo "📦 Checking Dependencies"
    echo "======================"
    
    if [ ! -d "$APP_DIR/node_modules" ]; then
        echo "❌ node_modules not found - run npm install"
        return 1
    fi
    
    echo "✅ node_modules found"
    
    # Check package.json
    if [ -f "$APP_DIR/package.json" ]; then
        echo "✅ package.json found"
    else
        echo "❌ package.json missing"
        return 1
    fi
    
    return 0
}

# Function to validate live site
validate_live_site() {
    echo ""
    echo "🌐 Validating Live Site"
    echo "====================="
    
    # Wait a moment for deployment to propagate
    echo "⏳ Waiting for GitHub Pages to update..."
    sleep 5
    
    if check_url "$DEPLOY_URL" 15; then
        echo "✅ Site is live and accessible"
        
        # Try to fetch content and check for key elements
        if curl -s --max-time 10 "$DEPLOY_URL" | grep -q "NFL Spread League"; then
            echo "✅ Site content appears correct"
        else
            echo "⚠️  Site content may have issues"
        fi
        
        return 0
    else
        echo "❌ Site is not accessible"
        echo "🔍 Troubleshooting tips:"
        echo "   - Check GitHub Pages settings"
        echo "   - Verify gh-pages branch exists"
        echo "   - Wait 5-10 minutes for propagation"
        return 1
    fi
}

# Function to run pre-deployment checks
pre_deployment_checks() {
    echo "🔍 Pre-deployment Checks"
    echo "======================="
    
    # Check if we're in the right directory
    if [ ! -d "$APP_DIR" ]; then
        echo "❌ NFL React app directory not found"
        echo "   Make sure you're in the project root"
        return 1
    fi
    
    echo "✅ NFL React app directory found"
    
    # Run individual checks
    check_dependencies || return 1
    validate_data_files || return 1
    
    echo ""
    echo "✅ Pre-deployment checks passed!"
    return 0
}

# Function to run post-deployment checks
post_deployment_checks() {
    echo ""
    echo "🔍 Post-deployment Checks"
    echo "========================"
    
    validate_build || return 1
    validate_live_site || return 1
    
    echo ""
    echo "✅ Post-deployment checks passed!"
    echo "🎉 Deployment successful!"
    echo ""
    echo "🔗 Live site: $DEPLOY_URL"
    return 0
}

# Main execution based on argument
case "${1:-pre}" in
    "pre")
        pre_deployment_checks
        ;;
    "post")
        post_deployment_checks
        ;;
    "live")
        validate_live_site
        ;;
    "all")
        pre_deployment_checks && post_deployment_checks
        ;;
    *)
        echo "Usage: $0 [pre|post|live|all]"
        echo "  pre  - Run pre-deployment checks (default)"
        echo "  post - Run post-deployment checks"
        echo "  live - Check live site only"
        echo "  all  - Run all checks"
        exit 1
        ;;
esac