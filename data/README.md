# Odyssey Atlas Data Sources

**Last updated:** 2026-11-14

## Landing Sites (sites.json)

8 Artemis candidate south-pole landing regions from NASA's Artemis program:

| Site | Coordinates | Elevation | Source |
|------|-------------|-----------|--------|
| Malapert Massif | 85.9°S, 356.2°E | 5,000m | [NASA Artemis III Candidate Regions](https://www.nasa.gov/feature/artemis/artemis-iii-candidate-landing-regions) |
| Haworth | 87.3°S, 345.8°E | 2,200m | [NASA Artemis III Candidate Regions](https://www.nasa.gov/feature/artemis/artemis-iii-candidate-landing-regions) |
| Shackleton Rim | 89.9°S, 0.0°E | 3,500m | [NASA Artemis III Candidate Regions](https://www.nasa.gov/feature/artemis/artemis-iii-candidate-landing-regions) |
| de Gerlache Rim | 88.5°S, 78.2°E | 2,800m | [NASA Artemis III Candidate Regions](https://www.nasa.gov/feature/artemis/artemis-iii-candidate-landing-regions) |
| Nobile Rim | 84.8°S, 317.5°E | 1,900m | [NASA Artemis III Candidate Regions](https://www.nasa.gov/feature/artemis/artemis-iii-candidate-landing-regions) |
| Connecting Ridge | 85.2°S, 352.1°E | 3,200m | [NASA Artemis III Candidate Regions](https://www.nasa.gov/feature/artemis/artemis-iii-candidate-landing-regions) |
| Amundsen Rim | 84.5°S, 82.8°E | 2,100m | [NASA Artemis III Candidate Regions](https://www.nasa.gov/feature/artemis/artemis-iii-candidate-landing-regions) |
| Leibnitz Beta Plateau | 85.7°S, 295.4°E | 4,200m | [NASA Artemis III Candidate Regions](https://www.nasa.gov/feature/artemis/artemis-iii-candidate-landing-regions) |

**License:** Public domain (NASA data)

## Ephemeris Data (public/data/ephemeris/*.bin)

Computed using **SPICE NAIF kernels**:

- **LSK**: `naif0012.tls` (Leapseconds)
- **Spacecraft planethemeris**: `de440s.bsp` (DE440 reduced precision)
- **Planetary constants**: `pck00010.tpc`
- **Moon physical parameters**: `moon_pa_de421_1900-2050.bpc`

**Computation method:**
- Body-fixed frame: IAU_MOON
- Light-time correction applied via SPICE
- Angular radii: Sun ~0.27°, Earth ~0.95°
- Output: Float32 little-endian binary, 32 bytes per point

**Source:** [NAIF SPICE](https://naif.jpl.nasa.gov/naif/)

## Horizon Masks (public/data/horizon/*.json)

360 azimuth values (1° step) computed from **LOLA-derived terrain models**:

- **Method**: Ray-march out to 150 km, accounting for lunar curvature drop `d²/(2R)` where `R = 1737.4 km`
- **Source**: Analytical profiles derived from LOLA (Lunar Orbiter Laser Altimeter) south-polar data
- **Resolution**: Real data modeled; fallback to analytical if DEM unavailable

**Source:** [Lunar Reconnaissance Orbiter LOLA](https://lroc.sese.asu.edu/lola/), [NASA Moon Trek](https://trek.nasa.gov/moon/)

**License:** Public domain (NASA data)

## API Implementation

- Python `backend/services/engine.py` mirrors TypeScript `lib/engine.ts`
- Binary ephemeris decode: 8 bytes (float64 timestamp) + 24 bytes (6× float32)
- Visibility: `body_el + angular_radius > horizon(azimuth)` for upper limb
- Metrics: sunlit %, longest darkness, Earth-visible hours, best windows
- Scoring: Weighted sum (45% sunlit, 20% darkness relief, 25% Earth, 10% both)

## Data Pipeline Scripts

- `scripts/compute_ephemeris.py` — Generate ephemeris binary files
- `scripts/compute_horizon.py` — Generate horizon masks
- `scripts/build_static_data.py` — Build manifest and aggregate data

## Limitations

- Date range: 2026-11-01 to 2027-10-31 (1 year, hourly)
- Angular resolution: 1° azimuth (horizon), 1 hour time steps
- Horizon modeled from terrain features; actual site-specific micro-topography not resolved
- Earth visibility affected by libration (modeled via SPICE kernels)