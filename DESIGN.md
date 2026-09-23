# Recycla REP OS — Interface Canon

## Product character

Recycla REP OS is an operational compliance system, not a marketing dashboard.

The interface must feel:

- precise;
- calm;
- evidence-led;
- industrial;
- auditable;
- trustworthy.

It must not look like a generic SaaS template.

## Visual language

### Base

- Deep graphite / near-black application canvas.
- Recycla green is the primary signal color.
- Warm amber is reserved for warning.
- Red is reserved for consequential blocking states.
- No decorative gradients.
- No rounded-card visual language.
- No unnecessary shadows.

### Surfaces

Use only three main depths:

1. application canvas;
2. operational panel;
3. focused / active state.

Avoid cards inside cards unless there is a real interaction boundary.

### Typography

- Large headings: compact, regular-to-semibold, strong editorial hierarchy.
- Body: concise and operational.
- Micro-labels: uppercase, tracked, low-noise.
- Numbers: prominent only when they represent a decision or regulatory state.

## Information hierarchy

Every important screen should answer, in this order:

1. What is the current state?
2. What needs attention?
3. What quantity is affected?
4. Why?
5. What evidence supports it?
6. What is the next action?

## Navigation

Desktop:
- persistent left rail;
- numbered modules;
- active state through contrast and green signal;
- product streams remain secondary to operational navigation.

Mobile:
- compact top identity;
- horizontally scrollable module navigation;
- never hide navigation entirely.

## Status semantics

Green:
- complete;
- verified;
- ready;
- healthy.

Amber:
- attention;
- incomplete but recoverable;
- forecast or reconciliation warning.

Red:
- blocked;
- not accreditable;
- critical evidence failure.

Gray:
- inactive;
- metadata;
- informational.

## REP-specific UX rules

- Never present collected, processed, valued, eligible, evidence-complete and accreditable quantities as interchangeable.
- Every consequential KPI must offer a path to lineage/evidence.
- Never combine incompatible units in one total.
- Show exact blocker quantity when possible.
- Prefer "what is blocking this?" over generic status labels.
- Report Readiness is binary only at the final reporting gate; upstream states should preserve nuance.
- Empty states must say whether there is no data, no obligation, no evidence, or no database connection.

## Responsive behavior

At <= 1100px:
- hide desktop rail;
- show mobile identity and scrollable module navigation;
- stack decision panels;
- preserve table scroll where necessary.

At <= 640px:
- one-column operational hierarchy;
- no clipped values;
- no hover-only interactions;
- maintain 44px-effective touch targets for primary navigation and actions.

## Motion

Minimal.

Allowed:
- subtle hover feedback;
- progress state transitions;
- focus indicators.

Avoid:
- ambient animation;
- decorative parallax;
- continuous glows;
- motion that delays operational tasks.

## Quality gate

Before release:

- clear primary decision in <5 seconds;
- no visual noise from excess borders/cards;
- desktop and mobile checked;
- visible focus;
- no hidden navigation;
- no unsupported regulatory claims;
- no misleading demo data in persistence-backed screens;
- exact preview SHA visually verified.
