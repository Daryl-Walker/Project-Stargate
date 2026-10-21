const SBDB_QUERY_ENDPOINT = "/api/sbdb_query.api";
const HORIZONS_ENDPOINT = "/api/horizons.api";
const OBJECT_FIELDS = [
  "spkid",
  "full_name",
  "pdes",
  "name",
  "prefix",
  "neo",
  "pha",
  "class",
  "e",
  "a",
  "q",
  "i",
  "moid",
  "moid_ld",
  "per_y",
  "tp_cal",
  "H",
  "M1",
  "diameter",
];
const LIST_LIMIT = 50;
const COMET_LIMIT = 30;

const categoryTabs = [...document.querySelectorAll("[data-category]")];
const objectPanel = document.querySelector("#object-panel");
const showerPanel = document.querySelector("#shower-panel");
const categoryTitle = document.querySelector("#category-title");
const categoryEyebrow = document.querySelector("#category-eyebrow");
const listSummary = document.querySelector("#list-summary");
const listStatus = document.querySelector("#list-status");
const objectList = document.querySelector("#object-list");
const objectFilter = document.querySelector("#object-filter");
const locationForm = document.querySelector("#location-form");
const latitudeInput = document.querySelector("#latitude");
const longitudeInput = document.querySelector("#longitude");
const locationStatus = document.querySelector("#location-status");
const useLocationButton = document.querySelector("#use-location");
const showerList = document.querySelector("#shower-list");

const categoryConfig = {
  neos: {
    title: "Near-Earth objects",
    request: {
      "sb-kind": "a",
      "sb-group": "neo",
      "sb-cdata": JSON.stringify({ AND: ["moid|DF"] }),
      sort: "moid",
      limit: LIST_LIMIT,
    },
    description: "Ordered by minimum orbit distance from Earth",
  },
  asteroids: {
    title: "Asteroid belt",
    request: { "sb-class": "IMB,MBA,OMB", sort: "a", limit: LIST_LIMIT },
    description: "Inner, main, and outer main-belt asteroids",
  },
  kbos: {
    title: "Kuiper Belt objects",
    request: { "sb-class": "TNO", sort: "a", limit: LIST_LIMIT },
    description: "Trans-Neptunian objects ordered by orbital size",
  },
  comets: {
    title: "Recent and upcoming comet perihelia",
    request: null,
    description: "Perihelion passages from the last 90 days through the next year",
  },
};

const meteorShowers = [
  { name: "Quadrantids", month: 0, day: 3, ra: 230, dec: 49, rate: 120 },
  { name: "Lyrids", month: 3, day: 22, ra: 271, dec: 34, rate: 18 },
  { name: "Eta Aquariids", month: 4, day: 6, ra: 338, dec: -1, rate: 50 },
  { name: "Perseids", month: 7, day: 12, ra: 48, dec: 58, rate: 100 },
  { name: "Draconids", month: 9, day: 8, ra: 262, dec: 54, rate: 10 },
  { name: "Orionids", month: 9, day: 21, ra: 95, dec: 16, rate: 20 },
  { name: "Taurids", month: 10, day: 5, ra: 52, dec: 15, rate: 5 },
  { name: "Leonids", month: 10, day: 17, ra: 153, dec: 22, rate: 15 },
  { name: "Geminids", month: 11, day: 14, ra: 112, dec: 33, rate: 150 },
  { name: "Ursids", month: 11, day: 22, ra: 217, dec: 76, rate: 10 },
];

let activeCategory = "neos";
let cachedObjects = new Map();
let observingLocation = null;
let cometForecasts = new Map();
let isLoading = false;

function numberValue(value) {
  if (value === null || value === undefined || value === "") {
    return null;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function displayValue(value, digits = 2) {
  const parsed = numberValue(value);
  return parsed === null ? "Not available" : new Intl.NumberFormat(undefined, {
    maximumFractionDigits: digits,
  }).format(parsed);
}

function displayLunarDistances(value) {
  const parsed = numberValue(value);
  if (parsed === null) {
    return "Not available";
  }
  return `${displayValue(parsed, parsed > 0 && parsed < 0.01 ? 4 : 2)} LD`;
}

function currentJulianDate() {
  return Date.now() / 86400000 + 2440587.5;
}

function createObjectRecord(row, fields) {
  return Object.fromEntries(fields.map((field, index) => [field, row[index] ?? null]));
}

async function fetchObjectCategory(category) {
  if (cachedObjects.has(category)) {
    return cachedObjects.get(category);
  }

  const params = new URLSearchParams({
    fields: OBJECT_FIELDS.join(","),
    ...(categoryConfig[category].request || {
      "sb-kind": "c",
      "sb-cdata": JSON.stringify({
        AND: [`tp|RG|${(currentJulianDate() - 90).toFixed(2)}|${(currentJulianDate() + 365).toFixed(2)}`],
      }),
      sort: "tp",
      limit: COMET_LIMIT,
    }),
  });
  const response = await fetch(`${SBDB_QUERY_ENDPOINT}?${params}`);
  if (!response.ok) {
    throw new Error(`JPL SBDB request failed (${response.status} ${response.statusText}).`);
  }

  const payload = await response.json();
  if (payload.code || !Array.isArray(payload.fields) || !Array.isArray(payload.data)) {
    throw new Error(payload.message || "JPL SBDB returned an unexpected response.");
  }

  const records = payload.data.map((row) => createObjectRecord(row, payload.fields));
  cachedObjects.set(category, records);
  if (category === "comets") {
    cometForecasts.clear();
  }
  return records;
}

function formatObjectName(object) {
  return object.name || object.full_name?.trim() || object.pdes || "Unnamed object";
}

function makeMetadata(label, value) {
  const item = document.createElement("div");
  item.className = "object-metric";
  const term = document.createElement("span");
  term.className = "metric-label";
  term.textContent = label;
  const description = document.createElement("span");
  description.className = "metric-value";
  description.textContent = value;
  item.append(term, description);
  return item;
}

function createObjectCard(object) {
  const card = document.createElement("article");
  card.className = "object-card";

  const header = document.createElement("div");
  header.className = "object-header";
  const nameGroup = document.createElement("div");
  const title = document.createElement("h3");
  title.textContent = formatObjectName(object);
  const designation = document.createElement("p");
  designation.className = "object-designation";
  designation.textContent = object.pdes || object.full_name?.trim() || "Designation unavailable";
  nameGroup.append(title, designation);
  const badges = document.createElement("div");
  badges.className = "badges";
  if (object.class) {
    badges.append(makeBadge(object.class));
  }
  if (object.pha === "Y") {
    badges.append(makeBadge("Potentially hazardous", "badge-alert"));
  } else if (object.neo === "Y") {
    badges.append(makeBadge("Near-Earth"));
  }
  header.append(nameGroup, badges);

  const metrics = document.createElement("div");
  metrics.className = "object-metrics";
  metrics.append(
    makeMetadata("Perihelion", object.q === null ? "Not available" : `${displayValue(object.q)} au`),
    makeMetadata("Semi-major axis", object.a === null ? "Not available" : `${displayValue(object.a)} au`),
    makeMetadata("Inclination", object.i === null ? "Not available" : `${displayValue(object.i)}°`),
    makeMetadata("Earth MOID", displayLunarDistances(object.moid_ld)),
    makeMetadata("Period", object.per_y === null ? "Not available" : `${displayValue(object.per_y)} years`),
    makeMetadata("Diameter", object.diameter === null ? "Not available" : `${displayValue(object.diameter)} km`),
  );

  card.append(header, metrics);
  if (activeCategory === "comets") {
    if (object.tp_cal) {
      card.append(makeMetadata("Next perihelion", object.tp_cal));
    }
    const forecastButton = document.createElement("button");
    forecastButton.className = "button button-secondary forecast-button";
    forecastButton.type = "button";
    forecastButton.textContent = "Check visibility from my location";
    forecastButton.disabled = !observingLocation;
    forecastButton.addEventListener("click", () => loadCometForecast(object, card, forecastButton));
    card.append(forecastButton);
    const forecast = cometForecasts.get(String(object.spkid));
    if (forecast) {
      card.append(renderForecast(forecast));
    }
  }
  return card;
}

function makeBadge(text, className = "") {
  const badge = document.createElement("span");
  badge.className = `badge ${className}`.trim();
  badge.textContent = text;
  return badge;
}

function renderObjectList(records) {
  const query = objectFilter.value.trim().toLocaleLowerCase();
  const filtered = records.filter((object) => (
    !query || [
      object.name,
      object.full_name,
      object.pdes,
      object.class,
    ].some((value) => String(value || "").toLocaleLowerCase().includes(query))
  ));

  objectList.replaceChildren(...filtered.map(createObjectCard));
  if (filtered.length === 0) {
    listStatus.hidden = false;
    listStatus.textContent = query ? "No objects in this list match that filter." : "No matching objects were returned.";
  } else {
    listStatus.hidden = true;
  }
}

async function loadCategory(category, forceRefresh = false) {
  activeCategory = category;
  const config = categoryConfig[category];
  categoryTitle.textContent = config.title;
  categoryEyebrow.textContent = category === "comets"
    ? "JPL SMALL-BODY DATABASE · RECENT AND UPCOMING PERIHELIA"
    : "JPL SMALL-BODY DATABASE";
  objectPanel.setAttribute("aria-labelledby", `tab-${category}`);
  listSummary.textContent = config.description;
  objectList.replaceChildren();
  listStatus.hidden = false;
  listStatus.textContent = "Loading current JPL orbital data…";

  if (forceRefresh) {
    cachedObjects.delete(category);
    if (category === "comets") {
      cometForecasts.clear();
    }
  }

  isLoading = true;
  updateRefreshButton();
  try {
    const records = await fetchObjectCategory(category);
    if (activeCategory === category) {
      listSummary.textContent = `${records.length} objects shown · ${config.description}`;
      renderObjectList(records);
    }
  } catch (error) {
    console.error("Unable to load JPL small-body data.", error);
    listStatus.hidden = false;
    listStatus.textContent = `Could not load JPL object data. Check your connection and try again. ${error.message}`;
  } finally {
    isLoading = false;
    updateRefreshButton();
  }
}

function updateRefreshButton() {
  const refreshButton = document.querySelector("#refresh-list");
  refreshButton.disabled = isLoading;
  refreshButton.textContent = isLoading ? "Loading…" : "Refresh";
}

function currentLocalDateString(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function localTimeZoneOffset() {
  const minutes = -new Date().getTimezoneOffset();
  const sign = minutes < 0 ? "-" : "+";
  const absoluteMinutes = Math.abs(minutes);
  return `${sign}${String(Math.floor(absoluteMinutes / 60)).padStart(2, "0")}:${String(absoluteMinutes % 60).padStart(2, "0")}`;
}

function parseHorizonsRows(result) {
  const start = result.indexOf("$$SOE");
  const end = result.indexOf("$$EOE");
  if (start < 0 || end < start) {
    throw new Error("JPL Horizons did not return an ephemeris table.");
  }

  return result.slice(start + 5, end).split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const columns = line.split(",").map((column) => column.trim());
      return {
        time: columns[0],
        altitude: numberValue(columns[6]),
        magnitude: numberValue(columns[7]),
        elongation: numberValue(columns[11]),
      };
    });
}

async function fetchCometForecast(object) {
  if (!observingLocation) {
    throw new Error("Set a location before requesting a visibility forecast.");
  }

  const start = new Date();
  start.setHours(20, 0, 0, 0);
  if (start <= new Date()) {
    start.setDate(start.getDate() + 1);
  }
  const stop = new Date(start);
  stop.setDate(stop.getDate() + 4);
  stop.setHours(5, 0, 0, 0);
  const command = object.pdes || object.spkid;
  const params = new URLSearchParams({
    format: "json",
    COMMAND: `'DES=${command};'`,
    OBJ_DATA: "NO",
    MAKE_EPHEM: "YES",
    EPHEM_TYPE: "OBSERVER",
    CENTER: "coord@399",
    COORD_TYPE: "GEODETIC",
    SITE_COORD: `${observingLocation.longitude},${observingLocation.latitude},${observingLocation.altitude}`,
    START_TIME: `'${currentLocalDateString(start)} 20:00'`,
    STOP_TIME: `'${currentLocalDateString(stop)} 05:00'`,
    STEP_SIZE: "'1 h'",
    TIME_ZONE: `'${localTimeZoneOffset()}'`,
    QUANTITIES: "'4,9,20,23,24'",
    CSV_FORMAT: "YES",
  });
  const response = await fetch(`${HORIZONS_ENDPOINT}?${params}`);
  if (!response.ok) {
    throw new Error(`JPL Horizons request failed (${response.status} ${response.statusText}).`);
  }

  const payload = await response.json();
  if (payload.error || typeof payload.result !== "string") {
    throw new Error(payload.error || "JPL Horizons returned an unexpected response.");
  }
  return parseHorizonsRows(payload.result);
}

function renderForecast(rows) {
  const forecast = document.createElement("div");
  forecast.className = "forecast";
  const title = document.createElement("h4");
  title.textContent = "Next four evenings";
  forecast.append(title);
  const visibleRows = rows.filter((row) => row.altitude !== null && row.altitude > 0);
  if (visibleRows.length === 0) {
    const note = document.createElement("p");
    note.className = "forecast-note";
    note.textContent = "This comet stays below the horizon during the evening forecast window.";
    forecast.append(note);
    return forecast;
  }

  const bestByNight = new Map();
  for (const row of visibleRows) {
    const night = row.time.slice(0, 11);
    const currentBest = bestByNight.get(night);
    if (!currentBest || row.altitude > currentBest.altitude) {
      bestByNight.set(night, row);
    }
  }

  const list = document.createElement("ul");
  list.className = "forecast-list";
  for (const [night, row] of bestByNight) {
    const item = document.createElement("li");
    item.textContent = `${night} · highest altitude ${displayValue(row.altitude)}° · magnitude ${displayValue(row.magnitude)} · solar elongation ${displayValue(row.elongation)}°`;
    list.append(item);
  }
  forecast.append(list);
  return forecast;
}

async function loadCometForecast(object, card, button) {
  button.disabled = true;
  button.textContent = "Calculating local ephemeris…";
  const previousForecast = card.querySelector(".forecast");
  previousForecast?.remove();

  try {
    const forecast = await fetchCometForecast(object);
    cometForecasts.set(String(object.spkid), forecast);
    card.append(renderForecast(forecast));
  } catch (error) {
    console.error("Unable to calculate a comet visibility forecast.", error);
    const message = document.createElement("p");
    message.className = "forecast-note is-error";
    message.textContent = `Could not calculate this forecast. ${error.message}`;
    card.append(message);
  } finally {
    button.disabled = !observingLocation;
    button.textContent = "Check visibility from my location";
  }
}

function setLocation(latitude, longitude, label) {
  observingLocation = { latitude, longitude, altitude: 0 };
  cometForecasts.clear();
  latitudeInput.value = latitude;
  longitudeInput.value = longitude;
  locationStatus.textContent = `${label} · ${latitude.toFixed(4)}°, ${longitude.toFixed(4)}°. Coordinates are used for forecasts and are not saved.`;
  if (activeCategory === "comets" && cachedObjects.has("comets")) {
    renderObjectList(cachedObjects.get("comets"));
  }
  renderMeteorShowers();
}

function julianDate(date) {
  return date.getTime() / 86400000 + 2440587.5;
}

function radiantAltitude(raDegrees, decDegrees, date, latitude, longitude) {
  const centuries = (julianDate(date) - 2451545) / 36525;
  const gmst = (
    280.46061837 +
    360.98564736629 * (julianDate(date) - 2451545) +
    0.000387933 * centuries ** 2 -
    centuries ** 3 / 38710000
  ) % 360;
  const hourAngle = ((gmst + longitude - raDegrees + 540) % 360 - 180) * Math.PI / 180;
  const latitudeRadians = latitude * Math.PI / 180;
  const declinationRadians = decDegrees * Math.PI / 180;
  const altitudeSine = Math.sin(latitudeRadians) * Math.sin(declinationRadians)
    + Math.cos(latitudeRadians) * Math.cos(declinationRadians) * Math.cos(hourAngle);
  return Math.asin(Math.max(-1, Math.min(1, altitudeSine))) * 180 / Math.PI;
}

function nextShowerPeak(shower) {
  const now = new Date();
  let peak = new Date(now.getFullYear(), shower.month, shower.day, 2, 0, 0, 0);
  if (peak < now) {
    peak = new Date(now.getFullYear() + 1, shower.month, shower.day, 2, 0, 0, 0);
  }
  return peak;
}

function renderMeteorShowers() {
  showerList.replaceChildren();
  const showers = [...meteorShowers]
    .map((shower) => ({ ...shower, peak: nextShowerPeak(shower) }))
    .sort((first, second) => first.peak - second.peak);

  for (const shower of showers) {
    const card = document.createElement("article");
    card.className = "shower-card";
    const header = document.createElement("div");
    header.className = "shower-header";
    const title = document.createElement("h3");
    title.textContent = shower.name;
    const peak = document.createElement("span");
    peak.className = "badge";
    peak.textContent = shower.peak.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
    header.append(title, peak);
    const metrics = document.createElement("div");
    metrics.className = "shower-metrics";
    const radiant = observingLocation
      ? `${displayValue(radiantAltitude(shower.ra, shower.dec, shower.peak, observingLocation.latitude, observingLocation.longitude), 0)}° at 2 a.m.`
      : "Set a location to estimate";
    metrics.append(
      makeMetadata("Estimated peak rate", `up to ${shower.rate}/hour`),
      makeMetadata("Radiant", `${shower.ra}° RA, ${shower.dec > 0 ? "+" : ""}${shower.dec}° Dec`),
      makeMetadata("Local radiant altitude", radiant),
    );
    card.append(header, metrics);
    showerList.append(card);
  }
}

for (const tab of categoryTabs) {
  tab.addEventListener("click", () => {
    for (const candidate of categoryTabs) {
      const selected = candidate === tab;
      candidate.classList.toggle("is-active", selected);
      candidate.setAttribute("aria-selected", String(selected));
    }

    const showShowers = tab.dataset.category === "showers";
    objectPanel.hidden = showShowers;
    showerPanel.hidden = !showShowers;
    if (showShowers) {
      renderMeteorShowers();
      return;
    }
    loadCategory(tab.dataset.category);
  });
}

document.querySelector("#refresh-list").addEventListener("click", () => {
  loadCategory(activeCategory, true);
});

objectFilter.addEventListener("input", () => {
  const records = cachedObjects.get(activeCategory);
  if (records) {
    renderObjectList(records);
  }
});

locationForm.addEventListener("submit", (event) => {
  event.preventDefault();
  if (!locationForm.reportValidity()) {
    return;
  }
  setLocation(Number(latitudeInput.value), Number(longitudeInput.value), "Manual location");
});

useLocationButton.addEventListener("click", () => {
  if (!navigator.geolocation) {
    locationStatus.textContent = "This browser does not provide location services. Enter coordinates instead.";
    return;
  }

  useLocationButton.disabled = true;
  locationStatus.textContent = "Waiting for your location permission…";
  navigator.geolocation.getCurrentPosition(
    ({ coords }) => {
      setLocation(coords.latitude, coords.longitude, "Current location");
      useLocationButton.disabled = false;
    },
    (error) => {
      console.error("Unable to read browser location.", error);
      locationStatus.textContent = error.code === error.PERMISSION_DENIED
        ? "Location permission was declined. You can enter coordinates manually."
        : "Could not determine your location. You can enter coordinates manually.";
      useLocationButton.disabled = false;
    },
    { enableHighAccuracy: false, timeout: 15000, maximumAge: 300000 },
  );
});

renderMeteorShowers();
loadCategory("neos");
