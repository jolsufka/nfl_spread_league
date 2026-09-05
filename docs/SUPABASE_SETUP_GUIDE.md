# Supabase Setup Guide for NFL Spread League

## Overview
Step-by-step guide to integrate your existing React app with Supabase database.

---

## Phase 1: Database Setup

### 1. Create Database Tables

In your Supabase dashboard, go to **SQL Editor** and run these commands:

```sql
-- Users table
CREATE TABLE users (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Insert your 6 league members
INSERT INTO users (id, name) VALUES 
  ('jacob', 'Jacob'),
  ('cam', 'Cam'),
  ('con', 'Con'),
  ('nathan', 'Nathan'),
  ('shane', 'Shane'),
  ('max', 'Max');

-- User picks table
CREATE TABLE picks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT REFERENCES users(id),
  season INTEGER NOT NULL DEFAULT 2026,
  week INTEGER NOT NULL,
  game_id TEXT NOT NULL,
  team TEXT NOT NULL,
  spread DECIMAL NOT NULL,
  correct BOOLEAN DEFAULT NULL, -- legacy compat; result is authoritative
  result TEXT CHECK (result IN ('W','L','P') OR result IS NULL), -- NULL = not graded yet, 'P' = push
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, week, game_id) -- Prevent duplicate picks
);

-- Create indexes for better performance
CREATE INDEX idx_picks_user_week ON picks(user_id, week);
CREATE INDEX idx_picks_week ON picks(week);
CREATE INDEX picks_season_week_idx ON picks(season, week);
```

The `season` and `result` columns were added to the original schema by `supabase/migrations/20260905_season_2026_foundation.sql` (idempotent; run it in the SQL Editor on an existing database).

### 2. Enable Row Level Security (RLS)

The anon key (shipped in the browser bundle) may read everything, and may only create/modify/remove UNGRADED picks in the current era. Graded history is immutable to the public key. Grading happens with the service-role key (bypasses RLS), never shipped to browsers — the Python grading script requires it as the `SUPABASE_SERVICE_KEY` env var.

```sql
-- Enable RLS on both tables
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE picks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "picks_public_read" ON picks
  FOR SELECT TO anon USING (true);

CREATE POLICY "picks_anon_insert_ungraded" ON picks
  FOR INSERT TO anon
  WITH CHECK (correct IS NULL AND result IS NULL AND season >= 2026);

CREATE POLICY "picks_anon_update_ungraded" ON picks
  FOR UPDATE TO anon
  USING (correct IS NULL AND result IS NULL AND season >= 2026)
  WITH CHECK (correct IS NULL AND result IS NULL AND season >= 2026);

CREATE POLICY "picks_anon_delete_ungraded" ON picks
  FOR DELETE TO anon
  USING (correct IS NULL AND result IS NULL AND season >= 2026);

-- users table: public read only; changes require service role
CREATE POLICY "users_public_read" ON users
  FOR SELECT TO anon USING (true);
```

These are the same policies applied by `supabase/migrations/20260905_season_2026_foundation.sql`, which also drops the old wide-open "Allow all operations" policies.

### 3. Get Your API Credentials

1. Go to **Settings** → **API** in Supabase dashboard
2. Copy these values:
   - **Project URL**: `https://your-project-id.supabase.co`
   - **API Key (anon/public)**: `eyJhbGciOiJIUzI1NiIs...`

---

## Phase 2: React App Integration

### 1. Install Supabase Client

```bash
cd nfl-pickem
npm install @supabase/supabase-js
```

### 2. Create Supabase Configuration

Create `src/supabase.js`:

```javascript
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://your-project-id.supabase.co'
const supabaseAnonKey = 'your-anon-key-here'

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
```

### 3. Update App.tsx - Add Supabase Import

```javascript
// Add this import at the top of App.tsx
import { supabase } from './supabase';
```

### 4. Replace loadPicks Function

Replace the current `loadPicks` function in `App.tsx`:

```javascript
const loadPicks = async () => {
  try {
    const { data, error } = await supabase
      .from('picks')
      .select('*')
      .order('week', { ascending: true });

    if (error) throw error;

    // Group picks by user and week
    const groupedPicks = data.reduce((acc, pick) => {
      const key = `${pick.user_id}-${pick.week}`;
      if (!acc[key]) {
        acc[key] = {
          userId: pick.user_id,
          week: pick.week,
          picks: [],
          correct: 0
        };
      }
      
      acc[key].picks.push({
        gameId: pick.game_id,
        team: pick.team,
        spread: pick.spread,
        correct: pick.correct
      });
      
      if (pick.correct === true) {
        acc[key].correct++;
      }
      
      return acc;
    }, {});

    const picksArray = Object.values(groupedPicks);
    setPicks(picksArray);
    
  } catch (error) {
    console.error('Error loading picks:', error);
    setPicks([]);
  }
};
```

### 5. Replace savePicks Function

Replace the current `savePicks` function in `App.tsx`:

```javascript
const savePicks = async (userId, week, selectedPicks) => {
  try {
    // First, delete any existing picks for this user/week
    await supabase
      .from('picks')
      .delete()
      .eq('user_id', userId)
      .eq('week', week);

    // Then insert the new picks
    const pickRecords = selectedPicks.map(pick => ({
      user_id: userId,
      week: week,
      game_id: pick.gameId,
      team: pick.team,
      spread: pick.spread,
      correct: null // Will be set later when games finish
    }));

    const { error } = await supabase
      .from('picks')
      .insert(pickRecords);

    if (error) throw error;

    // Reload picks to update UI
    await loadPicks();
    
    alert('Picks saved successfully!');
    
  } catch (error) {
    console.error('Error saving picks:', error);
    alert('Error saving picks. Please try again.');
  }
};
```

---

## Phase 3: Testing

### 1. Test Database Connection

Add this test function to your App.tsx (temporary):

```javascript
const testConnection = async () => {
  try {
    const { data, error } = await supabase.from('users').select('*');
    if (error) throw error;
    console.log('Users from database:', data);
  } catch (error) {
    console.error('Database connection error:', error);
  }
};

// Add a test button in your JSX (temporary)
<button onClick={testConnection}>Test Database</button>
```

### 2. Test Pick Submission

1. Start your dev server: `npm start`
2. Go to "Make Picks" tab
3. Select a user and make 3 picks
4. Click "Save Picks"
5. Check Supabase dashboard → **Table Editor** → **picks** table
6. You should see your picks in the database!

### 3. Test Pick Display

1. Go to "Pick Chart" tab
2. Should show your submitted picks
3. Go to "Pick History" tab  
4. Select the user who made picks
5. Should show detailed pick history

---

## Phase 4: Mark Results (After Games)

Grading is normally automated: `scripts/results_script.py` writes `result` = W/L/P for every pick (it needs the `SUPABASE_SERVICE_KEY` env var, since RLS blocks the anon key from writing grades). Manual dashboard edits are only a fallback.

### How to Update Pick Results

1. Go to Supabase dashboard → **Table Editor** → **picks**
2. Find picks for completed games
3. Set `correct` column to `true` or `false` based on game results
4. Users will automatically see updated W/L records

**Example**: If Cowboys +7.5 covered the spread:
```sql
UPDATE picks 
SET correct = true 
WHERE game_id = '1' AND team = 'Dallas Cowboys';

UPDATE picks 
SET correct = false 
WHERE game_id = '1' AND team = 'Philadelphia Eagles';
```

---

## Phase 5: Deployment

### 1. Environment Variables

Create `.env.local` file in your React app:

```
REACT_APP_SUPABASE_URL=https://your-project-id.supabase.co
REACT_APP_SUPABASE_ANON_KEY=your-anon-key-here
```

Update `src/supabase.js`:

```javascript
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.REACT_APP_SUPABASE_URL
const supabaseAnonKey = process.env.REACT_APP_SUPABASE_ANON_KEY

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
```

### 2. Deploy to GitHub Pages

```bash
npm run build
npm run deploy
```

Your app will be live at: `https://jolsufka.github.io/nfl_spread_league`

---

## Phase 6: Weekly Workflow

### Monday: New Week Setup
1. Run your Python script (or let the `weekly-update.yml` GitHub Action do it Tuesday morning):
   ```bash
   python3 scripts/script.py
   git add data/lines nfl-pickem/public/lines
   git commit -m "Week 3 games"
   git push
   ```

2. GitHub Pages automatically updates (5-10 minutes)

### Tuesday-Sunday: Users Make Picks
- Users visit website and submit picks
- All picks saved to Supabase automatically
- Everyone can see each other's picks in real-time

### Sunday Night: Update Results
1. Check game results
2. Update `correct` field in Supabase picks table
3. Users see updated standings immediately

---

## Troubleshooting

### Common Issues

1. **"Failed to fetch" error**
   - Check your Supabase URL and API key
   - Make sure RLS policies allow access

2. **Picks not appearing**
   - Check browser console for errors
   - Verify data in Supabase Table Editor

3. **Can't submit picks**
   - Check if user exists in users table
   - Verify UNIQUE constraint isn't blocking duplicate picks

### Debug Tools

1. **Supabase Dashboard**: Table Editor to view raw data
2. **Browser Console**: Check for JavaScript errors  
3. **Network Tab**: See API requests to Supabase

---

## Next Steps

After everything works:
1. Remove test functions
2. Add loading states for better UX
3. Consider real-time updates (optional)
4. Set up automated result updates (advanced)