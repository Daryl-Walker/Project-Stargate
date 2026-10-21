# Cosmic Watch — Small-Body Tracker

A standalone browser app for exploring small bodies and planning basic observing forecasts from a chosen location.

## Run locally

Start the local server from this app's directory:

```powershell
py server.py
```

Then open [http://127.0.0.1:8000/](http://127.0.0.1:8000/) in a browser. Stop the server with `Ctrl+C`.

## Features

- Searchable JPL Small-Body Database lists for near-Earth objects, main-belt asteroids, trans-Neptunian objects, and comets with perihelion passages in the past 90 days or next year.
- Potentially hazardous asteroid flags and basic orbital/physical data where the catalog has values.
- Meteor shower calendar with recurring peak-date estimates and radiant altitude at 2 a.m. local time for the selected location.
- JPL Horizons comet ephemerides for the next four local evenings, including altitude and estimated apparent magnitude.
- Enter coordinates manually or explicitly grant browser location permission. Coordinates are held in page memory only; they are not saved.

## Data and limitations

- Small-body catalog and orbital data: [NASA/JPL SBDB Query API](https://ssd-api.jpl.nasa.gov/doc/sbdb_query.html).
- Observer ephemerides: [NASA/JPL Horizons API](https://ssd-api.jpl.nasa.gov/doc/horizons.html).
- The meteor shower calendar uses approximate recurring peak dates, rates, and radiants; it is not a year-specific forecast.
- Comet altitude and magnitude are ephemeris estimates. Weather, twilight, moonlight, light pollution, and uncertain comet activity can affect actual viewing.
- Catalog data can be incomplete. Missing values are shown as unavailable rather than inferred.
- No API key is required. The local Python server serves the app and proxies only its fixed, read-only SBDB and Horizons API routes to avoid browser CORS restrictions.
- Manual coordinates stay in page memory. Browser geolocation requires explicit permission. Coordinates are sent to JPL only when a comet forecast is requested.
