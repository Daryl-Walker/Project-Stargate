const MAST_ENDPOINT = "https://mast.stsci.edu/api/v0/invoke";
const LIGHT_YEARS_PER_PARSEC = 3.26156;
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
const distanceButtons = [...document.querySelectorAll("[data-distance]")];

let stars = [];
let selectedDistance = 25;
let currentPage = 1;

function numericValue(value) {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function normalizeStar(row) {
  const id = row.ID ?? row.id;
  const distanceParsecs = numericValue(row.d);
  const ra = numericValue(row.ra);
  const dec = numericValue(row.dec);

  if (id === null || id === undefined || distanceParsecs === null || distanceParsecs <= 0) {
    return null;
  }

  return {
    id: String(id),
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
      columns: "ID,ra,dec,d,e_d",
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
  summaryElement.textContent = `${count.toLocaleString()} catalog ${count === 1 ? "star" : "stars"} shown`;
}

function makeListRow(star) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "star-row";
  button.setAttribute("aria-label", `TIC ${star.id}, ${formatNumber(star.distanceLightYears)} light-years away`);

  const id = document.createElement("span");
  id.className = "star-id";
  id.textContent = `TIC ${star.id}`;

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
  detailTitle.textContent = `TIC ${star.id}`;
  detailFields.replaceChildren();

  const distance = `${formatNumber(star.distanceLightYears)} light-years`;
  const uncertainty = star.uncertaintyParsecs === null
    ? "Not available in catalog"
    : `±${formatNumber(star.uncertaintyParsecs * LIGHT_YEARS_PER_PARSEC)} light-years`;

  addDetail("Distance", distance);
  addDetail("Distance uncertainty", uncertainty);
  addDetail("Right ascension", star.ra === null ? "Not available" : `${formatNumber(star.ra, 6)}°`);
  addDetail("Declination", star.dec === null ? "Not available" : `${formatNumber(star.dec, 6)}°`);
  detailDialog.showModal();
}

function render() {
  const filteredStars = stars.filter((star) => star.distanceLightYears <= selectedDistance);
  const pageCount = Math.max(1, Math.ceil(filteredStars.length / PAGE_SIZE));
  currentPage = Math.min(currentPage, pageCount);
  const start = (currentPage - 1) * PAGE_SIZE;

  resultsTitle.textContent = `Stars within ${selectedDistance} light-years`;
  updateSummary(filteredStars.length);
  statusElement.hidden = true;

  const rows = filteredStars.slice(start, start + PAGE_SIZE).map(makeListRow);
  resultsElement.replaceChildren(...rows);
  renderPagination(pageCount);
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

loadStars().catch((error) => {
  console.error("Unable to load the MAST TESS Input Catalog.", error);
  setStatus(
    `Could not load the NASA MAST catalog. Check your connection and try reloading. ${error.message}`,
    "error",
  );
  updateSummary();
});
