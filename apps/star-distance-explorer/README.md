# Nearspace — Star Distance Explorer

A standalone, dependency-free browser prototype that reads nearby stellar distances from NASA's MAST TESS Input Catalog (TIC).

## Run locally

From the repository root, start a local static server:

```powershell
py -m http.server 8000
```

Then open [http://localhost:8000/apps/star-distance-explorer/](http://localhost:8000/apps/star-distance-explorer/) in a browser. Stop the server with `Ctrl+C`.

The app sends read-only requests to the public MAST and SIMBAD TAP APIs. No API key or backend is required. It requests TIC entries with catalog distances within 100 light-years, converts parsecs to light-years for display, and offers cumulative 10, 25, 50, and 100 light-year filters. Results are sorted nearest-first and paginated in the browser. Gaia DR2 identifiers from TIC are cross-referenced with SIMBAD in batches for the visible page; the TIC ID remains the fallback when SIMBAD has no alternate identifier or the lookup is unavailable. The name search looks up exact common-name entries in SIMBAD and displays their coordinates and catalog identifiers. Search results match to TIC by Gaia ID first, then by position and parallax when Gaia IDs are unavailable. If no reliable TIC match is found, a positive SIMBAD parallax is converted to distance using 1/parallax (with parallax in arcseconds).

## Data notes

- Service: [`Mast.Catalogs.Filtered.Tic.Rows`](https://mast.stsci.edu/api/v0/_services.html)
- Catalog field descriptions: [TIC fields](https://mast.stsci.edu/api/v0/_t_i_cfields.html)
- Name cross-reference: [SIMBAD TAP](https://simbad.cds.unistra.fr/simbad/sim-tap/)
- Distance (`d`) and uncertainty (`e_d`) are in parsecs; right ascension (`ra`) and declination (`dec`) are in degrees.
- The TIC is a TESS input catalog, not a complete census of stars in the Milky Way.
- Nearby-list distances and uncertainties are TIC catalog values. Name-search distances use TIC values when matched, or are calculated from SIMBAD parallax as a fallback; they are not independently validated by this app.
