# Connected township energy

## Manager workflow
1. Open Overview. Each building has a source badge: blue Grid, green Solar, yellow Hybrid.
2. Dashed green connections show proposed solar-sharing routes from Solar Park to Exchange and Medical Centre.
3. In Connected township energy, review a cross-building alert. The receiving floor is selected from the highest unmet modelled floor load.
4. Approve sharing. The recipient changes to Hybrid, the route becomes solid, and the floor allocation updates.
5. View receiving floor opens the correct facility and floor. The floor list distinguishes on-site solar, shared solar and grid electricity.
6. Reset sharing plan removes the approved allocations; the review history is retained.

## Calculation boundary
This is a next-day planning simulation. Hourly supply comes from residual curtailment in the existing dispatch model, after local consumption and battery charging. One shared ledger prevents surplus being offered to two recipients simultaneously. Delivery includes 3% transfer loss, and cannot exceed the receiving floor's unmet demand. It replaces grid electricity; it does not reduce building consumption.

The 14:00–17:00 window uses forecast-local hours. The assumed premium price is the configured flat rate multiplied by 1.4, explicitly not an actual TNB tariff. Floor loads use disclosed illustrative weights. Solar Park is treated as the modelled existing solar resource; other building PV/storage enters the supply allocation only after approval of its solar action. Badges describe this approved planning allocation.

Interconnection, metering and permissions are assumed, and no physical transfer or switching occurs. Sharing impacts remain separate from existing building efficiency/carbon totals to avoid claiming them twice.

## Validation
- Six sharing tests: hourly conservation, losses, demand limits, scarcity priority, missing factors, source status, approval persistence/idempotency, and reset.
- Four existing township calculation regressions passed.
- 57 frontend tests passed, including 8 Three.js camera tests.
- Real browser: approve Exchange, verify Hybrid source, open Level 4, verify shared solar and zero residual grid, check mobile viewport and console (no errors).
- Existing unrelated failures remain in legacy compliance tests (redirected old pages) and one older PDF byte-string assertion. Those files were not changed for this feature.

Updated application preview: http://127.0.0.1:8008/#overview
