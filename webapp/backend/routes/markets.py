from __future__ import annotations

from typing import Any

import pandas as pd
from fastapi import APIRouter, HTTPException, Query

router = APIRouter(prefix="/api/markets", tags=["markets"])


def _fetch_ohlc(ticker: str, period: str) -> pd.DataFrame:
    import yfinance as yf

    df = yf.Ticker(ticker).history(period=period, auto_adjust=False)
    return df


@router.get("/{ticker}")
def market(ticker: str, range_: str = Query(default="6mo", alias="range")) -> dict[str, Any]:
    ticker = ticker.strip().upper()
    if not ticker:
        raise HTTPException(status_code=400, detail="empty ticker")

    df = _fetch_ohlc(ticker, range_)
    if df.empty:
        return {"ticker": ticker, "bars": []}

    bars = [
        {
            "t": idx.strftime("%Y-%m-%d"),
            "o": float(row["Open"]),
            "h": float(row["High"]),
            "l": float(row["Low"]),
            "c": float(row["Close"]),
            "v": float(row["Volume"]),
        }
        for idx, row in df.iterrows()
    ]
    return {"ticker": ticker, "bars": bars}
