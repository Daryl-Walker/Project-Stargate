# Exoplanet Atlas

A visual, distance-sorted explorer of stars with confirmed exoplanets. Move the
slider from the nearest host star to the furthest, then select the glowing star
to view the planets cataloged around it.

## Run locally

Start the local server from this app's directory:

```powershell
py server.py
```

Then open [http://127.0.0.1:8000/](http://127.0.0.1:8000/).
Stop the server with `Ctrl+C`.

## Data and illustrations

- Confirmed planet and host-star data comes from the NASA Exoplanet Archive's
  `pscomppars` table.
- Host stars are grouped and ordered by their catalog distance from the Sun.
- Distances in parsecs are converted to light-years for display.
- Planet size labels and artwork are illustrative categories based on cataloged
  radius and estimated temperature. They are not photographs or claims about
  known surface colors or features.
- Systems without a catalog distance are omitted. Catalog values may be missing.
- The app makes a read-only request to the public NASA Exoplanet Archive
  through its small local server, which avoids browser CORS restrictions.
  No API key is required.
