# NEXORA carbon and ESG exports

Official references checked on 22 October 2026. These sources inform disclosure
structure; they do not prescribe the application's visual PDF layout or endorse
NEXORA. The exports are management review drafts, not declarations of conformity.

## Official references

- [Bursa Malaysia Sustainability Reporting Guide, third edition](https://www.bursamalaysia.com/sites/5d809dcf39fba22790cad230/assets/6768e301e6414a4c4beb9f49/Sustainability_Reporting_Guide_2022_FINAL__1_.pdf): reporting scope, material matters and disclosure navigation.
- [Securities Commission Malaysia NSRF](https://www.sc.com.my/nsrf): Malaysian reporting context and ISSB baseline.
- [IFRS S2](https://www.ifrs.org/issued-standards/ifrs-sustainability-standards-navigator/ifrs-s2-climate-related-disclosures/): governance, strategy, risk management, metrics and targets.
- [GHG Protocol Corporate Standard, chapter 9](https://ghgprotocol.org/sites/default/files/standards/ghg-protocol-revised.pdf): inventory boundaries, reporting period, scopes, methods and emissions information.
- [GHG Protocol Scope 2 Guidance](https://ghgprotocol.org/scope-2-guidance): purchased electricity and the distinction between location-based and market-based disclosures. A consultation or proposed update is not treated as an adopted standard.

## Exports

`/api/workbench/report.pdf?report_type=carbon` creates a five-page carbon and energy
report: executive summary, inventory, methodology, reduction planning, and a
disclosure/source/review index.

`report_type=esg` creates a six-page ESG report: executive summary, governance and
strategy, environmental performance, social/governance coverage and evidence,
reduction planning, and a disclosure/source/review index.

Both retain the selected building and history period. Dashboard filters affect
the planning appendix, not the whole-building inventory. Individual checklist
reviews are passed as `reviewed_items`; review does not verify a supporting file.

The current factor is hypothetical, so the report labels its emissions as an
electricity estimate. It does not certify either Scope 2 calculation method.
Missing scopes, social metrics, consolidation/base-year decisions, corporate
targets and assurance remain explicit gaps. Forecast savings are reported apart
from source-period activity; tree equivalents do not offset the inventory.
