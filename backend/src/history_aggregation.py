"""Source-local calendar aggregation for observed hourly BDG2 readings."""
from __future__ import annotations

from dataclasses import dataclass
from datetime import date, datetime, time, timedelta, timezone
from typing import Literal
from zoneinfo import ZoneInfo


Granularity = Literal["daily", "monthly"]


@dataclass(frozen=True)
class CalendarPeriod:
    key: str
    start_local: datetime
    end_local: datetime

    @property
    def start_utc(self) -> datetime:
        return self.start_local.astimezone(timezone.utc)

    @property
    def end_utc(self) -> datetime:
        return self.end_local.astimezone(timezone.utc)

    @property
    def expected_interval_count(self) -> int:
        return int((self.end_utc - self.start_utc).total_seconds() // 3600)


def _shift_month(year: int, month: int, delta: int) -> tuple[int, int]:
    index = year * 12 + month - 1 + delta
    return divmod(index, 12)[0], divmod(index, 12)[1] + 1


def calendar_periods(
    latest_timestamp: str | datetime,
    source_timezone: str,
    granularity: Granularity,
    count: int,
) -> list[CalendarPeriod]:
    if granularity not in {"daily", "monthly"}:
        raise ValueError("granularity must be daily or monthly")
    maximum = 31 if granularity == "daily" else 12
    if count < 1 or count > maximum:
        raise ValueError(f"{granularity} periods must be between 1 and {maximum}")
    zone = ZoneInfo(source_timezone)
    latest = latest_timestamp if isinstance(latest_timestamp, datetime) else datetime.fromisoformat(latest_timestamp.replace("Z", "+00:00"))
    if latest.tzinfo is None:
        raise ValueError("latest timestamp must include a timezone")
    latest_local = latest.astimezone(zone)
    periods: list[CalendarPeriod] = []
    if granularity == "daily":
        end_date = latest_local.date() + timedelta(days=1)
        start_date = end_date - timedelta(days=count)
        for offset in range(count):
            day = start_date + timedelta(days=offset)
            next_day = day + timedelta(days=1)
            periods.append(CalendarPeriod(
                key=day.isoformat(),
                start_local=datetime.combine(day, time.min, zone),
                end_local=datetime.combine(next_day, time.min, zone),
            ))
        return periods

    end_year, end_month = _shift_month(latest_local.year, latest_local.month, 1)
    start_year, start_month = _shift_month(end_year, end_month, -count)
    for offset in range(count):
        year, month = _shift_month(start_year, start_month, offset)
        next_year, next_month = _shift_month(year, month, 1)
        periods.append(CalendarPeriod(
            key=f"{year:04d}-{month:02d}",
            start_local=datetime(year, month, 1, tzinfo=zone),
            end_local=datetime(next_year, next_month, 1, tzinfo=zone),
        ))
    return periods


def calendar_query_windows(periods: list[CalendarPeriod]) -> list[tuple[datetime, datetime]]:
    """Return calendar-month windows, each within the existing 31-day read bound."""
    if not periods:
        return []
    start = periods[0].start_local
    finish = periods[-1].end_local
    windows: list[tuple[datetime, datetime]] = []
    cursor = start
    while cursor < finish:
        next_year, next_month = _shift_month(cursor.year, cursor.month, 1)
        month_end = datetime(next_year, next_month, 1, tzinfo=cursor.tzinfo)
        end = min(month_end, finish)
        windows.append((cursor.astimezone(timezone.utc), end.astimezone(timezone.utc)))
        cursor = end
    return windows


def aggregate_observed(readings: list[dict], periods: list[CalendarPeriod]) -> list[dict]:
    seen: set[datetime] = set()
    parsed: list[tuple[datetime, float]] = []
    for row in readings:
        if row.get("label") != "observed" or row.get("interval_minutes") != 60:
            raise ValueError("history aggregation requires observed 60-minute interval readings")
        stamp = datetime.fromisoformat(str(row["timestamp"]).replace("Z", "+00:00"))
        if stamp.tzinfo is None:
            raise ValueError("reading timestamp must include a timezone")
        stamp = stamp.astimezone(timezone.utc)
        if stamp in seen:
            raise ValueError("duplicate reading timestamp")
        seen.add(stamp)
        value = float(row["consumption_kwh"])
        if value < 0:
            raise ValueError("reading value must be non-negative")
        parsed.append((stamp, value))

    items: list[dict] = []
    for period in periods:
        values = [value for stamp, value in parsed if period.start_utc <= stamp < period.end_utc]
        expected = period.expected_interval_count
        observed = len(values)
        complete = observed == expected
        observed_sum = sum(values) if values else None
        items.append({
            "period": period.key,
            "period_start_local": period.start_local.isoformat(),
            "period_end_local_exclusive": period.end_local.isoformat(),
            "observed_sum_kwh": observed_sum,
            "complete_total_kwh": observed_sum if complete else None,
            "observed_interval_count": observed,
            "expected_interval_count": expected,
            "missing_interval_count": max(expected - observed, 0),
            "coverage_percent": observed / expected * 100 if expected else 0,
            "complete": complete,
            "label": "observed",
            "unit": "kWh",
        })
    return items
