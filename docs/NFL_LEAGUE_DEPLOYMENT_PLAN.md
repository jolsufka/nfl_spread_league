# NFL Spread League Deployment Plan

## Current Architecture
- **Frontend**: React TypeScript app with Tailwind CSS
- **Data Source**: Python script → CSV file with NFL odds  
- **Current Limitation**: No database for user picks (static hosting only)

---

## Recommended Architecture: React + Supabase + GitHub Pages

### Frontend (Static Hosting)
- **React App** deployed to GitHub Pages
- Loads NFL games from CSV
- Makes API calls to Supabase for user picks

### Backend (Database + API)
- **Supabase** - PostgreSQL database with auto-generated API
- Stores user picks, results, season history
- Handles authentication (if needed later)

### Data Flow
```
Python Script → CSV → GitHub → React App → Supabase Database
     ↓              ↓           ↓              ↓
NFL Odds API → nfl_lines.csv → Pick UI → User Picks Storage
```

---

## Implementation Plan

### Phase 1: Database Setup (Free)
**Cost: $0/month**

1. **Create Supabase Project**
   - Sign up at supabase.com
   - Create new project (free tier: 50MB, 2 concurrent connections)

2. **Database Schema**
   ```sql
   -- Users table
   CREATE TABLE users (
     id TEXT PRIMARY KEY,
     name TEXT NOT NULL,
     created_at TIMESTAMP DEFAULT NOW()
   );

   -- User picks table  
   CREATE TABLE picks (
     id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
     user_id TEXT REFERENCES users(id),
     week INTEGER NOT NULL,
     game_id TEXT NOT NULL,
     team TEXT NOT NULL,
     spread DECIMAL NOT NULL,
     correct BOOLEAN DEFAULT NULL,
     created_at TIMESTAMP DEFAULT NOW()
   );

   -- Indexes for performance
   CREATE INDEX idx_picks_user_week ON picks(user_id, week);
   ```

3. **API Integration**
   - Install Supabase client: `npm install @supabase/supabase-js`
   - Replace localStorage with Supabase API calls

### Phase 2: Deployment (Free)
**Cost: $0/month**

1. **GitHub Pages Setup**
   - Already configured in package.json
   - `npm run deploy` publishes to https://jolsufka.github.io/nfl_spread_league

2. **CSV Hosting**
   - Upload nfl_lines_week.csv to `/public/` folder
   - React app fetches from `/nfl_lines_week.csv`

3. **Weekly Updates**
   - Run Python script locally
   - Commit new CSV to GitHub
   - GitHub Pages auto-deploys updated data

### Phase 3: Automation (Optional)
**Cost: $0-5/month**

**Option A: Manual (Free)**
- Run Python script weekly
- Manual git commit + push
- Users see new games after deployment

**Option B: GitHub Actions (Free)**
- Automated script execution
- Auto-commit new CSV files  
- Scheduled weekly updates
- 2,000 minutes/month free

**Option C: Full Automation ($5/month)**
- Deploy Python script to Railway/Render
- Cron job updates CSV weekly
- Webhook triggers GitHub deployment

---

## Cost Breakdown

### Free Tier (Recommended Start)
- **GitHub Pages**: Free static hosting
- **Supabase**: Free tier (50MB DB, 2 concurrent users)  
- **GitHub Actions**: Free (2,000 minutes/month)
- **Domain**: github.io subdomain (free)
- **Total: $0/month**

### Paid Upgrades (If Needed Later)
- **Custom Domain**: $10-15/year (.com domain)
- **Supabase Pro**: $25/month (8GB DB, 100+ concurrent users)
- **Automated Script Hosting**: $5/month (Railway/Render)
- **Total: $5-40/month depending on features**

---

## Alternative Options Comparison

| Option | Cost | Pros | Cons | Setup Difficulty |
|--------|------|------|------|------------------|
| **Supabase** | Free-$25 | Real DB, auto API, scalable | New tool to learn | Medium |
| **Google Sheets** | Free | Visual, familiar interface | Not built for apps | Easy |
| **Firebase** | Free-$25 | Google ecosystem, real-time | Complex for simple use | Hard |
| **GitHub as DB** | Free | Version controlled | Hacky, rate limited | Medium |
| **Full Backend** | $5-50 | Total control | Much more work | Hard |

---

## Weekly Workflow (After Setup)

1. **Monday**: Run Python script for new week
   ```bash
   python script.py --api-key YOUR_KEY --week 2 --csv nfl_lines_week.csv
   git add nfl_lines_week.csv
   git commit -m "Update Week 2 games"
   git push
   ```

2. **Tuesday-Sunday**: Users make picks via website

3. **Sunday Night**: Mark picks as correct/incorrect in Supabase admin panel

4. **Monday**: New week begins, repeat

---

## Security & Admin

### User Management
- Simple user selection (no passwords needed for private league)
- Admin panel in Supabase to view/edit all picks
- Export data to CSV for analysis

### Data Protection  
- Supabase handles backups automatically
- Export picks data periodically as backup
- Version controlled game data in GitHub

---

## Next Steps

1. **Set up Supabase project** (15 minutes)
2. **Create database tables** (10 minutes)  
3. **Integrate Supabase client** into React app (30 minutes)
4. **Test with fake data** (15 minutes)
5. **Deploy to GitHub Pages** (5 minutes)
6. **Set up weekly workflow** (10 minutes)

**Total setup time: ~1.5 hours**
**Ongoing time: ~5 minutes per week**

---

## Future Enhancements (Optional)

- **Authentication**: Login system for public leagues
- **Real-time Updates**: See other users' picks live
- **Mobile App**: React Native version
- **Advanced Stats**: Historical analysis, trends
- **Notifications**: Email/SMS for weekly reminders
- **Multiple Leagues**: Support different groups