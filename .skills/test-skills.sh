#!/bin/bash

# Test script for NFL spread league skills
# This validates that both skills are properly configured

echo "🏈 Testing NFL Spread League Skills"
echo "=================================="

# Check if skills directory exists
if [ ! -d ".skills" ]; then
    echo "❌ .skills directory not found"
    exit 1
fi

echo "✅ Skills directory found"

# Check week setup skill
if [ -f ".skills/nfl-week-setup/SKILL.md" ]; then
    echo "✅ NFL Week Setup skill found"
    
    # Validate YAML frontmatter
    if grep -q "name: nfl-week-setup" .skills/nfl-week-setup/SKILL.md; then
        echo "✅ Week setup skill has correct name"
    else
        echo "❌ Week setup skill missing correct name"
    fi
else
    echo "❌ NFL Week Setup skill not found"
fi

# Check results processor skill
if [ -f ".skills/nfl-results-processor/SKILL.md" ]; then
    echo "✅ NFL Results Processor skill found"
    
    # Validate YAML frontmatter
    if grep -q "name: nfl-results-processor" .skills/nfl-results-processor/SKILL.md; then
        echo "✅ Results processor skill has correct name"
    else
        echo "❌ Results processor skill missing correct name"
    fi
else
    echo "❌ NFL Results Processor skill not found"
fi

# Check deploy skill
if [ -f ".skills/nfl-deploy/SKILL.md" ]; then
    echo "✅ NFL Deploy skill found"
    
    # Validate YAML frontmatter
    if grep -q "name: nfl-deploy" .skills/nfl-deploy/SKILL.md; then
        echo "✅ Deploy skill has correct name"
    else
        echo "❌ Deploy skill missing correct name"
    fi
else
    echo "❌ NFL Deploy skill not found"
fi

# Check prerequisites
echo ""
echo "🔧 Checking Prerequisites"
echo "========================"

# Check API key
if [ -f ".api_key" ]; then
    echo "✅ API key file found"
else
    echo "⚠️  API key file not found (required for skills to work)"
fi

# Check scripts directory
if [ -d "scripts" ] && [ -f "scripts/script.py" ] && [ -f "scripts/results_script.py" ]; then
    echo "✅ Python scripts found"
else
    echo "❌ Required Python scripts missing"
fi

# Check React app
if [ -d "nfl-pickem" ] && [ -f "nfl-pickem/src/App.tsx" ]; then
    echo "✅ React app found"
else
    echo "❌ React app missing"
fi

echo ""
echo "🎯 Skills Ready!"
echo "==============="
echo "You can now use:"
echo '• "Set up Week X" - Automates weekly setup'
echo '• "Process Week X results" - Automates results processing'
echo '• "Deploy the app" - Automates testing, building, and deployment'
echo ""
echo "Skills will only activate when Claude detects relevant tasks."