# Recycla REP OS - Operational Architecture

## Scope

Initial supported physical streams:

- AEE / RAEE
- Neumáticos
- Baterías
- Pilas
- Aceites lubricantes

Deferred:

- Envases y embalajes
- Textiles / ropa

The product intentionally starts where physical traceability is strongest.

## Promise

For every Recycla client, show:

1. what the applicable REP obligation is;
2. what was physically collected and processed;
3. what was valued;
4. what is REP-eligible;
5. what has complete evidence;
6. what is actually accreditable;
7. what still prevents readiness.

## Core invariants

### Lineage
Every KPI must navigate to the source operations and documents that produced it.

### Physical != regulatory
Collected, processed, valued, eligible, evidence-complete and accreditable quantities are different states.

### Mass balance
For closed processing scopes:

```
input = outputs + stock + loss + reject
```

### Evidence completeness
Physical processing alone cannot create an accreditable quantity.

### Regulatory versioning
Rules keep effective dates and sources so historical calculations remain reproducible.

## Shared platform core

- REP Ledger
- Evidence Graph
- Audit Engine
- Readiness Engine
- Forecast Engine
- Report Readiness

## Product-specific adapters

Each priority stream gets its own operational rules and evidence profile.

### AEE / RAEE
Unit/lote identity, weight, equipment class, secure destruction when relevant, processing and material outputs.

### Neumáticos
Unit/count/weight, source, collection event, processing route and final valuation.

### Baterías
Unit/lote, chemistry/type, weight, hazardous handling evidence and destination.

### Pilas
Lote, chemistry/type where available, weight, treatment and evidence.

### Aceites lubricantes
Volume/weight conversion where required, collection event, transporter, treatment/regeneration/valuation and volume/mass reconciliation.

## AI boundary

AI may classify documents, explain gaps and propose mappings.

AI may not decide regulatory eligibility without deterministic rules or silently override evidence requirements.


## Circularity outcome model

The treatment hierarchy is modeled as an orthogonal physical-outcome dimension, not as sequential REP Ledger states.

Canonical hierarchy:

1. Prevention
2. Preparation for reuse
3. Recycling
4. Energy recovery
5. Disposal

Prevention happens before waste generation, so it is represented in product strategy and analytics but is not a `valuation_output`.

Waste treatment outputs store one `circularity_route`:

- PREPARATION_FOR_REUSE
- RECYCLING
- ENERGY_RECOVERY
- DISPOSAL

This prevents a modeling error where reuse, recycling and energy recovery would appear as if every kilogram must pass through each step.

### Internal Circularity Quality

Recycla OS may calculate an internal decision-support index to compare the mix of outcomes across clients, periods and materials.

This is explicitly an internal operational metric, not a statutory REP compliance metric.

Compliance remains governed by versioned REP rules and evidence.
