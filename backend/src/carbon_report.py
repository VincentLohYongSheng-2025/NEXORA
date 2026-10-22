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
    Flowable, PageBreak, Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle, KeepTogether,
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
TITLE = ParagraphStyle('title', parent=BODY, fontName='Helvetica-Bold', fontSize=29, leading=34)
H2 = ParagraphStyle('h2', parent=BODY, fontName='Helvetica-Bold', fontSize=12, leading=16, spaceBefore=10, spaceAfter=6, keepWithNext=True)
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
        ('TOPPADDING', (0, 0), (-1, -1), 5.5), ('BOTTOMPADDING', (0, 0), (-1, -1), 5.5),
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


def build_carbon_report(data: dict, report_type: str = 'carbon') -> bytes:
    from .report_documents import build_report
    return build_report(data, report_type)
