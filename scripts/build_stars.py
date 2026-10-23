"""Build Islastra's star and constellation data from the raw downloads.

Inputs (in data/raw/):
  hyg*.csv or hyg*.csv.gz      the HYG star database (astronexus.com/hyg)
  constellations.lines.json    d3-celestial constellation lines
  constellations.json          d3-celestial constellation names

Outputs (in public/data/):
  stars.json                   naked-eye stars, brightest first
  constellations.json          lines and label positions

Run from the repo root:  py scripts/build_stars.py   (or python3 on Mac/Linux)
"""

import json
import math
from pathlib import Path

import pandas as pd

ROOT = Path(__file__).resolve().parent.parent
RAW = ROOT / "data" / "raw"
OUT = ROOT / "public" / "data"
MAG_LIMIT = 6.5  # roughly the faintest stars visible to the naked eye
PC_TO_LY = 3.26156


def find_hyg() -> Path:
    files = sorted(RAW.glob("hyg*.csv")) + sorted(RAW.glob("hyg*.csv.gz"))
    if not files:
        raise SystemExit("No HYG file found in data/raw/. Download it from astronexus.com/hyg first.")
    return files[-1]


def bv_to_temp(bv: float) -> float:
    """Colour index (B-V) to surface temperature in kelvin (Ballesteros 2012)."""
    bv = max(-0.4, min(2.0, bv))
    return 4600 * (1 / (0.92 * bv + 1.7) + 1 / (0.92 * bv + 0.62))


def temp_to_hex(temp: float) -> str:
    """Approximate star colour for a temperature, softened toward white for display."""
    t = temp / 100
    if t <= 66:
        r = 255
        g = 99.4708025861 * math.log(t) - 161.1195681661
        b = 0 if t <= 19 else 138.5177312231 * math.log(t - 10) - 305.0447927307
    else:
        r = 329.698727446 * ((t - 60) ** -0.1332047592)
        g = 288.1221695283 * ((t - 60) ** -0.0755148492)
        b = 255
    rgb = [min(255, max(0, c)) for c in (r, g, b)]
    rgb = [round(c + (255 - c) * 0.35) for c in rgb]
    return "#{:02x}{:02x}{:02x}".format(*rgb)


def build_stars() -> int:
    path = find_hyg()
    print(f"reading {path.name} …")
    df = pd.read_csv(path, low_memory=False)
    need = ["ra", "dec", "mag", "ci", "dist", "absmag", "proper", "con"]
    missing = [c for c in need if c not in df.columns]
    if missing:
        raise SystemExit(f"The HYG file is missing columns: {missing}")

    df = df[df["dist"] > 0]  # drops the Sun, which has distance 0
    df = df[df["mag"] <= MAG_LIMIT].copy()

    rows = []
    for r in df.itertuples(index=False):
        ci = r.ci if pd.notna(r.ci) else 0.6
        temp = bv_to_temp(ci)
        dist_ly = None if pd.isna(r.dist) or r.dist >= 100000 else round(r.dist * PC_TO_LY, 1)
        rows.append([
            round(r.ra * 15, 3),  # right ascension, hours → degrees
            round(r.dec, 3),
            round(r.mag, 2),
            temp_to_hex(temp),
            int(round(temp, -2)),
            dist_ly,
            round(r.absmag, 2) if pd.notna(r.absmag) else None,
            r.proper if isinstance(r.proper, str) else "",
            r.con if isinstance(r.con, str) else "",
        ])
    rows.sort(key=lambda s: s[2])  # brightest first; the app relies on this

    out = {"fields": ["ra", "dec", "mag", "color", "temp", "dist", "absmag", "name", "con"], "stars": rows}
    (OUT / "stars.json").write_text(json.dumps(out, separators=(",", ":"), ensure_ascii=False), encoding="utf-8")
    return len(rows)


def ra_from_lon(lon: float) -> float:
    # d3-celestial stores right ascension as a longitude from -180 to 180
    return round(lon % 360, 2)


def build_constellations() -> int:
    lines_fc = json.loads((RAW / "constellations.lines.json").read_text(encoding="utf-8"))
    names_fc = json.loads((RAW / "constellations.json").read_text(encoding="utf-8"))
    names = {f["id"]: f for f in names_fc["features"]}

    out = []
    for f in lines_fc["features"]:
        cid = f["id"]
        geom = f["geometry"]
        coords = geom["coordinates"] if geom["type"] == "MultiLineString" else [geom["coordinates"]]
        lines = [[[ra_from_lon(lon), round(lat, 2)] for lon, lat in line] for line in coords]
        nf = names.get(cid, {})
        name = nf.get("properties", {}).get("name", cid)
        if nf.get("geometry", {}).get("type") == "Point":
            lon, lat = nf["geometry"]["coordinates"]
            label = [ra_from_lon(lon), round(lat, 2)]
        else:
            label = lines[0][0]
        out.append({"id": cid, "name": name, "label": label, "lines": lines})

    (OUT / "constellations.json").write_text(json.dumps(out, separators=(",", ":"), ensure_ascii=False), encoding="utf-8")
    return len(out)


if __name__ == "__main__":
    OUT.mkdir(parents=True, exist_ok=True)
    n_stars = build_stars()
    n_cons = build_constellations()
    for name in ("stars.json", "constellations.json"):
        size = (OUT / name).stat().st_size / 1024
        print(f"wrote public/data/{name} ({size:.0f} KB)")
    print(f"{n_stars} stars, {n_cons} constellations. done!")