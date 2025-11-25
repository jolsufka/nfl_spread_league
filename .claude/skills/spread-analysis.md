# Spread Analysis Skill

## Purpose
This skill provides comprehensive guidance on evaluating NFL point spreads to ensure accurate analysis and avoid common mistakes when determining if picks are correct.

## NFL Spread Fundamentals

### How Spreads Work
- **Negative Spread (-X)**: Team is favored and must WIN by MORE than X points to cover
- **Positive Spread (+X)**: Team is underdog and must either WIN outright OR lose by LESS than X points to cover
- **Push**: When the final margin equals exactly the spread (rare with half-point spreads)

### Critical Rules
1. **Favorites (negative spreads)** must WIN by MORE than the spread
2. **Underdogs (positive spreads)** cover if they WIN or lose by LESS than the spread
3. **Exact spread margin** = Push (no winner/loser)

## Examples

### Favorite Covering Spread
- **Buffalo Bills -6** vs Houston Texans
- Bills need to WIN by 7+ points to cover
- Final: Bills 30, Texans 20 (Bills win by 10) → Bills COVER ✅

### Favorite NOT Covering Spread
- **Buffalo Bills -6** vs Houston Texans  
- Bills need to WIN by 7+ points to cover
- Final: Texans 23, Bills 19 (Bills lose by 4) → Bills DO NOT COVER ❌

### Underdog Covering Spread
- **Houston Texans +6** vs Buffalo Bills
- Texans cover if they win OR lose by 5 or fewer points
- Final: Texans 23, Bills 19 (Texans win outright) → Texans COVER ✅

### Push Example
- **Bills -6** vs Texans
- Final: Bills 26, Texans 20 (Bills win by exactly 6) → PUSH

## Analysis Process

### Step 1: Identify the Pick
- Which team was picked?
- What was their spread?
- Were they favorite (negative) or underdog (positive)?

### Step 2: Calculate Margin
- Final score difference
- Winning team minus losing team score

### Step 3: Apply Spread Logic
- **If picked team was favorite (-X)**: Did they win by MORE than X?
- **If picked team was underdog (+X)**: Did they win OR lose by LESS than X?

### Step 4: Determine Result
- Cover = Correct pick ✅
- No cover = Incorrect pick ❌
- Push = Typically no action (depends on league rules)

## Common Mistakes to Avoid

1. **Confusing spread direction**: Remember negative = must win by more
2. **Forgetting "more than" rule**: -6 means win by 7+, not 6+
3. **Misreading final scores**: Always double-check who won
4. **Ignoring overtime**: Final score includes OT
5. **Mixing up teams**: Verify which team was actually picked

## Quick Reference Card

| Spread | Team Status | Covers When |
|--------|-------------|-------------|
| -3 | Favorite | Win by 4+ |
| -7.5 | Favorite | Win by 8+ |
| +3 | Underdog | Win OR lose by 1-2 |
| +7.5 | Underdog | Win OR lose by 1-7 |

## Verification Checklist

Before marking any pick as correct/incorrect:

- [ ] Confirmed final score (including OT)
- [ ] Identified which team was picked
- [ ] Noted the exact spread value
- [ ] Calculated actual point margin
- [ ] Applied correct spread logic
- [ ] Double-checked the math

## Integration with NFL League System

When processing results for the NFL spread league:

1. **Load spread data** from CSV files in `data/lines/`
2. **Match team names** exactly as they appear in pick data
3. **Apply spread logic** using this skill's rules
4. **Update database** with correct boolean values
5. **Verify calculations** before finalizing

## Error Recovery

If you realize a mistake was made:
1. Acknowledge the error immediately
2. Identify the correct spread logic
3. Recalculate using proper rules
4. Update database with corrected values
5. Document the correction for transparency

---

**Remember**: When in doubt about spread calculations, always refer back to this skill to ensure accuracy and avoid embarrassing mistakes!