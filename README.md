# Project-Stargate
Astronomer's all-in-one app.

## Overview
Project-Stargate is a modular application designed for amateur and professional astronomers who want a single, integrated tool for observing, exploring, and analyzing the night sky. It combines interactive visual modes, observational aids, and data analysis tools so users can discover celestial objects, plan observing sessions, operate telescopes, and extract scientific insights — all from one place.

Core features

- Stargazing Mode: Real-time sky maps, constellation overlays, and augmented star labels to help users identify objects by eye or with binoculars.
- Exploration Mode: Search and browse catalogs (stars, deep-sky objects, planets) with rich metadata and history.
- Exoplanet Atlas: Visually explore confirmed exoplanet host stars from nearest to furthest, with illustrative planet details in [`apps/exoplanet-atlas/`](apps/exoplanet-atlas/).
- Cosmic Watch: A standalone small-body tracker for near-Earth objects, asteroids, Kuiper Belt objects, comets, and location-aware observing forecasts.
- Telescope Mode: Tools for pointing, alignment assistance, and integration hooks for telescope control (hardware/API adapters described in docs).
- Analysis Mode: Photometry, light curve extraction, and basic image processing workflows for observational data.
- Kepler Effect Mode: Visualizations and simulations for orbital motion and time-based celestial mechanics.
- Guided Tours & UX Flows: Curated tours, tutorials, and onboarding to help new users get productive quickly.
- Premium Modules: Paid or advanced features like automated observing sequences, cloud-based processing, and high-resolution data exports (see `docs/PREMIUM_MODULES.md`).

Documentation & contribution

See the `docs/` folder for design docs, UI specs, mode architecture, and the roadmap. If you want to contribute, open an issue describing your idea or improvement; contributor guidelines and automation are in `.github/`.

## Repository structure

```text
ProjectStargate/
├── README.md
├── apps/
│   ├── cosmic-watch/
│   ├── exoplanet-atlas/
│   └── star-distance-explorer/
├── docs/
│   ├── PROJECT_VISION.md
│   ├── CORE_PHILOSOPHY.md
│   ├── UI_SPECIFICATION.md
│   ├── MODE_ARCHITECTURE.md
│   ├── STARGAZING_MODE.md
│   ├── EXPLORATION_MODE.md
│   ├── TELESCOPE_MODE.md
│   ├── ANALYSIS_MODE.md
│   ├── KEPLER_EFFECT_MODE.md
│   ├── GUIDED_TOURS.md
│   ├── PREMIUM_MODULES.md
│   ├── UX_GUIDELINES.md
│   └── ROADMAP.md
└── .github/
    └── copilot-instructions.md
```

## Docs
See the `docs/` folder for design docs, mode specs, UX guidelines, and the roadmap.
