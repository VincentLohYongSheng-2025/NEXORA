"""Bounded, hourly sharing of simulated surplus; never a physical dispatch."""
from datetime import datetime
from zoneinfo import ZoneInfo

COUNTS = {"mall": 3, "hospital": 5, "restaurant": 1, "commercial": 11, "residential": 7, "solar": 0}
PEAK_HOURS = (14, 15, 16)
LOSS = .03


def energy_network(states, approved=()):
    """Reserve on-site demand/storage first, then share only residual curtailment.

    Floor weights and the premium window are explicit demonstration assumptions.
    All proposals reserve from one shared hourly ledger, avoiding duplicate offers.
    """
    buildings, sources = [], []
    for s in states:
        a, rows = s["asset"], s["dispatch"]["items"]
        onsite_enabled = a["facility_id"] == "solar" or any(action["id"] == "solar" and action["status"] == "approved" for action in s.get("actions", []))
        selected = [r for r in rows if datetime.fromisoformat(r["timestamp"].replace("Z", "+00:00")).astimezone(ZoneInfo(a["timezone"])).hour in PEAK_HOURS]
        count = COUNTS[a["facility_id"]]
        # Demand allocation is illustrative, not sub-metered floor consumption.
        weights = [2.0 if a["facility_id"] == "commercial" and i == 4 else
                   1.8 if a["facility_id"] == "hospital" and i == 2 else 1 + .04 * i for i in range(count)]
        total = sum(weights) or 1
        factor = s["metrics"]["projected_energy_kwh"] / max(s["metrics"]["forecast_energy_kwh"], 1e-9)
        floors = [{"id": f"level_{i}" if i else "ground", "label": f"Level {i}" if i else "Ground",
                   "demand": {}, "onsite": {}, "shared": {}} for i in range(count)]
        for row in selected:
            stamp = row["timestamp"]
            for i, floor in enumerate(floors):
                floor["demand"][stamp] = row["baseline_kwh"] * factor * weights[i] / total
                floor["shared"][stamp] = 0.
            onsite = min(row["direct_solar_kwh"] + row["discharge_kwh"], sum(f["demand"][stamp] for f in floors)) if onsite_enabled else 0.
            # Cover smaller loads locally; reserve shared solar for highest unmet loads.
            for floor in sorted(floors, key=lambda f: f["demand"][stamp]):
                amount = min(onsite, floor["demand"][stamp])
                floor["onsite"][stamp] = amount
                onsite -= amount
        surplus = {r["timestamp"]: max(0., r["curtailed_kwh"]) if onsite_enabled else 0. for r in selected}
        building = {"facility_id": a["facility_id"], "asset_id": a["id"], "name": a["name"],
                    "floors": floors, "surplus": surplus, "config": s["config"], "generation": sum(r.get("solar_kwh", r["direct_solar_kwh"] + r["curtailed_kwh"]) for r in selected)}
        buildings.append(building)
        if sum(surplus.values()) > 1e-6:
            sources.append(building)

    ledger = {b["facility_id"]: dict(b["surplus"]) for b in sources}
    # Approved plans retain priority when new proposals are calculated.
    receivers = [b for b in buildings if b["facility_id"] in ("commercial", "hospital")]
    receivers.sort(key=lambda b: (f"share-{b['facility_id']}" not in approved, b["facility_id"] != "commercial"))
    proposals, links = [], []
    for target in receivers:
        def need(f):
            return sum(max(0, v - f["onsite"][t]) for t, v in f["demand"].items())
        floor = max(target["floors"], key=need)
        allocations = []
        for stamp, demand in floor["demand"].items():
            deficit = max(0., demand - floor["onsite"][stamp])
            # Reuse rooftop surplus before drawing on the common solar park.
            for source in sorted(sources, key=lambda b: (b["facility_id"] == "solar", -ledger[b["facility_id"]].get(stamp, 0))):
                if source is target or deficit <= 1e-9:
                    continue
                sent = min(ledger[source["facility_id"]].get(stamp, 0), deficit / (1 - LOSS))
                if sent <= 1e-9:
                    continue
                delivered = sent * (1 - LOSS)
                allocations.append({"timestamp": stamp, "source": source["facility_id"], "source_name": source["name"],
                                    "sent_kwh": sent, "delivered_kwh": delivered, "loss_kwh": sent - delivered})
                ledger[source["facility_id"]][stamp] -= sent
                deficit -= delivered
        if not allocations:
            continue
        ident = f"share-{target['facility_id']}"
        applied = ident in approved
        delivered = sum(r["delivered_kwh"] for r in allocations)
        rate = target["config"]["tariff_myr_per_kwh"]
        carbon = target["config"]["carbon_kg_per_kwh"]
        if applied:
            for row in allocations:
                floor["shared"][row["timestamp"]] += row["delivered_kwh"]
        proposal = {"id": ident, "status": "approved" if applied else "proposed", "target": target["facility_id"],
                    "target_name": target["name"], "floor": floor["id"], "floor_label": floor["label"],
                    "title": f"Use neighbouring solar for {target['name']} · {floor['label']}",
                    "sources": list(dict.fromkeys(r["source_name"] for r in allocations)),
                    "source_ids": list(dict.fromkeys(r["source"] for r in allocations)),
                    "delivered_kwh": delivered, "sent_kwh": sum(r["sent_kwh"] for r in allocations),
                    "cost_myr": None if rate is None else delivered * rate,
                    "assumed_peak_rate": None if rate is None else rate,
                    "carbon_kg": None if carbon is None else delivered * carbon,
                    "allocations": allocations}
        proposals.append(proposal)
        for source in proposal["source_ids"]:
            links.append({"source": source, "target": target["facility_id"], "status": proposal["status"],
                          "kwh": sum(r["delivered_kwh"] for r in allocations if r["source"] == source)})

    summaries = []
    for b in buildings:
        floors = []
        for f in b["floors"]:
            demand, onsite, shared = sum(f["demand"].values()), sum(f["onsite"].values()), sum(f["shared"].values())
            grid = max(0., demand - onsite - shared)
            mode = "solar" if grid < 1e-6 and demand > 0 else "hybrid" if onsite + shared > 1e-6 else "grid"
            floors.append({"id": f["id"], "label": f["label"], "demand_kwh": demand, "onsite_solar_kwh": onsite,
                           "shared_solar_kwh": shared, "grid_kwh": grid, "mode": mode})
        modes = {f["mode"] for f in floors}
        mode = ("solar" if b["generation"] > 1e-6 else "grid") if not floors else "solar" if modes == {"solar"} else "grid" if modes == {"grid"} else "hybrid"
        summaries.append({"facility_id": b["facility_id"], "name": b["name"], "mode": mode, "floors": floors,
                          "surplus_kwh": sum(b["surplus"].values()),
                          "shared_out_kwh": sum(r["sent_kwh"] for p in proposals if p["status"] == "approved" for r in p["allocations"] if r["source"] == b["facility_id"])})
    return {"buildings": summaries, "recommendations": proposals, "links": links,
            "window": "14:00–17:00", "loss_percent": LOSS * 100,
            "label": "Illustrative next-day energy-sharing plan",
            "assumptions": "Malaysia local planning hours. Savings use the same configured flat energy rate as the dashboard; no invented peak surcharge or maximum-demand fee is applied. 3% transfer loss. Solar Park is the modelled existing resource; building PV/storage enters the supply plan only after its solar action is approved. Floor demand uses illustrative weights. Shared electrical infrastructure, permissions and metering are assumed; no physical transfer is made.",
            "approved_grid_avoided_kwh": sum(p["delivered_kwh"] for p in proposals if p["status"] == "approved")}
