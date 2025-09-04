#!/bin/bash

# NFL Spread League Deployment Script
echo "🏈 Deploying NFL Spread League to GitHub Pages..."

# Copy latest CSV data to public folder
echo "📊 Copying latest odds data..."
cp nfl_lines_week.csv nfl-pickem/public/

# Navigate to React app directory
cd nfl-pickem

# Build and deploy
echo "🔨 Building and deploying..."
npm run deploy

echo "✅ Deployment complete!"
echo "🌐 Your app should be available at: https://YOUR_USERNAME.github.io/nfl_spread_league"
echo "📝 Don't forget to update the homepage URL in package.json with your actual GitHub username!"
