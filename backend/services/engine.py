"""
Python visibility and scoring engine (1:1 parity with TS lib/engine.ts).
"""

import json
import math
import struct
from pathlib import Path
from typing import Dict, List, Tuple, Any

LUNAR_RADIUS_KM = 1737.4


def interpolate_horizon(horizon: List[float], azimuth: float) -> float:
    """Circular linear interpolation of horizon angle at azimuth."""
    az = (azimuth % 360.0 + 360.0) % 360.0
    i0 = int(math.floor(az))
    i1 = (i0 + 1) % 360
    t = az - i0
    return horizon[i0] * (1.0 - t) + horizon[i1] * t


def compute_visibility(ephemeris: List[dict], horizon: List[float], limb_mode: str = "upper") -> Tuple[List[int], List[int], List[int]]:
    """Compute sun, earth, and combined visibility series."""
    n = len(ephemeris)
    sun = [0] * n
    earth = [0] * n
    both = [0] * n

    for i, eph in enumerate(ephemeris):
        sun_r = eph["sun_radius"] if limb_mode == "upper" else 0.0
        earth_r = eph["earth_radius"] if limb_mode == "upper" else 0.0

        h_sun = interpolate_horizon(horizon, eph["sun_az"])
        h_earth = interpolate_horizon(horizon, eph["earth_az"])

        s_vis = 1 if (eph["sun_el"] + sun_r > h_sun) else 0
        e_vis = 1 if (eph["earth_el"] + earth_r > h_earth) else 0

        sun[i] = s_vis
        earth[i] = e_vis
        both[i] = 1 if (s_vis and e_vis) else 0

    return sun, earth, both


def rle_encode(arr: List[int]) -> dict:
    """Run-length encode a binary series."""
    segments = []
    if not arr:
        return {"segments": [], "total_points": 0}

    start = 0
    current = arr[0]

    for i in range(1, len(arr) + 1):
        val = arr[i] if i < len(arr) else (1 - current)
        if val != current:
            segments.append({"start": start, "end": i - 1, "visible": bool(current == 1)})
            start = i
            current = val

    return {"segments": segments, "total_points": len(arr)}


def compute_metrics(sun: List[int], earth: List[int], both: List[int], step_hours: float) -> dict:
    """Compute lighting & communication metrics."""
    n = len(sun)
    sunlit_count = 0
    max_sunlight = 0.0
    current_sunlight = 0.0
    max_darkness = 0.0
    current_darkness = 0.0

    earth_visible_hours = 0.0
    max_earth_window = 0.0
    current_earth_window = 0.0
    earth_windows_count = 0
    in_earth_window = False

    both_windows = []
    in_both = False
    both_start = 0

    for i in range(n):
        if sun[i]:
            sunlit_count += 1
            current_sunlight += step_hours
            max_sunlight = max(max_sunlight, current_sunlight)
            current_darkness = 0.0
        else:
            current_darkness += step_hours
            max_darkness = max(max_darkness, current_darkness)
            current_sunlight = 0.0

        if earth[i]:
            earth_visible_hours += step_hours
            if not in_earth_window:
                in_earth_window = True
                earth_windows_count += 1
                current_earth_window = step_hours
            else:
                current_earth_window += step_hours
            max_earth_window = max(max_earth_window, current_earth_window)
        else:
            in_earth_window = False
            current_earth_window = 0.0

        if both[i]:
            if not in_both:
                in_both = True
                both_start = i
        elif in_both:
            in_both = False
            dur = (i - both_start) * step_hours
            both_windows.append({
                "start_idx": both_start,
                "end_idx": i - 1,
                "duration_h": dur,
                "sun_el_start": 0.0,
                "earth_el_start": 0.0,
                "sun_margin_deg": 0.0,
                "earth_margin_deg": 0.0
            })

    if in_both:
        dur = (n - both_start) * step_hours
        both_windows.append({
            "start_idx": both_start,
            "end_idx": n - 1,
            "duration_h": dur,
            "sun_el_start": 0.0,
            "earth_el_start": 0.0,
            "sun_margin_deg": 0.0,
            "earth_margin_deg": 0.0
        })

    both_windows.sort(key=lambda x: x["duration_h"], reverse=True)

    return {
        "sunlit_pct": round((sunlit_count / n) * 100.0, 2) if n > 0 else 0.0,
        "longest_sunlight_h": round(max_sunlight, 1),
        "longest_darkness_h": round(max_darkness, 1),
        "earth_visible_h": round(earth_visible_hours, 1),
        "earth_windows": earth_windows_count,
        "longest_earth_window_h": round(max_earth_window, 1),
        "both_windows": both_windows,
    }


def compute_score(metrics: dict, weights: dict, total_hours: float) -> dict:
    """Calculate site score (0-100) using weighted formula."""
    w_sun = weights.get("sunlit", 0.45)
    w_dark = weights.get("darkness", 0.20)
    w_earth = weights.get("earth", 0.25)
    w_both = weights.get("both", 0.10)

    sunlit_score = metrics["sunlit_pct"]
    darkness_score = max(0.0, 100.0 - (metrics["longest_darkness_h"] / max(1.0, total_hours)) * 100.0)
    earth_score = min(100.0, (metrics["earth_visible_h"] / max(1.0, total_hours)) * 100.0)

    bw = metrics["both_windows"]
    both_score = min(100.0, (bw[0]["duration_h"] / max(1.0, total_hours)) * 200.0) if bw else 0.0

    total = (
        sunlit_score * w_sun +
        darkness_score * w_dark +
        earth_score * w_earth +
        both_score * w_both
    )

    return {
        "sunlit_score": round(sunlit_score, 1),
        "darkness_score": round(darkness_score, 1),
        "earth_score": round(earth_score, 1),
        "both_score": round(both_score, 1),
        "total": round(total, 2),
        "weights": {"sunlit": w_sun, "darkness": w_dark, "earth": w_earth, "both": w_both},
    }


def load_ephemeris_file(bin_path: Path) -> List[dict]:
    """Read binary ephemeris file."""
    if not bin_path.exists():
        return []

    points = []
    with open(bin_path, "rb") as f:
        data = f.read()

    n = len(data) // 32
    for i in range(n):
        buf = data[i * 32 : (i + 1) * 32]
        t = struct.unpack("<d", buf[:8])[0]
        s_az, s_el, e_az, e_el, s_r, e_r = struct.unpack("<6f", buf[8:])
        points.append({
            "t": t,
            "sun_az": s_az,
            "sun_el": s_el,
            "earth_az": e_az,
            "earth_el": e_el,
            "sun_radius": s_r,
            "earth_radius": e_r
        })

    return points
