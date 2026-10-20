# Nearspace — Star Distance Explorer

A standalone, dependency-free browser prototype that reads nearby stellar distances from NASA's MAST TESS Input Catalog (TIC).

## Run locally

From the repository root, start a local static server:

```powershell
py -m http.server 8000
```

Then open [http://localhost:8000/apps/star-distance-explorer/](http://localhost:8000/apps/star-distance-explorer/) in a browser. Stop the server with `Ctrl+C`.

The app sends a read-only request to the public MAST API. No API key or backend is required. It requests TIC entries with catalog distances within 100 light-years, converts parsecs to light-years for display, and offers cumulative 10, 25, 50, and 100 light-year filters. Results are sorted nearest-first and paginated in the browser.

## Data notes

- Service: [`Mast.Catalogs.Filtered.Tic.Rows`](https://mast.stsci.edu/api/v0/_services.html)
- Catalog field descriptions: [TIC fields](https://mast.stsci.edu/api/v0/_t_i_cfields.html)
- Distance (`d`) and uncertainty (`e_d`) are in parsecs; right ascension (`ra`) and declination (`dec`) are in degrees.
- The TIC is a TESS input catalog, not a complete census of stars in the Milky Way.
- Distances and uncertainties are catalog values, not calculated or independently validated by this app.
