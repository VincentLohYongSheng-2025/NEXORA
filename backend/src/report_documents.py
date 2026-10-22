"""Purpose-specific ESG and carbon PDFs with explicit disclosure coverage."""
from datetime import datetime, timezone
from io import BytesIO
from pathlib import Path
from zoneinfo import ZoneInfo

from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle
from reportlab.platypus import SimpleDocTemplate, Spacer, PageBreak

from .carbon_report import p, safe, table, fmt, Metrics, CarbonTrend, BODY, SMALL, TITLE, H2, NAVY, TEAL, MUTED, PALE, LINE, WIDTH

SOURCES = [
    ('Bursa Malaysia', 'Sustainability Reporting Guide, 3rd edition',
     'https://www.bursamalaysia.com/sites/5d809dcf39fba22790cad230/assets/6768e301e6414a4c4beb9f49/Sustainability_Reporting_Guide_2022_FINAL__1_.pdf'),
    ('Securities Commission Malaysia', 'National Sustainability Reporting Framework', 'https://www.sc.com.my/nsrf'),
    ('IFRS Foundation', 'IFRS S2 Climate-related Disclosures',
     'https://www.ifrs.org/issued-standards/ifrs-sustainability-standards-navigator/ifrs-s2-climate-related-disclosures/'),
    ('GHG Protocol', 'Corporate Accounting and Reporting Standard - Chapter 9',
     'https://ghgprotocol.org/sites/default/files/standards/ghg-protocol-revised.pdf'),
    ('GHG Protocol', 'Scope 2 Guidance', 'https://ghgprotocol.org/scope-2-guidance'),
]
CHECKS = [('energy', 'Energy history reviewed'), ('factor', 'Emission factor documented'),
          ('scope', 'Scope boundary reviewed'), ('area', 'Floor area checked'),
          ('plan', 'Reduction plan reviewed'), ('assurance', 'Independent assurance evidence')]
SHARES = [('hvac', 'HVAC', 48), ('lighting', 'Lighting', 21), ('plugs', 'Plug loads', 14),
          ('lifts', 'Lifts', 9), ('ev', 'EV charging', 8)]
KICKER = ParagraphStyle('report-kicker', parent=SMALL, fontName='Helvetica-Bold', textColor=TEAL, fontSize=9, spaceAfter=9)
SUBTITLE = ParagraphStyle('report-subtitle', parent=BODY, fontName='Helvetica-Bold', fontSize=17, leading=23, spaceAfter=8)


def section(number, title, subtitle=None):
    items = [p(f'{number} / {safe(title)}', H2)]
    if subtitle:
        items.append(p(subtitle, SMALL))
        items.append(Spacer(1, 9))
    return items


def note(title, text):
    block = table(['REPORTING NOTE'], [[f'{title}: {text}']], [WIDTH])
    return [Spacer(1, 10), block]


def money(value):
    return 'Not available' if value is None else 'RM ' + fmt(value, 2)


def build_report(data, report_type='carbon'):
    if report_type not in {'carbon', 'esg'}:
        raise ValueError('Unknown report type')
    esg = report_type == 'esg'
    asset, m, config = data['asset'], data['metrics'], data['config']
    planning = data.get('dashboard_planning') or {}
    generated = datetime.now(timezone.utc)
    name = asset.get('name') or asset['source_asset_id'].replace('Hog_', '').replace('_', ' ')
    estimated = bool(asset.get('facility_id'))
    start, end = data['observed_window']['from'], data['observed_window']['to']
    period_label = f'{start[:10]} to {end[:10]}'
    factor = config['carbon_kg_per_kwh']
    carbon = m['observed_carbon_estimate_kg']
    area = asset.get('floor_area_m2')
    energy = m['observed_energy_kwh']
    days = max(1, len(data['observed']) / 24)
    intensity = energy / area if area else None
    annual_intensity = intensity / days * 365 if intensity is not None else None
    target = planning.get('target_percent', 20)
    checked = set(planning.get('reviewed_items', []))
    reference = f'NX-{report_type.upper()}-{asset["id"][:8].upper()}-{data["period"].upper()}-{generated:%Y%m%d}'
    label = 'ESG & Sustainability Report' if esg else 'Carbon & Energy Report'
    pages = 6 if esg else 5
    logo = Path(__file__).resolve().parents[2] / 'frontend/assets/nexora-logo.png'
    output = BytesIO()

    def chrome(c, doc):
        c.saveState()
        if logo.exists():
            c.drawImage(str(logo), 42, 788, width=73, height=39, preserveAspectRatio=True, anchor='sw', mask='auto')
        else:
            c.setFillColor(NAVY); c.setFont('Helvetica-Bold', 16); c.drawString(42, 801, 'NEXORA')
        c.setFillColor(NAVY); c.setFont('Helvetica-Bold', 8); c.drawRightString(A4[0]-42, 813, label.upper())
        c.setFillColor(MUTED); c.setFont('Helvetica', 7); c.drawRightString(A4[0]-42, 800, reference)
        c.drawRightString(A4[0]-42, 788, f'Generated {generated:%d %b %Y, %H:%M} UTC')
        c.setStrokeColor(TEAL); c.setLineWidth(1.5); c.line(42, 778, A4[0]-42, 778)
        c.setStrokeColor(LINE); c.setLineWidth(.5); c.line(42, 43, A4[0]-42, 43)
        c.setFillColor(MUTED); c.setFont('Helvetica', 7)
        c.drawString(42, 29, 'NEXORA  /  MANAGEMENT REVIEW DRAFT  /  NOT ASSURED')
        c.drawRightString(A4[0]-42, 29, f'{doc.page:02d} / {pages:02d}')
        c.restoreState()

    doc = SimpleDocTemplate(output, pagesize=A4, rightMargin=42, leftMargin=42,
        topMargin=80, bottomMargin=60, pageCompression=0, title=f'NEXORA {label} - {name}',
        author='NEXORA', subject=f'{label}; building electricity evidence and disclosure coverage')
    story = [Spacer(1, 15), p('BUILDING PERFORMANCE  /  MANAGEMENT DISCLOSURES', KICKER),
        p('ESG & Sustainability<br/>Report' if esg else 'Carbon & Energy<br/>Report', TITLE),
        Spacer(1, 17), p(safe(name), SUBTITLE),
        p(f'Selected source period: {safe(period_label)} | {safe(asset["timezone"])}', SMALL),
        Spacer(1, 19), Metrics([
            ('Electricity-linked emissions', fmt(carbon/1000 if carbon is not None else None, 3), 't CO2e | selected period'),
            ('Electricity consumption', fmt(energy), 'kWh | selected period'),
            ('Estimated electricity cost', money(m['observed_cost_estimate_myr']), 'MYR | configured tariff'),
        ])]
    story += section('01', 'Executive summary')
    story += [p(f'{safe(name)} records {fmt(energy)} kWh of '
        f'{"illustrative building electricity" if estimated else "historical benchmark electricity"} '
        f'for the selected period. Electricity-linked emissions are {fmt(carbon, 1)} kg CO<sub>2</sub>e '
        'using the configured factor. Forecast reductions appear separately from this inventory.'), Spacer(1, 12),
        table(['DOCUMENT CONTROL', 'REPORTING BASIS'], [
            ['Report boundary', 'One selected building; electricity only. Corporate consolidation is not established.'],
            ['Data classification', 'Benchmark-derived facility estimates' if estimated else 'Public historical benchmark observations'],
            ['Reporting currency / units', 'MYR; kWh; kW; kg CO2e and t CO2e'],
            ['Publication status', 'Management review draft; independent assurance has not been supplied.'],
        ], [140, WIDTH-140])]
    story += section('CONTENTS', 'Report navigation')
    contents = ([['02', 'Governance, strategy & risk', '2'], ['03', 'Environmental performance', '3'],
        ['04', 'Social, governance & evidence', '4'], ['05', 'Reduction plan & planning appendix', '5'],
        ['06', 'Disclosure index, sources & review', '6']] if esg else
        [['02', 'Inventory boundary & performance', '2'], ['03', 'Methodology & data quality', '3'],
         ['04', 'Reduction plan & planning appendix', '4'], ['05', 'Disclosure index, sources & review', '5']])
    story += [table(['SECTION', 'CONTENT', 'PAGE'], contents, [65, WIDTH-115, 50])]
    story += [Spacer(1, 9), p('Structure informed by official Bursa Malaysia, Malaysian NSRF, IFRS and GHG Protocol guidance. '
        'This limited building report does not assert full compliance with those frameworks.', SMALL)]

    if esg:
        story += [PageBreak(), p('Governance, strategy<br/>& risk', TITLE)]
        story += section('02', 'Sustainability oversight and priorities')
        story += [table(['DISCLOSURE AREA', 'CURRENT EVIDENCE / REQUIRED FOLLOW-UP'], [
            ['Governance', 'The application records human approval of proposed actions. Board oversight, named accountable officers and approved policies are not supplied.'],
            ['Strategy', 'Energy efficiency and rooftop solar are planning opportunities. Business resilience, time horizons and financial effects require management assessment.'],
            ['Risk management', 'Building alerts support operational review. A corporate climate risk process, scenario analysis and integration with enterprise risk management are not documented.'],
            ['Metrics and targets', f'Electricity and estimated emissions appear on page 3. A {fmt(target,0)}% dashboard planning target appears on page 5; no approved corporate target or target year is supplied.'],
        ], [115, WIDTH-115])]
        story += section('MATERIALITY', 'Candidate matters for management assessment',
            'These topics are suggested by the available building data. Stakeholder consultation and a formal materiality assessment have not been completed.')
        story += [table(['CANDIDATE MATTER', 'RELEVANCE / NEXT EVIDENCE'], [
            ['Energy and emissions', 'Assess electricity demand, grid exposure and efficiency opportunities using invoices, meters and a validated emissions factor.'],
            ['Occupant wellbeing', 'Review comfort alerts against verified occupancy, indoor conditions and incident records.'],
            ['Climate resilience', 'Assess physical risks to the site, transition risks and potential costs; no site hazard study is available.'],
            ['Accountability and conduct', 'Confirm decision owners, procurement controls, anti-corruption policies and reporting responsibilities.'],
        ], [135, WIDTH-135])]
        story += note('Management action', 'Assign an owner, confirm material matters and assess climate risks, opportunities and financial effects before external publication.')

    story += [PageBreak(), p('Environmental<br/>performance' if esg else 'Inventory boundary<br/>& performance', TITLE)]
    story += section('03' if esg else '02', 'Emissions inventory boundary',
        'Unassessed categories are excluded, not zero. The assessed total covers purchased electricity only.')
    story += [table(['INVENTORY CATEGORY', 'RESULT', 'STATUS'], [
        ['Scope 1 / direct', 'Not assessed', 'Fuel and refrigerant records unavailable.'],
        ['Scope 2 / electricity estimate', fmt(carbon/1000 if carbon is not None else None,3)+' t CO2e', 'Configured-factor calculation; factor provenance unverified.'],
        ['Scope 2 / location-based disclosure', 'Not established', 'A geographically and temporally suitable grid factor has not been verified.'],
        ['Scope 2 / market-based disclosure', 'Not established', 'Supplier contracts, certificates and residual-mix data not supplied.'],
        ['Scope 3 / other indirect', 'Not assessed', 'Value-chain activity and category screening unavailable.'],
    ], [198, 100, WIDTH-298]), Spacer(1, 12),
    table(['PERFORMANCE INDICATOR', 'SELECTED-PERIOD RESULT'], [
        ['Electricity', fmt(energy)+' kWh'],
        ['Assessed electricity-linked emissions', fmt(carbon/1000 if carbon is not None else None,3)+' t CO2e'],
        ['Floor area', fmt(area)+' m2'],
        ['Selected-period energy intensity', fmt(intensity,3)+' kWh/m2'],
        ['Annualised energy intensity', fmt(annual_intensity)+' kWh/m2/year; extrapolated, not measured annual performance'],
    ], [230, WIDTH-230])]
    story += section('TREND', 'Electricity-linked carbon profile')
    story += [CarbonTrend(data['observed'], factor, asset['timezone']),
        p(f'Hourly activity for {safe(period_label)}. The source-local time zone is {safe(asset["timezone"])}. '
          'A comparable prior-year inventory is unavailable; no year-on-year reduction is asserted.', SMALL)]
    if esg:
        story += [Spacer(1, 9), p(f'<b>Calculation basis:</b> electricity x {fmt(factor,4)} kg CO2e/kWh. '
            f'Cost uses {fmt(config["tariff_myr_per_kwh"],4)} MYR/kWh. Both are configured assumptions; '
            'factor publisher, year and geography have not been verified. Selected-period intensity = kWh / floor area; '
            'annualisation repeats the source-day average over 365 days. '
            'Gases are not disaggregated; a corporate base year and consolidation approach are not established.', SMALL)]

    if not esg:
        story += [PageBreak(), p('Methodology<br/>& data quality', TITLE)]
        story += section('03', 'Methodology & calculation assumptions')
        story += [table(['INPUT / METHOD', 'DISCLOSURE'], [
            ['Calculation', f'Electricity (kWh) x {fmt(factor,4)} kg CO2e/kWh; divide by 1,000 for t CO2e.'],
            ['Emission factor provenance', 'User-configured assumption. Publisher, publication year, geography and factor category have not been verified.'],
            ['Cost assumption', f'{fmt(config["tariff_myr_per_kwh"],4)} MYR/kWh; this is not an electricity invoice.'],
            ['Gases and GWP basis', 'Aggregate CO2e input only. Separate CO2, CH4, N2O, HFCs, PFCs, SF6 and NF3 quantities and GWP sources are unavailable.'],
            ['Consolidation approach', 'A building has been selected. Equity share, financial control and operational control boundaries are not established.'],
            ['Base year and restatements', 'No verified corporate base year, recalculation policy or comparable annual inventory is supplied.'],
            ['Uncertainty and exclusions', 'Facility scaling, configured factors and limited source history create uncertainty. No numerical uncertainty interval is established.'],
        ], [145, WIDTH-145])]
        story += section('QUALITY', 'Source provenance and checks')
        story += [p(f'<b>Source:</b> Building Data Genome Project 2 v1.0 (CC BY 4.0). '
            f'Benchmark asset: {safe(asset["source_asset_id"])}. '
            + ('Facility results are illustrative estimates derived from this benchmark. ' if estimated else 'These readings are historical public benchmark observations. ')
            + 'No corporate-site identity or live meter connection is established.', SMALL), Spacer(1, 10),
            table(['QUALITY ITEM', 'CURRENT RESULT'], [
                ['Activity records in this export', f'{len(data["observed"]):,} hourly intervals; {fmt(days,0)} source day(s).'],
                ['Utility / meter reconciliation', 'Invoice reconciliation and facility meter calibration evidence not supplied.'],
                ['Factors and assumptions', str(config.get('assumption_reference','Not supplied'))],
                ['Independent assurance', 'No assurance statement, provider opinion or verification scope is supplied.'],
            ], [175, WIDTH-175])]
        story += note('Inventory treatment', 'Planned avoidance and any offsets must be disclosed separately. This report does not deduct projected savings, tree equivalents or carbon credits from the selected-period inventory.')

    if esg:
        story += [PageBreak(), p('Social, governance<br/>& evidence', TITLE)]
        story += section('04', 'Disclosure coverage register',
            'The platform currently provides energy and climate planning information. Other ESG matters require separate organisational records.')
        story += [table(['ESG MATTER', 'CURRENT COVERAGE / EVIDENCE NEEDED'], [
            ['Social / health and safety', 'Comfort alerts are illustrative; workforce injuries, safety incidents and verified indoor-condition records are not supplied.'],
            ['Social / people and community', 'Workforce composition, training, labour practices and community impacts are not assessed.'],
            ['Environment / other resources', 'Water, waste, biodiversity and materials are not assessed.'],
            ['Governance / ethics and procurement', 'Board diversity, anti-corruption, supplier screening and policy implementation are not assessed.'],
            ['Governance / data and oversight', 'Human approval exists in the local workflow. Formal reporting accountability, data protection evidence and management sign-off are not supplied.'],
        ], [170, WIDTH-170])]
        story += section('EVIDENCE', 'Review and assurance register')
        story += [table(['EVIDENCE ITEM', 'USER REVIEW', 'DOCUMENT VERIFICATION'],
            [[title, 'Marked reviewed' if key in checked else 'Not recorded', 'Supporting file not verified'] for key,title in CHECKS],
            [210, 105, WIDTH-315])]
        story += note('Review status', 'Checklist selections record user review only. An assurance checkbox does not establish independent assurance; a provider statement and scope must be verified.')

    story += [PageBreak(), p('Reduction planning', TITLE)]
    story += section('05' if esg else '04', 'Approved plan - next 24 source-local hours')
    forecast = data.get('forecast') or []
    if forecast:
        dates = [datetime.fromisoformat(r['timestamp'].replace('Z','+00:00')).astimezone(ZoneInfo(asset['timezone'])).strftime('%d %b %Y %H:%M') for r in (forecast[0],forecast[-1])]
        story += [p(f'Forecast window: {safe(dates[0])} to {safe(dates[1])} | {safe(asset["timezone"])}', SMALL), Spacer(1, 12)]
    story += [Metrics([
        ('Projected cost savings',money(m['projected_cost_difference_myr']),'MYR | approved plan'),
        ('Grid electricity avoided',fmt(m['projected_grid_avoided_kwh']),'kWh | next 24 hours'),
        ('Avoided emissions',fmt(m['projected_avoided_carbon_kg']),'kg CO2e | next 24 hours'),
    ]), Spacer(1, 12), table(['PERFORMANCE INDICATOR', 'BASELINE FORECAST', 'APPROVED PLAN'], [
        ['Building electricity / kWh',fmt(m['forecast_energy_kwh']),fmt(m['projected_energy_kwh'])],
        ['Grid import / kWh',fmt(m['forecast_energy_kwh']),fmt(m['projected_grid_kwh'])],
        ['Peak interval-average demand / kW',fmt(m['forecast_peak_interval_average_kw']),fmt(m['projected_peak_interval_average_kw'])],
    ], [220,145,WIDTH-365]), Spacer(1,8),
        p('These savings compare the same forecast with the approved local plan. They are projected, not measured savings, and do not reduce the historical inventory. Approval does not issue a physical equipment command.',SMALL)]
    story += section('PLANNING', 'Dashboard planning appendix')
    selected = next((row for row in SHARES if row[0]==planning.get('load_type')),None)
    story += [p(f'Selected load: {safe(selected[1] if selected else "All electricity loads")}',BODY),Spacer(1,6),
        table(['PLANNING INPUT', 'VALUE / BASIS'], [
            ['Reduction target',f'{fmt(target,0)}%; user-configured planning ambition, not a validated corporate commitment'],
            ['BEI comparison benchmark',f'{fmt(planning.get("bei_benchmark",180))} kWh/m2/year; planning assumption'],
            ['Tree equivalent assumption',f'{fmt(planning.get("tree_factor",21.77),2)} kg CO2e/tree/year; comparison only, not an offset'],
            ['Target year / base / owner','Not supplied; management confirmation required'],
        ],[175,WIDTH-175])]
    story += section('ALLOCATION','Assumed load allocation')
    story += [table(['LOAD TYPE','ASSUMED SHARE','ESTIMATED EMISSIONS / t CO2e'],
        [[title,f'{share}%',fmt(carbon*share/100/1000 if carbon is not None else None,3)] for _,title,share in SHARES],
        [155,110,WIDTH-265]),Spacer(1,6),p('End-use allocations are not separately metered. The whole-building inventory above is unchanged by the load filter. Annualised figures extrapolate source-day activity; no seasonality adjustment is established.',SMALL)]

    story += [PageBreak(), p('Disclosure index,<br/>sources & review', TITLE)]
    story += section('06' if esg else '05', 'Disclosure navigation',
        'This index identifies coverage and gaps. It is not a statement of full framework compliance.')
    rows = ([['Reporting entity, period and scope','1','Limited building boundary'],
        ['Governance, strategy and risk management','2','Evidence gaps disclosed'],
        ['Environmental performance / GHG scopes','3','Electricity only'],
        ['Social and governance disclosures','4','Coverage gaps recorded'],
        ['Targets, action plan and methods','3, 5','Projections separated from inventory'],
        ['Evidence, assurance and management review','4, 6','No assurance supplied']] if esg else
        [['Entity, reporting period and boundary','1, 2','Building electricity boundary'],
        ['Scope 1, 2 and 3 disclosures','2','Scope coverage and exclusions'],
        ['Factors, methods, base year and data quality','3','Assumptions and missing evidence'],
        ['Forecast reductions and planning inputs','4','Separate from inventory'],
        ['Assurance, sources and management review','3, 5','Review pending']])
    story += [table(['DISCLOSURE TOPIC','PAGE','COVERAGE'],rows,[245,43,WIDTH-288])]
    story += section('REFERENCES','Official reporting guidance')
    for issuer,title,url in SOURCES:
        story += [p(f'<b>{safe(issuer)}</b> - <link href="{safe(url)}" color="#C95C14">{safe(title)}</link>',SMALL),Spacer(1,6)]
    story += [p(f'References consulted 22 October 2026. Guidance informs the report structure; no official endorsement or regulatory filing is implied. '
        'Applicability and completeness must be assessed for the reporting organisation.',SMALL),Spacer(1,7),
        p('<b>Activity data reference:</b> <link href="https://doi.org/10.5281/zenodo.3887306" color="#C95C14">Building Data Genome Project 2 v1.0</link> - CC BY 4.0.',SMALL)]
    story += section('REVIEW','Document approval record')
    story += [table(['REVIEW RESPONSIBILITY','NAME / DATE / SIGN-OFF'],[
        ['Prepared by','NEXORA automated export; accountable preparer not assigned'],
        ['Reviewed by / approved by','Pending management review; names and approval date not supplied'],
        ['Independent assurance provider','Not supplied; this report is not independently assured'],
    ],[190,WIDTH-190])]
    doc.build(story,onFirstPage=chrome,onLaterPages=chrome)
    return output.getvalue()
