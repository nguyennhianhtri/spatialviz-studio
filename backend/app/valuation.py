"""
HDB Resale Flat Prices integration — pulls real transaction data from data.gov.sg
and provides valuation estimates based on flat type and floor area.
"""

import csv
import io
import logging
from datetime import datetime
from functools import lru_cache

import httpx

from app.config import settings

logger = logging.getLogger(__name__)

DATASET_ID = "d_8b84c4ee58e3cfc0ece0d773c8ca6abc"
POLL_URL = f"https://api-open.data.gov.sg/v1/public/api/datasets/{DATASET_ID}/poll-download"

# Map our room types to HDB flat types
AREA_TO_FLAT_TYPE = [
    (50, "2 ROOM"),
    (70, "3 ROOM"),
    (95, "4 ROOM"),
    (115, "5 ROOM"),
    (999, "EXECUTIVE"),
]


def _guess_flat_type(area_sqm: float) -> str:
    for threshold, flat_type in AREA_TO_FLAT_TYPE:
        if area_sqm <= threshold:
            return flat_type
    return "EXECUTIVE"


@lru_cache(maxsize=1)
def _fetch_recent_data() -> list[dict]:
    """Fetch and cache the latest resale transaction data (last 12 months only)."""
    try:
        logger.info("Fetching resale data from data.gov.sg...")
        headers = {}
        if hasattr(settings, 'DATAGOVSG_API_KEY') and settings.DATAGOVSG_API_KEY:
            headers["Authorization"] = settings.DATAGOVSG_API_KEY

        resp = httpx.get(POLL_URL, timeout=30, headers=headers)
        resp.raise_for_status()
        download_url = resp.json()["data"]["url"]

        # Don't send auth headers to S3 — it's a pre-signed URL
        data_resp = httpx.get(download_url, timeout=60)
        data_resp.raise_for_status()

        reader = csv.DictReader(io.StringIO(data_resp.text))
        rows = list(reader)

        # Filter to last 12 months only for relevance
        cutoff = datetime(datetime.now().year - 1, datetime.now().month, 1)
        recent = []
        for row in rows:
            try:
                month = datetime.strptime(row["month"], "%Y-%m")
                if month >= cutoff:
                    recent.append(row)
            except (ValueError, KeyError):
                continue

        logger.info(f"Loaded {len(recent)} recent transactions (of {len(rows)} total)")
        return recent
    except Exception as e:
        logger.error(f"Failed to fetch resale data: {e}")
        return []


def get_valuation(total_area_sqm: float, town: str = "ALL") -> dict:
    """
    Get valuation estimate based on flat type inferred from area.
    Returns median, min, max prices and transaction count.
    """
    flat_type = _guess_flat_type(total_area_sqm)
    data = _fetch_recent_data()

    if not data:
        return {
            "flat_type": flat_type,
            "estimated_value_sgd": 0,
            "price_per_sqm": 0,
            "min_price": 0,
            "max_price": 0,
            "transaction_count": 0,
            "period": "No data available",
            "town": town,
            "data_source": "data.gov.sg",
        }

    # Filter by flat type and optionally town
    filtered = [
        r for r in data
        if r.get("flat_type", "").upper() == flat_type
    ]

    if town != "ALL":
        town_filtered = [r for r in filtered if r.get("town", "").upper() == town.upper()]
        if town_filtered:
            filtered = town_filtered

    if not filtered:
        return {
            "flat_type": flat_type,
            "estimated_value_sgd": 0,
            "price_per_sqm": 0,
            "min_price": 0,
            "max_price": 0,
            "transaction_count": 0,
            "period": "No matching transactions",
            "town": town,
            "data_source": "data.gov.sg",
        }

    prices = []
    areas = []
    for r in filtered:
        try:
            prices.append(float(r["resale_price"]))
            areas.append(float(r["floor_area_sqm"]))
        except (ValueError, KeyError):
            continue

    if not prices:
        return {
            "flat_type": flat_type,
            "estimated_value_sgd": 0,
            "price_per_sqm": 0,
            "min_price": 0,
            "max_price": 0,
            "transaction_count": 0,
            "period": "Parse error",
            "town": town,
            "data_source": "data.gov.sg",
        }

    prices.sort()
    median_price = prices[len(prices) // 2]
    avg_area = sum(areas) / len(areas)
    price_per_sqm = median_price / avg_area if avg_area > 0 else 0

    # Estimate for the specific area
    estimated = price_per_sqm * total_area_sqm

    months = sorted(set(r["month"] for r in filtered))
    period = f"{months[0]} to {months[-1]}" if months else "unknown"

    return {
        "flat_type": flat_type,
        "estimated_value_sgd": round(estimated),
        "price_per_sqm": round(price_per_sqm),
        "median_price": round(median_price),
        "min_price": round(min(prices)),
        "max_price": round(max(prices)),
        "transaction_count": len(prices),
        "period": period,
        "town": town if town != "ALL" else "Singapore-wide",
        "data_source": "data.gov.sg (HDB Resale Flat Prices)",
    }
