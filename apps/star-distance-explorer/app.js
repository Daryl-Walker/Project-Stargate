const MAST_ENDPOINT = "https://mast.stsci.edu/api/v0/invoke";
const SIMBAD_TAP_ENDPOINT = "https://simbad.cds.unistra.fr/simbad/sim-tap/sync";
const LIGHT_YEARS_PER_PARSEC = 3.26156;
const MAX_CROSSMATCH_SEPARATION_ARCSECONDS = 5;
const MAX_PARALLAX_CROSSMATCH_SEPARATION_ARCSECONDS = 60;
const MAX_RELATIVE_DISTANCE_DIFFERENCE = 0.2;
const MAX_DISTANCE_LIGHT_YEARS = 100;
const PAGE_SIZE = 50;
const DISTANCE_OPTIONS = [10, 25, 50, 100];

const statusElement = document.querySelector("#status");
const resultsElement = document.querySelector("#results");
const summaryElement = document.querySelector("#results-summary");
const resultsTitle = document.querySelector("#results-title");
const paginationElement = document.querySelector("#pagination");
const detailDialog = document.querySelector("#star-detail");
const detailTitle = document.querySelector("#detail-title");
const detailFields = document.querySelector("#detail-fields");
const nameSearchForm = document.querySelector("#name-search-form");
const nameSearchInput = document.querySelector("#name-search-input");
const nameSearchButton = document.querySelector("#name-search-button");
const nameSearchStatus = document.querySelector("#name-search-status");
const nameSearchResults = document.querySelector("#name-search-results");
const distanceButtons = [...document.querySelectorAll("[data-distance]")];

let stars = [];
let selectedDistance = 25;
let currentPage = 1;
let simbadLookupFailed = false;
let catalogLoaded = false;
let resolveCatalogLoaded;
const catalogLoadReady = new Promise((resolve) => {
  resolveCatalogLoaded = resolve;
});

function markCatalogLoaded() {
  catalogLoaded = true;
  resolveCatalogLoaded();
}

function numericValue(value) {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function normalizeStar(row) {
  const id = row.ID ?? row.id;
  const gaiaId = row.GAIA ?? row.gaia;
  const distanceParsecs = numericValue(row.d);
  const ra = numericValue(row.ra);
  const dec = numericValue(row.dec);

  if (id === null || id === undefined || distanceParsecs === null || distanceParsecs <= 0) {
    return null;
  }

  return {
    id: String(id),
    gaiaId: gaiaId === null || gaiaId === undefined || !/^\d+$/.test(String(gaiaId))
      ? null
      : String(gaiaId),
    commonName: null,
    simbadName: null,
    nameLookupComplete: false,
    nameLookupPending: false,
    distanceParsecs,
    distanceLightYears: distanceParsecs * LIGHT_YEARS_PER_PARSEC,
    uncertaintyParsecs: numericValue(row.e_d),
    ra,
    dec,
  };
}

async function loadStars() {
  const maxDistanceParsecs = MAX_DISTANCE_LIGHT_YEARS / LIGHT_YEARS_PER_PARSEC;
  const request = {
    service: "Mast.Catalogs.Filtered.Tic.Rows",
    params: {
      columns: "ID,GAIA,ra,dec,d,e_d",
      filters: [
        {
          paramName: "d",
          values: [{ min: 0, max: maxDistanceParsecs }],
        },
      ],
    },
    format: "json",
    removenullcolumns: true,
  };

  setStatus("Loading nearby stars from NASA MAST…", "loading");
  const response = await fetch(MAST_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ request: JSON.stringify(request) }),
  });

  if (!response.ok) {
    throw new Error(`MAST request failed (${response.status} ${response.statusText}).`);
  }

  const payload = await response.json();
  if (payload.status !== "COMPLETE") {
    throw new Error(payload.msg || `MAST returned status "${payload.status || "unknown"}".`);
  }
  if (!Array.isArray(payload.data)) {
    throw new Error("MAST returned an unexpected catalog response.");
  }

  stars = payload.data
    .map(normalizeStar)
    .filter((star) => star !== null && star.distanceLightYears <= MAX_DISTANCE_LIGHT_YEARS)
    .sort((first, second) => first.distanceLightYears - second.distanceLightYears);
  markCatalogLoaded();

  if (stars.length === 0) {
    setStatus("The catalog query succeeded, but it returned no stars with a usable distance.", "empty");
    updateSummary();
    return;
  }

  render();
}

function setStatus(message, state) {
  statusElement.replaceChildren();
  statusElement.className = `status${state === "error" ? " is-error" : ""}`;
  statusElement.hidden = false;

  if (state === "loading") {
    const spinner = document.createElement("span");
    spinner.className = "loading-spinner";
    spinner.setAttribute("aria-hidden", "true");
    statusElement.append(spinner);
  }

  const text = document.createElement("span");
  text.textContent = message;
  statusElement.append(text);
  resultsElement.replaceChildren();
  paginationElement.hidden = true;
}

function formatNumber(value, digits = 2) {
  if (value === null) {
    return "Not available";
  }
  return new Intl.NumberFormat(undefined, { maximumFractionDigits: digits }).format(value);
}

function updateSummary(count = 0) {
  const lookupStatus = simbadLookupFailed ? " · SIMBAD names unavailable" : "";
  summaryElement.textContent = `${count.toLocaleString()} catalog ${count === 1 ? "star" : "stars"} shown${lookupStatus}`;
}

function makeListRow(star) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "star-row";
  const name = star.commonName || star.simbadName || `TIC ${star.id}`;
  button.setAttribute(
    "aria-label",
    `${name}${star.simbadName ? `, TIC ${star.id}` : ""}, ${formatNumber(star.distanceLightYears)} light-years away`,
  );

  const id = document.createElement("span");
  id.className = "star-id";
  id.textContent = name;
  id.title = name;

  const distance = document.createElement("span");
  distance.className = "star-value";
  const distanceLabel = document.createElement("span");
  distanceLabel.className = "star-label";
  distanceLabel.textContent = "Distance";
  const distanceValue = document.createElement("span");
  distanceValue.textContent = `${formatNumber(star.distanceLightYears)} ly`;
  distance.append(distanceLabel, distanceValue);

  const coordinates = document.createElement("span");
  coordinates.className = "star-value star-coordinates";
  const coordinatesLabel = document.createElement("span");
  coordinatesLabel.className = "star-label";
  coordinatesLabel.textContent = "Sky coordinates";
  const coordinatesValue = document.createElement("span");
  coordinatesValue.textContent = `${formatNumber(star.ra, 3)}°, ${formatNumber(star.dec, 3)}°`;
  coordinates.append(coordinatesLabel, coordinatesValue);

  const arrow = document.createElement("span");
  arrow.className = "row-arrow";
  arrow.setAttribute("aria-hidden", "true");
  arrow.textContent = "→";

  button.append(id, distance, coordinates, arrow);
  button.addEventListener("click", () => showDetails(star));
  return button;
}

function addDetail(label, value) {
  const row = document.createElement("div");
  const term = document.createElement("dt");
  term.textContent = label;
  const description = document.createElement("dd");
  description.textContent = value;
  row.append(term, description);
  detailFields.append(row);
}

function showDetails(star) {
  detailTitle.textContent = star.commonName || star.simbadName || (star.id ? `TIC ${star.id}` : "Star details");
  detailFields.replaceChildren();

  const distance = star.distanceLightYears === null
    ? "Not available"
    : `${formatNumber(star.distanceLightYears)} light-years`;
  const uncertainty = star.uncertaintyParsecs === null
    ? "Not available"
    : `±${formatNumber(star.uncertaintyParsecs * LIGHT_YEARS_PER_PARSEC)} light-years`;
  const distanceSource = star.distanceMatchMethod === "SIMBAD parallax"
    ? "SIMBAD parallax"
    : star.distanceMatchMethod
      ? `TIC (${star.distanceMatchMethod} cross-match)`
      : star.id
        ? "TIC catalog"
        : "Not available";
  const parallax = star.parallaxMas === null || star.parallaxMas === undefined
    ? "Not available"
    : `${formatNumber(star.parallaxMas, 4)} mas`;
  const parallaxUncertainty = star.parallaxErrorMas === null || star.parallaxErrorMas === undefined
    ? "Not available"
    : `±${formatNumber(star.parallaxErrorMas, 4)} mas`;

  addDetail("Common name", star.commonName || "Not available");
  addDetail("SIMBAD identifier", star.simbadName || "Not available");
  addDetail("Distance", distance);
  addDetail("Distance uncertainty", uncertainty);
  addDetail("Distance source", distanceSource);
  addDetail("Distance parallax", parallax);
  addDetail("Parallax uncertainty", parallaxUncertainty);
  addDetail("TIC ID", star.id || "Not available");
  addDetail("Gaia DR2 ID", star.gaiaId || "Not available");
  addDetail(
    "Right ascension",
    star.ra === null || star.ra === undefined ? "Not available" : `${formatNumber(star.ra, 6)}°`,
  );
  addDetail(
    "Declination",
    star.dec === null || star.dec === undefined ? "Not available" : `${formatNumber(star.dec, 6)}°`,
  );
  detailDialog.showModal();
}

function submitSimbadQuery(query) {
  return fetch(SIMBAD_TAP_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      REQUEST: "doQuery",
      LANG: "ADQL",
      FORMAT: "json",
      QUERY: query,
    }),
  });
}

function angularSeparationArcseconds(firstRa, firstDec, secondRa, secondDec) {
  const radians = Math.PI / 180;
  const firstDecRadians = firstDec * radians;
  const secondDecRadians = secondDec * radians;
  const deltaRa = (secondRa - firstRa) * radians;
  const deltaDec = (secondDec - firstDec) * radians;
  const haversine = Math.sin(deltaDec / 2) ** 2
    + Math.cos(firstDecRadians) * Math.cos(secondDecRadians) * Math.sin(deltaRa / 2) ** 2;

  return 2 * Math.asin(Math.min(1, Math.sqrt(haversine))) / radians * 3600;
}

function findCatalogMatch(gaiaId, ra, dec, parallaxMas) {
  if (gaiaId !== null) {
    const identifierMatch = stars.find((star) => star.gaiaId === gaiaId);
    if (identifierMatch) {
      return { star: identifierMatch, method: "Gaia ID" };
    }
  }

  if (ra === null || dec === null) {
    return null;
  }

  const hasParallax = parallaxMas !== null && parallaxMas > 0;
  const expectedDistanceParsecs = hasParallax ? 1000 / parallaxMas : null;
  const maxSeparation = hasParallax
    ? MAX_PARALLAX_CROSSMATCH_SEPARATION_ARCSECONDS
    : MAX_CROSSMATCH_SEPARATION_ARCSECONDS;
  let nearestMatch = null;
  let nearestSeparation = maxSeparation;
  for (const star of stars) {
    if (star.ra === null || star.dec === null) {
      continue;
    }

    const separation = angularSeparationArcseconds(ra, dec, star.ra, star.dec);
    if (
      hasParallax &&
      Math.abs(star.distanceParsecs - expectedDistanceParsecs) / expectedDistanceParsecs
        > MAX_RELATIVE_DISTANCE_DIFFERENCE
    ) {
      continue;
    }
    if (separation < nearestSeparation) {
      nearestMatch = star;
      nearestSeparation = separation;
    }
  }

  return nearestMatch
    ? { star: nearestMatch, method: hasParallax ? "coordinate and parallax" : "coordinate" }
    : null;
}

function makeSearchResultStar(row) {
  const [mainIdentifier, raValue, decValue, parallaxValue, parallaxErrorValue, matchedName, gaiaIdentifier] = row;
  if (
    typeof mainIdentifier !== "string" ||
    typeof matchedName !== "string" ||
    !matchedName.startsWith("NAME ")
  ) {
    return null;
  }

  const gaiaMatch = typeof gaiaIdentifier === "string"
    ? gaiaIdentifier.match(/^Gaia DR2 (\d+)$/)
    : null;
  const gaiaId = gaiaMatch ? gaiaMatch[1] : null;
  const ra = numericValue(raValue);
  const dec = numericValue(decValue);
  const parallaxMas = numericValue(parallaxValue);
  const parallaxErrorMas = numericValue(parallaxErrorValue);
  const catalogMatch = findCatalogMatch(gaiaId, ra, dec, parallaxMas);
  const localStar = catalogMatch?.star ?? null;
  const hasUsableParallax = parallaxMas !== null && parallaxMas > 0;
  const simbadDistanceParsecs = hasUsableParallax ? 1000 / parallaxMas : null;
  const simbadDistanceLightYears = simbadDistanceParsecs === null
    ? null
    : simbadDistanceParsecs * LIGHT_YEARS_PER_PARSEC;
  const simbadUncertaintyParsecs = hasUsableParallax && parallaxErrorMas !== null
    ? (1000 * parallaxErrorMas) / (parallaxMas ** 2)
    : null;

  return {
    id: localStar?.id ?? null,
    gaiaId: gaiaId ?? localStar?.gaiaId ?? null,
    commonName: matchedName.slice(5),
    simbadName: mainIdentifier,
    simbadRow: row,
    distanceMatchMethod: catalogMatch?.method ?? (hasUsableParallax ? "SIMBAD parallax" : null),
    parallaxMas,
    parallaxErrorMas,
    distanceLightYears: localStar?.distanceLightYears ?? simbadDistanceLightYears,
    uncertaintyParsecs: localStar?.uncertaintyParsecs ?? simbadUncertaintyParsecs,
    ra: localStar?.ra ?? ra,
    dec: localStar?.dec ?? dec,
  };
}

function renderNameSearchResults(rows) {
  nameSearchResults.replaceChildren();
  const matches = rows
    .map(makeSearchResultStar)
    .filter((star) => star !== null);

  if (matches.length === 0) {
    nameSearchStatus.textContent = "No exact common-name match found. Try another name or spelling.";
    nameSearchResults.hidden = true;
    return;
  }

  nameSearchStatus.textContent = `${matches.length} ${matches.length === 1 ? "match" : "matches"} found.`;
  for (const star of matches) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "name-search-result";

    const commonName = document.createElement("span");
    commonName.className = "name-search-result-title";
    commonName.textContent = star.commonName;

    const identifier = document.createElement("span");
    identifier.className = "name-search-result-identifier";
    identifier.textContent = star.simbadName;

    const coordinates = document.createElement("span");
    coordinates.className = "name-search-result-coordinates";
    coordinates.textContent = `${formatNumber(star.ra, 3)}°, ${formatNumber(star.dec, 3)}°`;

    button.append(commonName, identifier, coordinates);
    button.addEventListener("click", async () => {
      button.disabled = true;
      if (!catalogLoaded) {
        nameSearchStatus.textContent = "Waiting for TIC distance data…";
        await catalogLoadReady;
      }
      showDetails(makeSearchResultStar(star.simbadRow));
      button.disabled = false;
      nameSearchStatus.textContent = `${matches.length} ${matches.length === 1 ? "match" : "matches"} found.`;
    });
    nameSearchResults.append(button);
  }
  nameSearchResults.hidden = false;
}

async function searchByCommonName(event) {
  event.preventDefault();
  const name = nameSearchInput.value.trim();
  if (name.length < 2) {
    nameSearchStatus.textContent = "Enter at least two characters to search.";
    return;
  }

  nameSearchButton.disabled = true;
  nameSearchStatus.textContent = "Searching SIMBAD…";
  nameSearchResults.replaceChildren();
  nameSearchResults.hidden = true;

  try {
    const escapedName = name.replace(/'/g, "''");
    const commonName = `NAME ${escapedName}`;
    const query = [
      "SELECT TOP 10 basic.main_id, basic.ra, basic.dec, basic.plx_value, basic.plx_err, ident.id, gaia.id",
      "FROM ident",
      "JOIN basic ON ident.oidref = basic.oid",
      "LEFT OUTER JOIN ident AS gaia ON gaia.oidref = basic.oid AND gaia.id LIKE 'Gaia DR2 %'",
      `WHERE ident.id = '${commonName}'`,
    ].join(" ");
    const response = await submitSimbadQuery(query);
    if (!response.ok) {
      throw new Error(`SIMBAD request failed (${response.status} ${response.statusText}).`);
    }

    const payload = await response.json();
    if (!Array.isArray(payload.data)) {
      throw new Error("SIMBAD returned an unexpected catalog response.");
    }
    renderNameSearchResults(payload.data);
  } catch (error) {
    console.error("Unable to search SIMBAD by common name.", error);
    nameSearchStatus.textContent = "Could not search SIMBAD. Check your connection and try again.";
  } finally {
    nameSearchButton.disabled = false;
  }
}

function render() {
  const filteredStars = stars.filter((star) => star.distanceLightYears <= selectedDistance);
  const pageCount = Math.max(1, Math.ceil(filteredStars.length / PAGE_SIZE));
  currentPage = Math.min(currentPage, pageCount);
  const start = (currentPage - 1) * PAGE_SIZE;

  resultsTitle.textContent = `Stars within ${selectedDistance} light-years`;
  updateSummary(filteredStars.length);
  statusElement.hidden = true;

  const pageStars = filteredStars.slice(start, start + PAGE_SIZE);
  const rows = pageStars.map(makeListRow);
  resultsElement.replaceChildren(...rows);
  renderPagination(pageCount);
  resolveSimbadNames(pageStars);
}

async function resolveSimbadNames(pageStars) {
  const candidates = pageStars.filter((star) => (
    star.gaiaId !== null && !star.nameLookupComplete && !star.nameLookupPending
  ));
  if (candidates.length === 0) {
    return;
  }

  for (const star of candidates) {
    star.nameLookupPending = true;
  }

  const starsByGaiaId = new Map(candidates.map((star) => [star.gaiaId, star]));
  const identifiers = candidates
    .map((star) => `'Gaia DR2 ${star.gaiaId}'`)
    .join(", ");
  const query = `SELECT ident.id, basic.main_id FROM ident JOIN basic ON ident.oidref = basic.oid WHERE ident.id IN (${identifiers})`;

  try {
    const response = await fetch(SIMBAD_TAP_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        REQUEST: "doQuery",
        LANG: "ADQL",
        FORMAT: "json",
        QUERY: query,
      }),
    });

    if (!response.ok) {
      throw new Error(`SIMBAD request failed (${response.status} ${response.statusText}).`);
    }

    const payload = await response.json();
    if (!Array.isArray(payload.data)) {
      throw new Error("SIMBAD returned an unexpected catalog response.");
    }

    for (const [identifier, mainIdentifier] of payload.data) {
      const match = typeof identifier === "string"
        ? identifier.match(/^Gaia DR2 (\d+)$/)
        : null;
      const star = match ? starsByGaiaId.get(match[1]) : null;
      if (
        star &&
        typeof mainIdentifier === "string" &&
        mainIdentifier.trim() !== "" &&
        mainIdentifier !== identifier
      ) {
        star.simbadName = mainIdentifier.trim();
      }
    }
  } catch (error) {
    simbadLookupFailed = true;
    console.error("Unable to resolve TIC stars with SIMBAD.", error);
  } finally {
    for (const star of candidates) {
      star.nameLookupPending = false;
      star.nameLookupComplete = true;
    }
    updateSummary(stars.filter((star) => star.distanceLightYears <= selectedDistance).length);
    render();
  }
}

function renderPagination(pageCount) {
  paginationElement.replaceChildren();
  if (pageCount <= 1) {
    paginationElement.hidden = true;
    return;
  }

  const previous = document.createElement("button");
  previous.type = "button";
  previous.textContent = "Previous";
  previous.disabled = currentPage === 1;
  previous.addEventListener("click", () => {
    currentPage -= 1;
    render();
  });

  const pageLabel = document.createElement("span");
  pageLabel.textContent = `Page ${currentPage} of ${pageCount}`;

  const next = document.createElement("button");
  next.type = "button";
  next.textContent = "Next";
  next.disabled = currentPage === pageCount;
  next.addEventListener("click", () => {
    currentPage += 1;
    render();
  });

  paginationElement.append(previous, pageLabel, next);
  paginationElement.hidden = false;
}

for (const button of distanceButtons) {
  button.addEventListener("click", () => {
    selectedDistance = Number(button.dataset.distance);
    currentPage = 1;

    for (const option of distanceButtons) {
      const selected = option === button;
      option.classList.toggle("is-selected", selected);
      option.setAttribute("aria-pressed", String(selected));
    }

    if (stars.length > 0) {
      render();
    }
  });
}

nameSearchForm.addEventListener("submit", searchByCommonName);

loadStars().catch((error) => {
  markCatalogLoaded();
  console.error("Unable to load the MAST TESS Input Catalog.", error);
  setStatus(
    `Could not load the NASA MAST catalog. Check your connection and try reloading. ${error.message}`,
    "error",
  );
  updateSummary();
});
