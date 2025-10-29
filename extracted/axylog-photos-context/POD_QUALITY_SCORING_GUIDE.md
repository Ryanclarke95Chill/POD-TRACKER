# POD Quality Scoring Guide
## Chill Transport - Manager Reference

---

## Table of Contents
1. [Base POD Quality Score](#base-pod-quality-score)
2. [POD Quality Dashboard](#pod-quality-dashboard)
3. [Driver Rankings](#driver-rankings)
4. [Key Differences](#key-differences)
5. [Examples](#examples)

---

## Base POD Quality Score

Every delivery receives a quality score out of **100 points** based on four components:

### Scoring Components

| Component | Max Points | Criteria |
|-----------|------------|----------|
| **Temperature Compliance** | 40 | Delivery maintained correct temperature range |
| **Photos** | 25 | Number of POD photos captured (3+ for full points) |
| **Receiver Name** | 20 | Receiver name recorded on delivery |
| **Signature** | 15 | Signature captured on delivery |
| **TOTAL** | **100** | Sum of all components |

### Photo Scoring Breakdown
- **3+ photos**: 25 points (full credit)
- **2 photos**: 15 points (60% credit)
- **1 photo**: 8 points (32% credit)
- **0 photos**: 0 points

### Temperature Compliance
- **Pass**: 40 points (delivery was within required temperature range)
- **Fail**: 0 points (delivery outside temperature range)
- **Dry goods**: 40 points (no temperature requirement)

### Example Calculation
A delivery with:
- ✅ Temperature compliant: **40 points**
- ✅ 3 photos: **25 points**
- ✅ Receiver name: **20 points**
- ✅ Signature: **15 points**
- **Total: 100/100** (Outstanding)

---

## POD Quality Dashboard

The main dashboard shows overall performance statistics across all deliveries in the selected date range.

### How Statistics Are Calculated

#### Overall Average Score
```
Average Score = Total of all delivery scores ÷ Total deliveries
```

**Example:**
- 100 deliveries in date range
- Total score: 9,200 points
- **Average: 92/100**

#### Warehouse Statistics
Each warehouse's statistics include **ALL deliveries** for that warehouse:

```
Warehouse Average = Sum of all delivery scores for warehouse ÷ Number of deliveries
```

**Important:** 
- Includes ALL deliveries regardless of driver
- No minimum delivery threshold
- True average across all consignments

#### Driver Performance (Dashboard View)
Shows top-performing drivers with their average scores:

```
Driver Average = Sum of driver's delivery scores ÷ Number of deliveries
```

**Important:**
- Includes all drivers with any deliveries
- No minimum delivery requirement in this view
- Sorted by average score (highest to lowest)

---

## Driver Rankings

The Driver Rankings tab provides a competitive leaderboard with more detailed breakdowns.

### Qualification Requirements

**Main Rankings (Qualified Drivers):**
- Minimum **10 deliveries** in the selected date range
- Ensures statistically meaningful performance data
- Prevents skewed rankings from limited sample sizes

**Qualifying Drivers Section:**
- Drivers with **fewer than 10 deliveries**
- Shown separately at the bottom
- Not included in warehouse averages or national leaderboard
- Labeled as "not ranked"

### National Leaderboard
- Shows **top 20 qualified drivers** (10+ deliveries)
- Ranked by average quality score
- Includes drivers from all warehouses
- Medal indicators for top 3 positions

### Performance Improvement Focus (Bottom Performers)
- Shows **lowest qualified drivers** (10+ deliveries, up to 20 shown)
- Identifies drivers needing additional support and training
- Same detailed component breakdown as top performers
- Ranked from lowest to highest (worst performers first)
- **Toggle Switch**: Always available when qualified drivers exist - switch between viewing top or bottom performers (cleaner interface than showing both lists simultaneously)

### Warehouse Rankings
Each warehouse section shows:

#### Warehouse Average (Weighted)
```
Warehouse Average = Sum(Driver Average × Delivery Count) ÷ Total Deliveries
```

This is a **weighted average** where drivers with more deliveries have proportionally more influence.

**Example:**
- Driver A: 95 avg × 50 deliveries = 4,750 points
- Driver B: 95 avg × 50 deliveries = 4,750 points
- Driver C: 100 avg × 2 deliveries = 200 points
- **Warehouse Average = (4,750 + 4,750 + 200) ÷ 102 = 94/100**

**Important:**
- Includes **ALL drivers** regardless of delivery count (1+ deliveries)
- Weighted by delivery count (not simple average)
- Matches the POD Dashboard calculation method exactly

#### Driver Breakdown

**Ranked Drivers (10+ deliveries):**
- Show position number (#1, #2, #3, etc.)
- Full component breakdown with progress bars
- Displayed in larger cards at the top of each warehouse section

**Unranked Drivers (<10 deliveries):**
- Displayed with "—" instead of rank number
- Shown at bottom of warehouse section with disclaimer
- Compact display format
- Dashed border to indicate unranked status
- Still contribute to warehouse average

For each driver, the ranking shows:
- **Overall Score**: Average quality score (0-100)
- **Component Percentages**: Performance in each category shown as %
- **Visual Progress Bars**: Color-coded bars showing performance level (ranked drivers only)

Component percentages are calculated as:
```
Temperature % = (Avg Temperature Points ÷ 40) × 100
Photos % = (Avg Photo Points ÷ 25) × 100
Receiver % = (Avg Receiver Points ÷ 20) × 100
Signature % = (Avg Signature Points ÷ 15) × 100
```

**Important:** These percentages represent **averages across all deliveries**, not all-or-nothing metrics.

**Example - Understanding 95% Receiver Score:**
- Driver has 29 deliveries
- Captured receiver name on 28 out of 29 deliveries
- 28 deliveries × 20 points = 560 points
- 560 ÷ 29 deliveries = 19.3 average points
- 19.3 ÷ 20 max points × 100 = **96.5% ≈ 95%**

Similarly, a 93% signature score means the driver captured signatures on approximately 93% of their deliveries (27 out of 29 in this example).

---

## Key Differences

### POD Quality Dashboard vs Driver Rankings

| Aspect | POD Quality Dashboard | Driver Rankings |
|--------|----------------------|-----------------|
| **Primary Focus** | Overall delivery performance | Individual driver performance |
| **National Leaderboard** | N/A | Only qualified drivers (10+) shown in Top/Bottom 20 |
| **Warehouse Rankings** | All drivers by warehouse | All drivers by warehouse (same as dashboard) |
| **Minimum Threshold** | None | 10 deliveries for national leaderboard only |
| **Scoring Display** | Raw scores (0-100) | Scores + component percentages |
| **Data Grouping** | By warehouse & shipper | By driver & warehouse |
| **Performance Alerts** | None | Bottom performers highlighted in national view |

### Why Warehouse Averages May Differ

**POD Quality Dashboard:**
- Includes ALL deliveries (even drivers with 1-9 deliveries)
- True average of all consignments

**Driver Rankings:**
- Only includes drivers with 10+ deliveries
- Excludes newer/occasional drivers from warehouse average
- More representative of established driver performance

**Example Scenario:**

QLD Warehouse - October 6-11:
- 5 established drivers (10+ deliveries each): 95 avg
- 3 new drivers (5 deliveries each): 60 avg

**Dashboard:** Includes all 8 drivers = 92 avg  
**Rankings (Warehouse Section):** Includes all 8 drivers = 92 avg  
**Rankings (National Top 20):** Only shows 5 qualified drivers

The **10-delivery minimum** only applies to the National Top/Bottom leaderboards, not warehouse rankings.

---

## Examples

### Example 1: Understanding Component Scores

**Driver: Sarah Smith**
- 25 deliveries in date range
- Temperature: 38/40 avg = **95%**
- Photos: 23/25 avg = **92%**
- Receiver: 20/20 avg = **100%**
- Signature: 14/15 avg = **93%**
- **Overall: 95/100**

**Interpretation:**
- Excellent receiver name capture (100%)
- Strong signature performance (93%)
- Very good temperature compliance (95%)
- Photos need slight improvement (92% - missing full points on some deliveries)

### Example 2: Warehouse Comparison

**NSW Warehouse:**
- 150 total deliveries
- 8 qualified drivers (10+ deliveries)
- Weighted average: **91/100**
- 2 qualifying drivers (5 deliveries each) with 75 avg

**VIC Warehouse:**
- 200 total deliveries
- 12 qualified drivers (10+ deliveries)
- Weighted average: **88/100**
- 1 qualifying driver (8 deliveries) with 95 avg

**Rankings Show:**
- NSW: 91 avg (based on 8 qualified drivers)
- VIC: 88 avg (based on 12 qualified drivers)

**Dashboard Shows:**
- NSW: 90 avg (includes qualifying drivers)
- VIC: 88 avg (includes qualifying driver)

The small difference in NSW is due to the qualifying drivers pulling the overall average down slightly.

---

## Performance Tiers

All scores are categorized into performance tiers:

| Tier | Score Range | Color | Description |
|------|-------------|-------|-------------|
| **Outstanding** | 90-100 | Green | Exceptional performance, all standards met |
| **Good** | 75-89 | Blue | Strong performance, minor improvements possible |
| **Fair** | 60-74 | Yellow | Acceptable performance, needs attention |
| **Needs Improvement** | 0-59 | Red | Below standard, requires immediate action |

---

## Driver Rankings Layout

The Driver Rankings tab is organized in the following order:

1. **National Leaderboard (Toggle View)** - Performance showcase
   - **Top Performers View** (default):
     - Green/gold highlighted cards for top 3 positions
     - Medal indicators (🥇🥈🥉) for podium finishers
     - Full component breakdown with color-coded progress bars
     - Shows up to 20 best performers (fewer if less than 20 qualified drivers)
   - **Bottom Performers View** (always available):
     - Red-highlighted cards for visibility
     - Shows actual ranks (e.g., #67-#87 of 87)
     - Same detailed breakdown as top performers
     - Shows up to 20 worst performers (fewer if less than 20 qualified drivers)
     - Ranked from worst to best (#87, #86, #85...)
   - **Toggle Button**: Always available, switch between views with one click
   
2. **Qualifying Drivers** - New drivers building their record
   - Drivers with fewer than 10 deliveries
   - Compact display format
   - Not included in rankings or warehouse averages
   - Shows "Not Ranked" instead of numerical rank

3. **Rankings by Warehouse** - Depot-specific performance
   - Expandable accordion sections per warehouse
   - Weighted warehouse averages (includes ALL drivers, 1+ deliveries)
   - **Ranked Drivers (10+ deliveries)**: Shown first with position numbers (#1, #2, #3, etc.)
   - **Unranked Drivers (<10 deliveries)**: Shown at bottom with disclaimer, displayed as "—" instead of rank
   - All drivers contribute to warehouse average, but only qualified drivers appear in ranked positions
   - Same calculation method as POD Dashboard warehouse averages

---

## Visual Indicators

### Progress Bar Colors

Each component displays a color-coded progress bar to quickly identify performance levels:

| Color | Performance Range | Meaning |
|-------|------------------|---------|
| 🟢 **Green** | 90-100% | Excellent - Exceeding standards |
| 🔵 **Blue** | 70-89% | Good - Meeting standards |
| 🟡 **Yellow** | 50-69% | Fair - Below standard, needs attention |
| 🔴 **Red** | 0-49% | Poor - Requires immediate improvement |

**Example:**
A driver with:
- Temperature: 35% (Red bar) = Failing temperature on most deliveries
- Photos: 80% (Blue bar) = Good photo capture
- Receiver: 95% (Green bar) = Excellent receiver name capture
- Signature: 93% (Green bar) = Excellent signature capture

This visual feedback helps managers quickly identify which specific components need coaching.

### Border Colors

Component cards also have color-coded borders matching the progress bars for additional visual clarity:
- Green border = High performance (90%+)
- Blue border = Good performance (70-89%)
- Yellow border = Fair performance (50-69%)
- Red border = Poor performance (below 50%)

---

## Frequently Asked Questions

### Why do I need 10 deliveries to be ranked?

The 10-delivery minimum ensures:
- **Statistical reliability**: Enough data points for meaningful averages
- **Fair comparison**: Prevents a driver with 1 perfect delivery showing as #1 above someone with 94 excellent deliveries
- **Performance consistency**: Shows sustained performance, not one-off results
- **Recognition fairness**: Top performers have earned their position through consistent volume and quality

**Important:** Drivers with fewer than 10 deliveries still:
- ✅ Contribute to warehouse averages
- ✅ Have their scores calculated and displayed
- ✅ Appear in warehouse sections (at the bottom, unranked)
- ❌ Don't appear in National Top/Bottom 20 lists
- ❌ Don't receive rank positions (#1, #2, etc.) in warehouse sections

### Why might warehouse averages differ slightly between Dashboard and Rankings?

Both views now include **ALL drivers** in warehouse calculations, so averages should match exactly. Any minor differences would be due to:
- **Dashboard**: Groups by warehouse company name from consignment data
- **Rankings**: Groups drivers by their warehouse assignment

If you notice significant differences, it may indicate data inconsistencies that should be investigated.

### How are component percentages calculated?

Each component shows **average performance across all deliveries** relative to its maximum:
- Temperature: out of 40 points → shown as % of 40
- Photos: out of 25 points → shown as % of 25
- Receiver: out of 20 points → shown as % of 20
- Signature: out of 15 points → shown as % of 15

**Example 1 - Photos:** 23 photo points average ÷ 25 max = 92%

**Example 2 - Receiver Name (Understanding Partial Percentages):**

A driver shows **95% receiver score**:
- This means they averaged 19 points out of 20 across all deliveries
- Since receiver is 20 points OR 0 points per delivery (all-or-nothing per delivery)
- 95% means they captured receiver names on approximately **95% of their deliveries**
- Example: 28 deliveries with receiver name, 1 without = (28×20 + 1×0) ÷ 29 = 19.3 avg = 96.5% ≈ 95%

**Example 3 - Temperature (Understanding Low Percentages):**

A driver shows **35% temperature score**:
- This means they averaged 14 points out of 40 across all deliveries
- Since temperature is 40 points OR 0 points per delivery
- 35% means they passed temperature on approximately **35% of their deliveries**
- Example: 10 passes, 19 failures out of 29 deliveries = (10×40 + 19×0) ÷ 29 = 13.8 avg = 34.5% ≈ 35%

### What date range should I use?

- **Weekly reviews**: Use 7-day range for week-over-week comparison
- **Monthly reports**: Use full month range for comprehensive performance
- **Pay period**: Match your payroll period for driver incentives
- **Historical**: Start from October 6, 2025 (database retention date)

### How should I use the Bottom 20 performers list?

**Purpose:** This list is designed for **coaching and support**, not punishment.

**Recommended Actions:**
1. **Identify Patterns**: Look at component breakdowns to see if issues are widespread (e.g., all bottom performers struggling with photos)
2. **Individual Coaching**: Schedule one-on-one sessions to understand challenges
3. **Targeted Training**: Provide specific training for weak components (e.g., photo-taking best practices)
4. **Check Equipment**: Ensure drivers have functioning devices and proper access
5. **Monitor Progress**: Re-run reports weekly to track improvement

**What NOT to do:**
- Don't use it solely for disciplinary action
- Don't share publicly without context
- Don't ignore systemic issues (e.g., if all low performers are from one warehouse, it may be a training or equipment issue)

### When will the toggle appear?

The toggle switch appears whenever there are **any qualified drivers** (10+ deliveries each) in the selected date range.

**How it works based on driver count:**
- **1-20 qualified drivers** = Toggle shows all drivers in both views (e.g., 15 drivers shows top 15 and bottom 15, same drivers in different order)
- **21-40 qualified drivers** = Top view shows best 20, Bottom view shows worst 20 (some overlap possible)
- **41+ qualified drivers** = Top view shows best 20, Bottom view shows worst 20 (no overlap, middle performers not in either list)

**Using the Toggle:**
- Default view shows **Top performers** (up to 20)
- Click "View Bottom" to switch to lowest performers (up to 20)
- Click "View Top" to switch back
- Only one list is displayed at a time for cleaner interface

### Can a driver appear in multiple warehouses?

Yes! If a driver makes deliveries from multiple warehouses, they'll appear separately under each warehouse with their performance for that location.

---

## Summary

**For Managers:**
- Use **POD Quality Dashboard** for overall operational insights and complete delivery picture
- Use **Driver Rankings** for performance management and driver recognition
- Focus on **10+ delivery threshold** for fair, statistically meaningful comparisons
- Review **component percentages** to identify specific training needs
- Compare **warehouse averages** to identify high-performing depots and areas needing support
- Use **Bottom 20 performers** for targeted coaching and support programs (not punishment)

**Key Principle:**
The scoring system is designed to be objective, transparent, and fair - rewarding consistent high performance while identifying specific areas for improvement.

**Three-Tier Approach:**
1. **Top 20** = Recognition, rewards, and best practice sharing
2. **Middle Performers** = Standard operations, ongoing support
3. **Bottom 20** = Focused coaching, training, and equipment checks

---

---

## Recent Updates

**Version 1.1 - October 20, 2025**
- ✅ Fixed progress bar color rendering for all components
- ✅ Added detailed explanation of percentage calculations for receiver/signature
- ✅ Clarified toggle UI between Top and Bottom performers
- ✅ Toggle now always appears when qualified drivers exist (not just 21+)
- ✅ Warehouse rankings now include ALL drivers (not just qualified)
- ✅ Warehouse sections separate ranked (10+) and unranked (<10) drivers
- ✅ Unranked drivers shown at bottom with disclaimer and "—" symbol
- ✅ Prevents low-volume drivers from appearing as #1 above high-volume performers
- ✅ 10-delivery minimum applies to all rankings (National and Warehouse positions)
- ✅ Warehouse averages include all drivers and match Dashboard exactly
- ✅ Added Visual Indicators section with color-coding reference
- ✅ Enhanced FAQ with percentage calculation examples

**Version 1.0 - October 20, 2025**
- Initial documentation release
- Base scoring system documented
- Dashboard vs Rankings differences explained
- 10-delivery qualification threshold implemented

---

*Last Updated: October 20, 2025*  
*Version: 1.1*
