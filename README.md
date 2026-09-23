# Recycla REP OS

Operational REP Intelligence for Recycla Chile.

## Product thesis

Recycla already operates the physical recycling chain. Recycla REP OS turns that operation into auditable REP readiness.

Core flow:

```
Client -> REP obligation -> Collection -> Weighing -> Lot -> Processing
       -> Valuation -> REP eligibility -> Evidence -> Accreditation -> Reporting
```

The platform keeps these quantities separate:

- Collected
- Processed
- Valued
- REP eligible
- Evidence complete
- Accreditable

No important compliance number exists without lineage back to source evidence.

## Initial REP scope

The operational scope focuses on priority products with stronger physical traceability:

1. Aparatos electricos y electronicos (AEE / RAEE)
2. Neumaticos
3. Baterias

Out of initial scope:

- Envases y embalajes
- Textiles / ropa

These are intentionally deferred because their material flows, aggregation and chain-of-custody patterns make unit/lote-level traceability materially harder for the first product version.

The objective is not to cover every REP category. The objective is to prove a high-confidence REP operating model where physical material, evidence and regulatory accreditation can be reconciled end-to-end.

## Product surfaces

1. REP Control Tower
2. Client REP Readiness
3. REP Ledger
4. Evidence Graph
5. Audit Room
6. Report Readiness

## Design principles

- Evidence before claims
- Deterministic compliance rules before AI reasoning
- Versioned regulatory rules
- Mass balance for physical material flows
- Full traceability from KPI to document
- SISREP/RETC readiness, not replacement
- Product-specific rules and workflows, not one generic REP workflow

## Status

Initial product foundation.
