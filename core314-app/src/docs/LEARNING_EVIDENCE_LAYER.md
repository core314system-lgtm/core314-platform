# Learning Evidence Layer

## Overview

The Learning Evidence Layer exposes and proves Core314's self-learning behavior using derived evidence from existing system signals. This layer provides transparency into how the system learns from connected integrations without introducing new AI logic or making speculative claims.

## Architecture

### Derived Learning State Model

The `learning_state` is a derived object (computed layer) per integration/metric. It is NOT persisted - all values are computed deterministically from existing data.

**Fields:**

| Field | Type | Description |
|-------|------|-------------|
| `baseline_established_at` | timestamp | When the first score was recorded for this integration |
| `snapshot_count` | int | Number of fusion score snapshots recorded |
| `confidence_current` | float (0-1) | Current confidence level derived from data sufficiency |
| `confidence_delta_30` | float | Change in confidence over the last 30 days |
| `variance_current` | float | Current variance in fusion scores |
| `variance_trend` | enum | `increasing` \| `decreasing` \| `stable` |
| `maturity_stage` | enum | `observe` \| `analyze` \| `predict` |
| `learning_velocity` | enum | `low` \| `medium` \| `high` |
| `last_promotion_event` | timestamp \| null | When the integration last advanced maturity stage |
| `suppression_events_count` | int | Number of anomaly suppression events |

**Derivation Rules:**

1. **Confidence** is derived from:
   - Snapshot count (more snapshots = higher confidence)
   - Metrics count (more metrics = higher confidence)
   - Variance (lower variance = higher confidence)
   - Score existence (having a score = higher confidence)

2. **Variance Trend** is derived by comparing recent variance to older variance:
   - `decreasing`: Recent variance < 70% of older variance
   - `increasing`: Recent variance > 130% of older variance
   - `stable`: Otherwise

3. **Maturity Stage** is derived from data sufficiency:
   - `observe`: < 5 snapshots or < 3 metrics
   - `analyze`: 5-14 snapshots and 3+ metrics
   - `predict`: 15+ snapshots and 5+ metrics

4. **Learning Velocity** is derived from snapshot frequency:
   - `high`: Average < 2 days between snapshots
   - `medium`: Average 2-7 days between snapshots
   - `low`: Average > 7 days between snapshots

### Learning Event Log

A read-only learning event stream generated from historical data.

**Event Types:**

| Event Type | Description |
|------------|-------------|
| `BASELINE_ESTABLISHED` | First score recorded for an integration |
| `CONFIDENCE_INCREASED` | Variance decreased significantly |
| `CONFIDENCE_DECREASED` | Variance increased significantly |
| `VARIANCE_STABILIZED` | Variance dropped below stability threshold |
| `MATURITY_PROMOTED` | Integration advanced to a higher maturity stage |
| `ANOMALY_PATTERN_LEARNED` | System detected and recorded an anomaly pattern |

**Event Structure:**

```typescript
interface LearningEvent {
  id: string;
  event_type: LearningEventType;
  occurred_at: string;
  explanation: string;  // Plain English, deterministic
  integration_id?: string;
  integration_name?: string;
}
```

## Frontend Components

### System Learning Panel

Displays the current learning state of Core314's intelligence system.

**Location:** Dashboard, below Intelligence Readiness Panel

**Displays:**
- Current maturity stage (Observing / Analyzing / Prediction Ready)
- Confidence score with trend indicator
- Variance trend (Decreasing / Stable / Increasing)
- Learning velocity badge (Low / Medium / High)
- Snapshot count summary
- Learning in progress indicator (for new users)

### Learning Timeline

Chronological list of learning events - "What Core314 Has Learned".

**Location:** Dashboard, below System Learning Panel

**Displays:**
- Timeline of learning events with icons and colors
- Event type, integration name, relative time, and explanation
- Shows up to 10 events by default with indicator if more exist
- Disclaimer that events are derived from observed behavior

## Legal & Safety

Both components are labeled as **"Learning Evidence (Non-Actionable)"** to clearly separate learning output from recommendations.

**Hard Constraints:**
- No new API calls
- No AI calls
- Content must be deterministic
- No probabilistic language (e.g., "might", "could", "probably")
- No recommendations
- All logic must be explainable and auditable

## Usage

```typescript
import { useLearningState } from '../hooks/useLearningState';

function MyComponent() {
  const { 
    learningStates,    // Per-integration learning states
    learningEvents,    // Chronological learning events
    globalSummary,     // Aggregate learning metrics
    loading 
  } = useLearningState();
  
  // Use the data...
}
```

## Acceptance Criteria

1. **New user with minimal data sees:**
   - "Learning in progress" indicator
   - Explicit explanation of why confidence is low

2. **Mature integration shows:**
   - Learning progression
   - Promotion history
   - Confidence justification

3. **No new AI claims introduced**

4. **No breaking changes to existing functionality**

5. **All logic is explainable and auditable**

## Data Sources

The Learning Evidence Layer derives all data from existing tables:
- `user_integrations` - Connected integrations
- `fusion_scores` - Current fusion scores
- `fusion_score_history` - Historical score snapshots
- `fusion_metrics` - Integration metrics

No new tables or persistence is required.
