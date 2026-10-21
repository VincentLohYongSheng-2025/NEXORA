"""NEXORA carbon report: selected-period evidence and separately dated projections."""
from __future__ import annotations

from datetime import datetime, timezone
from io import BytesIO
from xml.sax.saxutils import escape
from zoneinfo import ZoneInfo

from reportlab.lib import colors
from reportlab.lib.enums import TA_RIGHT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle
from reportlab.platypus import (
    Flowable, PageBreak, Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle,
)

NAVY = colors.HexColor('#663519')
TEAL = colors.HexColor('#DC6716')
BLUE = colors.HexColor('#C95C14')
MUTED = colors.HexColor('#897464')
PALE = colors.HexColor('#FFF5EB')
LINE = colors.HexColor('#EFDFD0')
WIDTH = A4[0] - 84


def fmt(value, digits=1):
    return 'Not available' if value is None else f'{value:,.{digits}f}'


BODY = ParagraphStyle('body', fontName='Helvetica', fontSize=9, leading=13, textColor=NAVY)
SMALL = ParagraphStyle('small', parent=BODY, fontSize=8, leading=11, textColor=MUTED)
TITLE = ParagraphStyle('title', parent=BODY, fontName='Helvetica-Bold', fontSize=26, leading=30)
H2 = ParagraphStyle('h2', parent=BODY, fontName='Helvetica-Bold', fontSize=12, leading=16, spaceBefore=14, spaceAfter=8)
RIGHT = ParagraphStyle('right', parent=BODY, alignment=TA_RIGHT)


def p(text, style=BODY):
    return Paragraph(text, style)


def safe(text):
    return escape(str(text))


def table(headers, rows, widths):
    content = [[p(safe(v), ParagraphStyle('th', parent=SMALL, textColor=colors.white, fontName='Helvetica-Bold')) for v in headers]]
    content += [[p(safe(v), SMALL if len(str(v)) > 65 else BODY) for v in row] for row in rows]
    result = Table(content, colWidths=widths, repeatRows=1, hAlign='LEFT')
    result.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), NAVY),
        ('ROWBACKGROUNDS', (0, 1), (-1, -1), [PALE, colors.white]),
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('LEFTPADDING', (0, 0), (-1, -1), 10), ('RIGHTPADDING', (0, 0), (-1, -1), 10),
        ('TOPPADDING', (0, 0), (-1, -1), 9), ('BOTTOMPADDING', (0, 0), (-1, -1), 9),
        ('LINEBELOW', (0, -1), (-1, -1), .5, LINE),
    ]))
    return result


class Metrics(Flowable):
    def __init__(self, items):
        super().__init__()
        self.items, self.width, self.height = items, WIDTH, 81

    def draw(self):
        c = self.canv
        w = (WIDTH - 20) / 3
        for i, (label, value, foot) in enumerate(self.items):
            x = i * (w + 10)
            c.setFillColor(PALE); c.roundRect(x, 0, w, 81, 7, fill=1, stroke=0)
            c.setFillColor(TEAL); c.rect(x + 12, 62, 20, 3, fill=1, stroke=0)
            for text, font, size, y, color in [
                (label, 'Helvetica', 8, 49, MUTED),
                (value, 'Helvetica-Bold', 17, 27, NAVY),
                (foot, 'Helvetica', 7.5, 12, MUTED),
            ]:
                c.setFillColor(color); c.setFont(font, size); c.drawString(x + 12, y, text)


class CarbonTrend(Flowable):
    def __init__(self, rows, factor, zone):
        super().__init__()
        self.rows, self.factor, self.zone = rows, factor, zone
        self.width, self.height = WIDTH, 115

    def draw(self):
        c = self.canv
        if self.factor is None or not self.rows:
            c.setFillColor(MUTED); c.setFont('Helvetica', 9)
            c.drawString(0, 60, 'Carbon trend unavailable until an emission factor is configured.')
            return
        values = [r['consumption_kwh'] * self.factor for r in self.rows]
        left, bottom, width, height = 43, 22, WIDTH - 48, 76
        top = max(max(values, default=0) * 1.1, 1)
        c.setFont('Helvetica', 7)
        for i in range(4):
            y = bottom + height * i / 3
            c.setStrokeColor(LINE); c.setLineWidth(.5); c.line(left, y, left + width, y)
            c.setFillColor(MUTED); c.drawRightString(left - 7, y - 2, fmt(top * i / 3))
        points = [(left + i * width / max(len(values) - 1, 1), bottom + v / top * height) for i, v in enumerate(values)]
        area = c.beginPath(); area.moveTo(left, bottom)
        for x, y in points: area.lineTo(x, y)
        area.lineTo(points[-1][0], bottom); area.close()
        c.setFillColor(colors.HexColor('#FFF0E2')); c.drawPath(area, fill=1, stroke=0)
        path = c.beginPath(); path.moveTo(*points[0])
        for point in points[1:]: path.lineTo(*point)
        c.setStrokeColor(TEAL); c.setLineWidth(1.8); c.drawPath(path)
        c.setFillColor(MUTED); c.setFont('Helvetica', 7)
        c.drawString(0, 104, 'kg CO2e / hourly interval')
        for idx in sorted(set([0, len(values) // 2, len(values) - 1])):
            label = self.rows[idx]['source_local_timestamp'].replace('T', ' ')[5:16]
            x = points[idx][0]
            if idx == len(values) - 1: c.drawRightString(x, 6, label)
            else: c.drawString(x, 6, label)


def build_carbon_report(data: dict) -> bytes:
    asset, m, config = data['asset'], data['metrics'], data['config']
    generated = datetime.now(timezone.utc)
    name = asset.get('name') or asset['source_asset_id'].replace('Hog_', '').replace('_', ' ')
    estimated = bool(asset.get('facility_id'))
    start, end = data['observed_window']['from'], data['observed_window']['to']
    factor = config['carbon_kg_per_kwh']
    co2 = m['observed_carbon_estimate_kg']
    area = asset.get('floor_area_m2')
    bei = m['observed_energy_kwh'] / area if area else None
    open_alerts = [a for a in data.get('alerts', []) if a['status'] == 'proposed']
    settled = [a for a in data.get('alerts', []) if a['status'] == 'settled']
    forecast_dates = [datetime.fromisoformat(row['timestamp'].replace('Z', '+00:00')).astimezone(ZoneInfo(asset['timezone'])).strftime('%d %b %Y %H:%M') for row in (data['forecast'][0], data['forecast'][-1])]
    reference = f"NX-CARBON-{asset['id'][:8].upper()}-{data['period'].upper()}-{generated:%Y%m%d}"
    output = BytesIO()

    def chrome(c, doc):
        c.saveState()
        c.setFillColor(NAVY); c.setFont('Helvetica-Bold', 16); c.drawString(42, 803, 'NEXORA')
        c.setFillColor(TEAL); c.setFont('Helvetica', 7); c.drawString(42, 791, 'BUILDING INTELLIGENCE / CARBON & ESG')
        c.setFillColor(MUTED); c.setFont('Helvetica', 7); c.drawRightString(A4[0] - 42, 805, reference)
        c.drawRightString(A4[0] - 42, 793, f'Generated {generated:%d %b %Y, %H:%M} UTC')
        c.setStrokeColor(TEAL); c.setLineWidth(2); c.line(42, 779, A4[0] - 42, 779)
        c.setStrokeColor(LINE); c.setLineWidth(.5); c.line(42, 42, A4[0] - 42, 42)
        c.setFillColor(MUTED); c.setFont('Helvetica', 7)
        c.drawString(42, 29, 'NEXORA | Carbon & energy reporting')
        c.drawRightString(A4[0] - 42, 29, f'{name[:42]}  /  {doc.page}')
        c.restoreState()

    doc = SimpleDocTemplate(output, pagesize=A4, rightMargin=42, leftMargin=42,
                            topMargin=80, bottomMargin=57, pageCompression=0,
                            title=f'NEXORA Carbon & ESG Report - {name}', author='NEXORA',
                            subject='Electricity-related carbon estimates and projected reduction plan')
    story = [p('Carbon & ESG<br/>Performance report', TITLE), Spacer(1, 11),
             p(f'<b>{safe(name)}</b> | {safe(asset.get("asset_type", "Whole-building electricity"))}'),
             p(f'{safe(start.replace("T", " "))} to {safe(end.replace("T", " "))} | {safe(asset["timezone"])}', SMALL),
             Spacer(1, 13), Metrics([
                 ('Electricity-linked emissions', fmt(co2 / 1000 if co2 is not None else None, 3), 't CO2e | selected period'),
                 ('Electricity consumption', fmt(m['observed_energy_kwh']), 'kWh | selected period'),
                 ('Estimated electricity cost', 'RM ' + fmt(m['observed_cost_estimate_myr'], 2) if m['observed_cost_estimate_myr'] is not None else 'Not available', 'MYR | configured tariff'),
             ]), p('01 / Executive summary', H2),
             p(f'{safe(name)} has {fmt(m["observed_energy_kwh"])} kWh of '
               f'{"estimated" if estimated else "historical benchmark"} electricity use for this period. '
               f'The configured emission factor produces {fmt(co2)} kg CO<sub>2</sub>e. '
               f'{len(open_alerts)} alert(s) await review and {len(settled)} have been settled in the local plan.'),
             p('Electricity-linked carbon trend', H2), CarbonTrend(data['observed'], factor, asset['timezone']),
             p('02 / Emissions inventory boundary', H2),
             table(['Category', 't CO2e', 'Coverage'], [
                 ['Scope 1 / direct', 'Not assessed', 'Fuel combustion and refrigerant data are unavailable.'],
                 ['Scope 2 / purchased electricity', fmt(co2 / 1000 if co2 is not None else None, 3), 'Electricity x configured factor; estimate.'],
                 ['Scope 3 / other indirect', 'Not assessed', 'Value-chain activity data are unavailable.'],
             ], [167, 90, WIDTH - 257]),
             Spacer(1, 8), p('The total above covers electricity only. Unassessed categories are excluded, not zero. '
                 'This is a building performance report, not a verified corporate GHG inventory.', SMALL),
             PageBreak(), p('Reduction plan & evidence', TITLE),
             p(f'{safe(name)} | Decisions, assumptions and reporting coverage', SMALL),
             p('03 / Approved plan - next 24 source-local hours', H2),
             p(f'Forecast window: {safe(forecast_dates[0])} to '
               f'{safe(forecast_dates[1])} ({safe(asset["timezone"])}).', SMALL),
             Spacer(1, 10), Metrics([
                 ('Projected cost savings', 'RM ' + fmt(m['projected_cost_difference_myr'], 2) if m['projected_cost_difference_myr'] is not None else 'Not available', 'MYR | approved plan'),
                 ('Grid electricity avoided', fmt(m['projected_grid_avoided_kwh']), 'kWh | approved plan'),
                 ('Avoided carbon emissions', fmt(m['projected_avoided_carbon_kg']), 'kg CO2e | approved plan'),
             ]), Spacer(1, 10),
             table(['Performance indicator', 'Baseline forecast', 'Approved plan'], [
                 ['Building electricity / kWh', fmt(m['forecast_energy_kwh']), fmt(m['projected_energy_kwh'])],
                 ['Grid import / kWh', fmt(m['forecast_energy_kwh']), fmt(m['projected_grid_kwh'])],
                 ['Peak interval-average demand / kW', fmt(m['forecast_peak_interval_average_kw']), fmt(m['projected_peak_interval_average_kw'])],
             ], [235, 138, WIDTH - 373]),
             Spacer(1, 7), p('Savings compare the same next-24-hour forecast and approved simulation. They are projections, '
                 'separate from the historical period above; approval does not establish a measured saving.', SMALL),
             p('04 / Energy intensity & end-use coverage', H2),
             table(['Indicator', 'Selected-period result'], [
                 ['Building Energy Index (BEI)', f'{fmt(bei, 3)} kWh/m2; selected period only' if bei is not None else 'Not available: floor area is missing'],
                 ['End-use emissions / HVAC, lighting, plugs, lifts, EV', 'Not separately metered; electricity total remains unallocated.'],
                 ['Year-on-year performance', 'Not assessed: a comparable measured annual baseline is unavailable.'],
             ], [235, WIDTH - 235]),
             p('05 / Methodology & calculation assumptions', H2),
             p(f'<b>Electricity emissions:</b> kWh x {fmt(factor, 4)} kg CO<sub>2</sub>e/kWh. '
               f'<b>Cost:</b> kWh x {fmt(config["tariff_myr_per_kwh"], 4)} MYR/kWh. '
               'Tonnes = kilograms / 1,000. BEI = selected-period kWh / floor area; it is not annualised. '
               'No certified offset is calculated. Optional planning comparisons are recorded separately in the dashboard appendix.'),
             Spacer(1, 6), p(f'<b>Assumption reference:</b> {safe(config["assumption_reference"])}', SMALL),
             Spacer(1, 6), p('<b>Source:</b> Building Data Genome Project 2 v1.0, CC BY 4.0. '
               'doi.org/10.5281/zenodo.3887306. '
               f'Benchmark asset: {safe(asset["source_asset_id"])}. '
               + ('Facility results are scaled illustrative estimates derived from this historical benchmark. ' if estimated else 'Source readings are historical public benchmark observations. ')
               + 'Floor alerts are illustrative. No corporate-site identity, physical control or verified saving is claimed.', SMALL),
    ]
    planning = data.get('dashboard_planning')
    if planning:
        shares = [('hvac', 'HVAC', 48), ('lighting', 'Lighting', 21),
                  ('plugs', 'Plug loads', 14), ('lifts', 'Lifts', 9), ('ev', 'EV charging', 8)]
        selected = next((row for row in shares if row[0] == planning['load_type']), None)
        share = selected[2] / 100 if selected else 1
        source_days = max(1, len(data['observed']) / 24)
        annualised = m['observed_energy_kwh'] / source_days * 365 / asset['floor_area_m2'] * share if asset.get('floor_area_m2') else None
        avoided = m['projected_avoided_carbon_kg']
        trees = avoided * share / planning['tree_factor'] if avoided is not None else None
        story += [PageBreak(), p('Dashboard planning appendix', TITLE),
                  p('Whole-building inventory is retained on the preceding pages. This appendix records the dashboard filter and its planning assumptions.', SMALL),
                  p(f'Selected load: {safe(selected[1] if selected else "All electricity loads")}', H2),
                  Metrics([
                      ('Selected emissions', fmt(co2 * share / 1000 if co2 is not None else None, 3), 't CO2e | selected period'),
                      ('Annualised energy intensity', fmt(annualised), 'kWh/m2/year | extrapolated'),
                      ('Trees equivalent', fmt(trees), 'annual sequestration comparison'),
                  ]), p('Assumed load allocation', H2),
                  table(['Load type', 'Assumed share', 'Selected-period t CO2e'],
                        [[name, f'{percent}%', fmt(co2 * percent / 100 / 1000 if co2 is not None else None, 3)]
                         for _, name, percent in shares], [200, 110, WIDTH - 310]),
                  Spacer(1, 9), p('End-use values are planning allocations of the electricity total, not separately metered readings. The shares sum to 100%.', SMALL),
                  p('Targets and reporting evidence', H2),
                  table(['Planning input', 'Value'], [
                      ['CO2 reduction target', f'{fmt(planning["target_percent"])}%'],
                      ['Annual BEI comparison benchmark', f'{fmt(planning["bei_benchmark"])} kWh/m2/year'],
                      ['Tree comparison assumption', f'{fmt(planning["tree_factor"], 2)} kg CO2e/tree/year'],
                      ['Evidence items reviewed by user', f'{planning["evidence_count"]} of 6'],
                  ], [250, WIDTH - 250]),
                  Spacer(1, 10), p('Annualised BEI extrapolates the selected source-day energy over 365 days. It is not measured annual performance. The dashboard trend repeats the source-day pattern into future planning periods without a seasonal or weather model. No confidence interval is claimed.', SMALL),
                  Spacer(1, 7), p('Trees equivalent divides next-24-hour projected avoided emissions by the configured annual tree comparison. It is not a certified offset or a tree-planting claim. Evidence checklist completion records user review only; it does not establish certification, assurance or regulatory compliance.', SMALL)]
    doc.build(story, onFirstPage=chrome, onLaterPages=chrome)
    return output.getvalue()
