const EXOPLANET_ARCHIVE_ENDPOINT = "/api/exoplanets";
const LIGHT_YEARS_PER_PARSEC = 3.26156;

const catalogSummary = document.querySelector("#catalog-summary");
const catalogStatus = document.querySelector("#catalog-status");
const sliderControls = document.querySelector("#slider-controls");
const starSlider = document.querySelector("#star-slider");
const distanceTicks = document.querySelector("#distance-ticks");
const selectedDistance = document.querySelector("#selected-distance");
const starButton = document.querySelector("#star-button");
const selectedStarTitle = document.querySelector("#selected-star-title");
const starSubtitle = document.querySelector("#star-subtitle");
const starCount = document.querySelector("#star-count");
const planetPanel = document.querySelector("#planet-panel");

let hostStars = [];
let selectedIndex = 0;
let detailsVisible = false;

function numericValue(value) {
  if (value === null || value === undefined || value === "") {
    return null;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function formatNumber(value, digits = 2) {
  const parsed = numericValue(value);
  if (parsed === null) {
    return "Not available";
  }
  return new Intl.NumberFormat(undefined, { maximumFractionDigits: digits }).format(parsed);
}

function showStatus(message, state = "loading") {
  catalogStatus.replaceChildren();
  catalogStatus.className = `catalog-status${state === "error" ? " is-error" : ""}`;
  catalogStatus.hidden = false;

  if (state === "loading") {
    const spinner = document.createElement("span");
    spinner.className = "loading-spinner";
    spinner.setAttribute("aria-hidden", "true");
    catalogStatus.append(spinner);
  }

  const text = document.createElement("span");
  text.textContent = message;
  catalogStatus.append(text);
}

function normalizeHostStars(rows) {
  if (!Array.isArray(rows)) {
    throw new Error("NASA returned an unexpected catalog response.");
  }

  const hosts = new Map();
  for (const row of rows) {
    if (!row || typeof row.hostname !== "string" || row.hostname.trim() === "") {
      continue;
    }

    const distanceParsecs = numericValue(row.sy_dist);
    if (distanceParsecs === null || distanceParsecs <= 0) {
      continue;
    }

    const hostname = row.hostname.trim();
    let host = hosts.get(hostname);
    if (!host) {
      host = {
        name: hostname,
        distanceLightYears: distanceParsecs * LIGHT_YEARS_PER_PARSEC,
        spectralType: typeof row.st_spectype === "string" ? row.st_spectype.trim() : "",
        temperatureKelvin: numericValue(row.st_teff),
        planets: [],
      };
      hosts.set(hostname, host);
    }

    if (typeof row.pl_name === "string" && row.pl_name.trim() !== "") {
      host.planets.push({
        name: row.pl_name.trim(),
        radiusEarth: numericValue(row.pl_rade),
        massEarth: numericValue(row.pl_bmasse),
        orbitalPeriodDays: numericValue(row.pl_orbper),
        temperatureKelvin: numericValue(row.pl_eqt),
        density: numericValue(row.pl_dens),
        insolationEarth: numericValue(row.pl_insol),
        orbitalDistanceAu: numericValue(row.pl_orbsmax),
      });
    }
  }

  return [...hosts.values()].sort((first, second) => (
    first.distanceLightYears - second.distanceLightYears
  ));
}

async function loadHostStars() {
  showStatus("Loading confirmed exoplanet systems…");
  starSlider.disabled = true;

  const response = await fetch(EXOPLANET_ARCHIVE_ENDPOINT);
  if (!response.ok) {
    throw new Error(`NASA Exoplanet Archive request failed (${response.status} ${response.statusText}).`);
  }

  hostStars = normalizeHostStars(await response.json());
  if (hostStars.length === 0) {
    catalogSummary.textContent = "No systems found";
    showStatus("The archive responded, but no host stars with usable distances were returned.", "error");
    return;
  }

  catalogStatus.hidden = true;
  sliderControls.hidden = false;
  starSlider.max = String(hostStars.length - 1);
  starSlider.value = "0";
  starSlider.disabled = false;
  catalogSummary.textContent = `${hostStars.length.toLocaleString()} host stars · nearest to furthest`;
  renderDistanceTicks();
  renderSelectedStar();
}

function renderDistanceTicks() {
  distanceTicks.replaceChildren();
  const positions = [0, 0.25, 0.5, 0.75, 1];
  const indices = [...new Set(positions.map((fraction) => (
    Math.round(fraction * (hostStars.length - 1))
  )))];

  for (const index of indices) {
    const tick = document.createElement("span");
    tick.textContent = `${formatNumber(hostStars[index].distanceLightYears, 0)} ly`;
    distanceTicks.append(tick);
  }
}

function spectralClass(star) {
  const match = star.spectralType.match(/[OBAFGKM]/i);
  return match ? `spectral-${match[0].toLowerCase()}` : "spectral-g";
}

function renderSelectedStar() {
  const star = hostStars[selectedIndex];
  if (!star) {
    return;
  }

  detailsVisible = false;
  selectedDistance.textContent = `${formatNumber(star.distanceLightYears)} light-years`;
  selectedStarTitle.textContent = star.name;
  starSubtitle.textContent = star.spectralType
    ? `${star.spectralType} spectral type`
    : star.temperatureKelvin !== null
      ? `Estimated temperature ${formatNumber(star.temperatureKelvin, 0)} K`
      : "Confirmed exoplanet host star";
  starCount.textContent = `${star.planets.length} confirmed ${star.planets.length === 1 ? "planet" : "planets"}`;
  starButton.className = `star-button ${spectralClass(star)}`;
  starButton.disabled = false;
  starButton.setAttribute("aria-label", `Show confirmed planets orbiting ${star.name}`);
  renderEmptyDetail();
}

function planetAppearance(planet) {
  if (planet.temperatureKelvin !== null && planet.temperatureKelvin >= 1000) {
    return { type: "Ultra-hot world", className: "is-hot" };
  }
  if (planet.radiusEarth === null) {
    return { type: "Type undetermined", className: "" };
  }
  if (planet.radiusEarth < 1.25) {
    return { type: "Terrestrial-size", className: "is-rocky" };
  }
  if (planet.radiusEarth < 2) {
    return { type: "Super-Earth-size", className: "is-super-earth" };
  }
  if (planet.radiusEarth < 6) {
    return { type: "Neptune-size", className: "is-neptune" };
  }
  return { type: "Gas-giant-size", className: "is-giant" };
}

function makePlanetCard(planet) {
  const card = document.createElement("article");
  card.className = "planet-card";

  const appearance = planetAppearance(planet);
  const art = document.createElement("div");
  art.className = `planet-art ${appearance.className}`;
  art.setAttribute("role", "img");
  art.setAttribute("aria-label", `Illustration of a ${appearance.type.toLowerCase()} exoplanet`);
  const sphere = document.createElement("span");
  sphere.className = "planet";
  art.append(sphere);

  const info = document.createElement("div");
  info.className = "planet-info";
  const title = document.createElement("h3");
  title.textContent = planet.name;
  const type = document.createElement("span");
  type.className = "planet-type";
  type.textContent = appearance.type;
  const metrics = document.createElement("p");
  metrics.className = "planet-metrics";
  const metricValues = [
    planet.radiusEarth === null ? null : `${formatNumber(planet.radiusEarth)} R⊕`,
    planet.massEarth === null ? null : `${formatNumber(planet.massEarth)} M⊕`,
    planet.orbitalPeriodDays === null ? null : `${formatNumber(planet.orbitalPeriodDays)} day orbit`,
    planet.temperatureKelvin === null ? null : `${formatNumber(planet.temperatureKelvin, 0)} K`,
  ].filter((value) => value !== null);

  for (const value of metricValues) {
    const metric = document.createElement("span");
    metric.textContent = value;
    metrics.append(metric);
  }
  if (metricValues.length === 0) {
    const metric = document.createElement("span");
    metric.textContent = "Limited catalog measurements";
    metrics.append(metric);
  }

  info.append(title, type, metrics);
  card.append(art, info);
  return card;
}

function renderEmptyDetail() {
  const empty = document.createElement("div");
  empty.className = "empty-detail";

  const orbit = document.createElement("span");
  orbit.className = "empty-orbit";
  orbit.setAttribute("aria-hidden", "true");
  const planet = document.createElement("span");
  planet.setAttribute("aria-hidden", "true");
  orbit.append(planet);

  const eyebrow = document.createElement("p");
  eyebrow.className = "eyebrow";
  eyebrow.textContent = "A SYSTEM TO EXPLORE";
  const title = document.createElement("h2");
  title.id = "planet-panel-title";
  title.textContent = "Every star has a story.";
  const description = document.createElement("p");
  description.textContent = "Select the glowing star to see its confirmed planets.";
  empty.append(orbit, eyebrow, title, description);
  planetPanel.replaceChildren(empty);
}

function showPlanets() {
  const star = hostStars[selectedIndex];
  if (!star) {
    return;
  }

  detailsVisible = true;
  const heading = document.createElement("header");
  heading.className = "planet-heading";
  const titleGroup = document.createElement("div");
  const eyebrow = document.createElement("p");
  eyebrow.className = "eyebrow";
  eyebrow.textContent = "CONFIRMED PLANETS";
  const title = document.createElement("h2");
  title.id = "planet-panel-title";
  title.textContent = `Worlds around ${star.name}`;
  titleGroup.append(eyebrow, title);

  const total = document.createElement("span");
  total.className = "planet-total";
  total.textContent = `${star.planets.length} ${star.planets.length === 1 ? "planet" : "planets"}`;
  heading.append(titleGroup, total);

  const content = document.createElement("div");
  if (star.planets.length === 0) {
    const empty = document.createElement("p");
    empty.className = "no-planets";
    empty.textContent = "No confirmed planets with displayable catalog records are listed for this host star.";
    content.append(empty);
  } else {
    const list = document.createElement("div");
    list.className = "planet-list";
    for (const planet of star.planets) {
      list.append(makePlanetCard(planet));
    }
    content.append(list);

    const note = document.createElement("p");
    note.className = "illustration-note";
    note.textContent = "Illustrative appearance is inferred from measured size and estimated temperature. Actual colors, clouds, and surface features are unknown.";
    content.append(note);
  }

  planetPanel.replaceChildren(heading, content);
}

starSlider.addEventListener("input", () => {
  selectedIndex = Number(starSlider.value);
  renderSelectedStar();
});

starButton.addEventListener("click", () => {
  if (!detailsVisible) {
    showPlanets();
  }
});

loadHostStars().catch((error) => {
  console.error("Unable to load the NASA Exoplanet Archive.", error);
  catalogSummary.textContent = "Catalog unavailable";
  showStatus(`Could not load the NASA Exoplanet Archive. Check your connection and try reloading. ${error.message}`, "error");
});
