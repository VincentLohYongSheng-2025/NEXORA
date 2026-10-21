# EnergiOS authorised real-data assessment

**Assessment date:** 13 October 2026 (Malaysia)
**Status:** Blocked — dataset and data dictionary not provided
**Ingestion suitability:** Not assessable; do not proceed to ingestion

## Evidence inspected

- Repository working tree and file inventory.
- `AGENTS.md`, `docs/EnergiOS_PRD.md` and
  `docs/EnergiOS_Backend_Implementation_Plan.md`.
- Current task attachments available to this session.

No authorised real Sime Darby dataset, data dictionary, source manifest or
permission record was found. The repository's Task 3 fixture is explicitly
synthetic historical test evidence and was excluded from this assessment.
No database, application, model or frontend operation was performed.

## Required assessment

| Requirement | Evidence found | Result |
| --- | --- | --- |
| Permission for hackathon use | No permission statement or data-owner approval supplied. | Unverified; blocker. |
| Permission for anonymised display | No approved display/publication scope or anonymisation requirements supplied. | Unverified; blocker. |
| Dataset source and provenance | No real dataset, source owner, export/version date, lineage record or checksum supplied. | Unverified; blocker. |
| Available buildings and meters | No real asset or meter inventory supplied. | Unknown. |
| Timestamp timezone and interval | No timestamp columns or dictionary supplied. | Unknown. |
| kWh/kW units and interval/cumulative semantics | No readings or field definitions supplied. | Unknown; do not infer units or derive demand. |
| Missing data and quality issues | No real rows available to profile for gaps, duplicates, negatives, resets, rollovers or outliers. | Not evaluated. |
| Meter mapping | No meter-to-building, floor, zone or equipment mapping supplied. | Unknown; only building-level claims would be permitted if only whole-building mappings later exist. |
| Operating schedule coverage | No opening hours, holidays, closures or exceptional periods supplied. | Unknown; forecast/detection readiness cannot be assessed. |
| Historical date range | No real timestamps supplied. | Unknown; the six-month minimum and preferred 12–24 months cannot be verified. |

## Decision and next evidence required

The real dataset is **not cleared for ingestion** because there is no dataset to
inspect and no evidence of permitted use or anonymised display. This is a failed
P0 data gate, not a judgment that a particular dataset is low quality.

Before reassessment, provide through an approved restricted workspace channel:

1. The authorised real dataset and matching data dictionary.
2. Data owner/source, export or version date, and a checksum or equivalent
   traceability record.
3. Written permission scope covering hackathon use, retention and anonymised
   display/publication, including any access restrictions.
4. Meter/asset mapping and operating schedule documentation.

Once supplied, perform a read-only profile of columns, timestamps, units,
semantics, mapping, gaps and date coverage. Do not import, migrate, train models,
build APIs or expose data to the frontend until the assessment passes and any
required non-destructive provenance migration is separately reviewed.
