#!/usr/bin/env python3
"""
Compute Sun/Earth ephemeris for lunar landing site candidates.

Outputs binary files for each site at the specified time resolution.
Uses SPICE kernels to compute az/el in the IAU_MOON (body-fixed) frame.

Usage:
    python compute_ephemeris.py --start 2026-11-01 --end 2027-11-01 --step-hours 1
"""

import argparse
import json
import os
import struct
from datetime import datetime, timedelta
from pathlib import Path

import numpy as np
import spiceypy as sp

# Kernel paths
KERNALS_DIR = Path(__file__).parent / "kernels"

# Ephemeris point structure (Float32 little-endian + Float64 timestamp)
# Total: 8 (t) + 4*6 (az/el/radius) = 32 bytes per point
POINT_SIZE = 8 + 7 * 4  # float64 + 6 float32


def load_kernels():
    """Load all required SPICE kernels."""
    kernels = [
        "lsk.tls",           # Leapseconds
        "de440s.bsp",        # Planetary ephemeris (DE440)
        "pck00010.tpc",      # Planetary constants (radii, oblateness)
        "moon_pa_de421_1900-2050.bpc",  # Moon physical parameters
    ]
    for k in kernels:
        path = KERNALS_DIR / k
        if path.exists():
            sp.furnsh(str(path))
            print(f"Loaded kernel: {k}")
        else:
            print(f"WARNING: Kernel not found: {k}")


def sites_to_state_vector(lat_deg, lon_deg, alt_m):
    """
    Convert selenographic coordinates to IAU_MOON body-fixed position.

    Uses simple spherical model: R = 1737.4 km
    Latitude is positive north from equator, longitude is east from prime meridian.
    """
    R = 1737.4  # km
    lat_rad = np.radians(lat_deg)
    lon_rad = np.radians(lon_deg)

    # Body-fixed (x, y, z) where +x points toward lon=0,lat=0
    # +z is north pole, +y points to lon=90,lat=0
    x = (R + alt_m / 1000.0) * np.cos(lat_rad) * np.cos(lon_rad)
    y = (R + alt_m / 1000.0) * np.cos(lat_rad) * np.sin(lon_rad)
    z = (R + alt_m / 1000.0) * np.sin(lat_rad)

    # Return as [x, y, z, 0, 0, 0] for spkezr (position + zero velocity)
    return [x, y, z, 0.0, 0.0, 0.0]


def compute_site_ephemeris(site: dict, start_dt: datetime, end_dt: datetime, step_hours: float):
    """
    Compute Sun and Earth az/el for a site over a time range.

    Returns list of (t_utc, sun_az, sun_el, earth_az, earth_el, sun_radius, earth_radius)
    """
    results = []

    # Position in IAU_MOON frame
    site_pos = sites_to_state_vector(site['lat'], site['lon'], site['elevation_m'])

    # Angular radii (degrees)
    sun_radius = 0.27  # Approximate solar angular radius from Moon
    earth_radius = 0.95  # Approximate Earth angular radius from Moon

    t = start_dt
    n_steps = int((end_dt - start_dt).total_seconds() / (step_hours * 3600)) + 1

    for i in range(n_steps):
        utc_str = t.strftime("%Y-%m-%dT%H:%M:%S")

        try:
            # Convert to ET
            et = sp.str2et(utc_str)

            # Get Moon orientation relative to J2000 at this time
            # Transform from IAU_MOON to J2000
            tf = sp.pxform('IAU_MOON', 'J2000', et)

            # Get Sun position relative to Moon (J2000 frame)
            # Using Earth-Moon barycenter as observer
            sun_state, _ = sp.spkezr('SUN', et, 'J2000', 'NONE', 'MOON')

            # Get Earth position relative to Moon (J2000 frame)
            earth_state, _ = sp.spkezr('EARTH', et, 'J2000', 'NONE', 'MOON')

            # Transform to IAU_MOON (body-fixed) frame
            tf_inv = np.array(tf).T
            sun_moon = tf_inv @ np.array(sun_state[:3])
            earth_moon = tf_inv @ np.array(earth_state[:3])

            # Convert to topocentric az/el from site position
            site_xyz = np.array(site_pos[:3])

            sun_az_el = topocentric_az_el(sun_moon, site_xyz, et)
            earth_az_el = topocentric_az_el(earth_moon, site_xyz, et)

            results.append({
                't': t.timestamp(),
                'sun_az': sun_az_el[0],
                'sun_el': sun_az_el[1],
                'earth_az': earth_az_el[0],
                'earth_el': earth_az_el[1],
                'sun_radius': sun_radius,
                'earth_radius': earth_radius
            })

        except Exception as e:
            print(f"Warning: Error at {utc_str}: {e}")
            results.append({
                't': t.timestamp(),
                'sun_az': 0.0,
                'sun_el': -90.0,
                'earth_az': 0.0,
                'earth_el': -90.0,
                'sun_radius': sun_radius,
                'earth_radius': earth_radius
            })

        t += timedelta(hours=step_hours)

    return results


def topocentric_az_el(body_vec, site_xyz, et):
    """
    Convert body vector (from Moon center) to site-relative az/el.

    Azimuth: 0 = North, 90 = East, 180 = South, 270 = West
    Elevation: + up, - down
    """
    # Vector from site to body
    site_to_body = body_vec - site_xyz

    # Convert to azimuth/elevation
    h = np.linalg.norm(site_to_body)
    if h < 1e-6:
        return 0.0, -90.0

    # Distance from site
    x = site_to_body[0]  # East
    y = site_to_body[1]  # North (in IAU_MOON, +y is 90E)
    z = site_to_body[2]  # Up

    # Azimuth: 0 at North, goes East (90)
    # In IAU_MOON: +y is 90E, +x is 0E
    # So azimuth from North = atan2(x, y)
    azimuth = np.degrees(np.arctan2(x, y))
    if azimuth < 0:
        azimuth += 360.0

    # Elevation
    elevation = np.degrees(np.arcsin(z / h))

    return azimuth, elevation


def write_binary_ephemeris(filepath: Path, points: list):
    """Write ephemeris points to binary file (little-endian)."""
    with open(filepath, 'wb') as f:
        for p in points:
            # Float64 timestamp
            f.write(struct.pack('<d', p['t']))
            # Six Float32 values
            f.write(struct.pack('<6f',
                p['sun_az'], p['sun_el'],
                p['earth_az'], p['earth_el'],
                p['sun_radius'], p['earth_radius']
            ))


def generate_manifest(start: str, end: str, step_hours: float, sites: list, output_dir: Path):
    """Generate manifest.json for the ephemeris data."""
    manifest = {
        'version': '1.0',
        'generated_at': datetime.utcnow().isoformat() + 'Z',
        'date_range': {'start': start, 'end': end},
        'step_hours': step_hours,
        'sites': sites,
        'ephemeris': {},
        'sample': False,
        'notes': 'Computed with NAIF SPICE kernels (de440s, pck00010, moon_pa_de421). Azimuth: 0=N, 90=E. IAU_MOON body-fixed frame.'
    }

    for site in sites:
        manifest['ephemeris'][site['id']] = {
            'url': f'/data/ephemeris/{site["id"]}.bin',
            'points': len(site.get('_points', [])),
            'bytes': 32 * len(site.get('_points', []))  # 32 bytes per point
        }

    with open(output_dir / 'manifest.json', 'w') as f:
        json.dump(manifest, f, indent=2)

    return manifest


def main():
    parser = argparse.ArgumentParser(description='Compute ephemeris for lunar sites')
    parser.add_argument('--start', required=True, help='Start date (YYYY-MM-DD)')
    parser.add_argument('--end', required=True, help='End date (YYYY-MM-DD)')
    parser.add_argument('--step-hours', type=float, default=1.0, help='Time step in hours')
    parser.add_argument('--sites', default=None, help='Comma-separated site IDs (all if not specified)')

    args = parser.parse_args()

    # Load SPICE kernels
    load_kernels()

    # Load sites
    sites_path = Path(__file__).parent.parent / 'data' / 'sites.json'
    with open(sites_path) as f:
        sites = json.load(f)

    # Filter sites if specified
    if args.sites:
        site_ids = set(args.sites.split(','))
        sites = [s for s in sites if s['id'] in site_ids]

    if not sites:
        print("No sites to process")
        return

    start_dt = datetime.strptime(args.start, '%Y-%m-%d')
    end_dt = datetime.strptime(args.end, '%Y-%m-%d') + timedelta(days=1) - timedelta(hours=1)

    # Output directory
    output_dir = Path(__file__).parent.parent / 'public' / 'data' / 'ephemeris'
    output_dir.mkdir(parents=True, exist_ok=True)

    print(f"\nComputing ephemeris for {len(sites)} sites...")
    print(f"Date range: {args.start} to {args.end}")
    print(f"Step: {args.step_hours} hours")

    for site in sites:
        print(f"\nProcessing: {site['name']} ({site['id']})")

        points = compute_site_ephemeris(site, start_dt, end_dt, args.step_hours)
        site['_points'] = points

        bin_path = output_dir / f"{site['id']}.bin"
        write_binary_ephemeris(bin_path, points)
        print(f"  Wrote {len(points)} points to {bin_path}")
        print(f"  Size: {bin_path.stat().st_size / 1024:.1f} KB")

    # Generate manifest
    manifest = generate_manifest(args.start, args.end, args.step_hours, sites,
                                  Path(__file__).parent.parent / 'public' / 'data')
    manifest_path = Path(__file__).parent.parent / 'public' / 'data' / 'manifest.json'
    with open(manifest_path, 'w') as f:
        json.dump(manifest, f, indent=2)
    print(f"\nWrote manifest to {manifest_path}")


if __name__ == '__main__':
    main()