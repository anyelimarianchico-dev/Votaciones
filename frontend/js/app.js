const formatNumber = new Intl.NumberFormat("es-CO");
const storageKeys = {
  journey: "sena_journey",
  selection: "sena_vote_selection",
  confirmation: "sena_vote_confirmation",
  votes: "sena_vote_counts_v2",
};

const localBackendOrigin = "http://127.0.0.1:5000";
const staticDataVersion = "2026-08-14-photos";
const requestTimeoutMs = 30000;
const adminAccessKey = "Adminos_2026";
let firebaseServicePromise;

function isApiPath(url) {
  return typeof url === "string" && url.startsWith("/api/");
}

function apiEndpoint(url) {
  if (!isApiPath(url)) return url;
  const isFlaskOrigin = ["127.0.0.1:5000", "localhost:5000"].includes(window.location.host);
  return isFlaskOrigin ? url : `${localBackendOrigin}${url}`;
}

function adminLoginUrl(nextPage = "admin.html") {
  const isFlaskOrigin = ["127.0.0.1:5000", "localhost:5000"].includes(window.location.host);
  const base = isFlaskOrigin ? "" : ".";
  return `${base}/admin-login.html?next=${encodeURIComponent(nextPage)}`;
}

async function fetchWithTimeout(url, options = {}) {
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), requestTimeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    window.clearTimeout(timeoutId);
  }
}

function adminRequestHeaders() {
  const headers = {};
  const adminKey = sessionStorage.getItem("sena_admin_key")
    || (sessionStorage.getItem("sena_admin_authenticated") === "true" ? adminAccessKey : "");
  if (adminKey) {
    headers["X-Admin-Key"] = adminKey;
  }
  return headers;
}

const fallbackCandidates = [
  {
    id: "ruth",
    number: "01",
    name: "Ruth",
    journey: "Diurna",
    ficha: "",
    program: "sistemas",
    program_label: "Tecnólogo en Análisis y Desarrollo de Software",
    photo: "",
    proposal: "",
  },
  {
    id: "carlos",
    number: "02",
    name: "Carlos Gómez",
    journey: "Mixta",
    ficha: "",
    program: "contabilidad",
    program_label: "Técnico en Contabilización de Operaciones",
    photo: "",
    proposal: "",
  },
  {
    id: "diana",
    number: "03",
    name: "Diana Ruiz",
    journey: "Virtual",
    ficha: "",
    program: "sistemas",
    program_label: "Tecnólogo en Análisis y Desarrollo de Software",
    photo: "",
    proposal: "",
  },
  {
    id: "andres",
    number: "04",
    name: "Andrés Vargas",
    journey: "Diurna",
    ficha: "",
    program: "contabilidad",
    program_label: "Técnico en Contabilización de Operaciones",
    photo: "",
    proposal: "",
  },
  {
    id: "blanco",
    number: "--",
    name: "Voto en Blanco",
    journey: "Todas",
    ficha: "",
    program: "todos",
    program_label: "Todos los programas",
    photo: "",
    proposal: "El voto en blanco permite participar sin apoyar una candidatura específica.",
  },
];

const initialVotes = { ruth: 0, carlos: 0, diana: 0, andres: 0, blanco: 0 };

function localVotes() {
  try {
    return JSON.parse(localStorage.getItem(storageKeys.votes) || "null") || { ...initialVotes };
  } catch {
    return { ...initialVotes };
  }
}

async function staticCandidates() {
  try {
    const response = await fetch(`data/candidates.json?v=${staticDataVersion}`, { cache: "no-store" });
    if (response.ok) return response.json();
  } catch {
    // The hard-coded list below is only used when the static data file is not available.
  }
  return fallbackCandidates;
}

function buildFallbackResults(candidateSource = fallbackCandidates) {
  const votes = localVotes();
  const total = Object.values(votes).reduce((sum, value) => sum + value, 0);
  const candidates = candidateSource
    .map((candidate) => ({
      ...candidate,
      votes: votes[candidate.id] || 0,
      percentage: total ? Math.round(((votes[candidate.id] || 0) / total) * 1000) / 10 : 0,
    }))
    .sort((a, b) => b.votes - a.votes);

  return {
    total,
    last_update: new Date().toLocaleString("es-CO"),
    candidates,
    participation: ["Diurna", "Mixta", "Virtual"].map((journey) => {
      const count = candidateSource
        .filter((candidate) => candidate.journey === journey)
        .reduce((sum, candidate) => sum + (votes[candidate.id] || 0), 0);
      return {
        label: `Jornada ${journey}`,
        votes: count,
        percentage: total ? Math.round((count / total) * 1000) / 10 : 0,
      };
    }),
  };
}

function firebaseService() {
  if (!firebaseServicePromise) {
    firebaseServicePromise = import("./firebase-service.js").catch(() => null);
  }
  return firebaseServicePromise;
}

function buildResultsFromVotes(candidateSource, votes) {
  const counts = { ...initialVotes };
  candidateSource.forEach((candidate) => {
    counts[candidate.id] = counts[candidate.id] || 0;
  });

  votes.forEach((vote) => {
    const candidateId = vote.candidate_id;
    if (candidateId in counts) {
      counts[candidateId] += 1;
    }
  });

  const total = Object.values(counts).reduce((sum, value) => sum + value, 0);
  const candidates = candidateSource
    .map((candidate) => ({
      ...candidate,
      votes: counts[candidate.id] || 0,
      percentage: total ? Math.round(((counts[candidate.id] || 0) / total) * 1000) / 10 : 0,
    }))
    .sort((a, b) => b.votes - a.votes);

  return {
    total,
    last_update: new Date().toLocaleString("es-CO"),
    last_vote_id: votes.length,
    candidates,
    participation: ["Diurna", "Mixta", "Virtual"].map((journey) => {
      const count = votes.filter((vote) => vote.journey === journey).length;
      return {
        label: `Jornada ${journey}`,
        votes: count,
        percentage: total ? Math.round((count / total) * 1000) / 10 : 0,
      };
    }),
    vote_records: votes,
  };
}

async function firebaseResponse(url, options = {}) {
  let service;
  try {
    service = await firebaseService();
  } catch {
    return null;
  }
  if (!service?.firebaseIsReady()) return null;

  try {
    const candidates = await staticCandidates();
    if (url.includes("/api/candidates") && (!options.method || options.method === "GET")) {
      return service.loadCandidatesFromFirebase(candidates);
    }
    if (url.includes("/api/candidates/") && options.method === "DELETE") {
      const candidateId = decodeURIComponent(url.split("/").pop());
      const candidate = await service.deleteCandidateFromFirebase(candidateId);
      return { message: "Candidato eliminado", candidate };
    }
    if (url.includes("/api/candidates")) {
      const currentCandidates = await service.loadCandidatesFromFirebase(candidates);
      const payload = JSON.parse(options.body || "{}");
      const candidateId = url.includes("/api/candidates/") ? decodeURIComponent(url.split("/").pop()) : "";
      const candidate = await service.saveCandidateToFirebase(payload, currentCandidates, candidateId);
      return {
        message: candidateId ? "Candidato actualizado" : "Candidato creado",
        candidate,
      };
    }
    if (url.includes("/api/vote") && options.method === "POST") {
      const payload = JSON.parse(options.body || "{}");
      const vote = await service.saveVoteToFirebase(payload);
      const votes = await service.loadVotesFromFirebase();
      return {
        message: "Voto registrado correctamente en Firebase",
        vote,
        results: buildResultsFromVotes(candidates, votes),
      };
    }
    if (url.includes("/api/results") || url.includes("/api/reports")) {
      const votes = await service.loadVotesFromFirebase();
      return buildResultsFromVotes(candidates, votes);
    }
  } catch (error) {
    console.error(error);
  }
  return null;
}

async function fallbackResponse(url, options = {}) {
  if (url.includes("/api/candidates") && ["POST", "PUT", "DELETE"].includes(options.method)) {
    throw new Error("Para administrar candidatos, inicia el backend Flask.");
  }
  const candidates = await staticCandidates();
  if (url.includes("/api/candidates")) return candidates;
  if (url.includes("/api/results") || url.includes("/api/reports")) return buildFallbackResults(candidates);
  if (url.includes("/api/vote") && options.method === "POST") {
    const payload = JSON.parse(options.body || "{}");
    const votes = localVotes();
    votes[payload.candidate_id] = (votes[payload.candidate_id] || 0) + 1;
    localStorage.setItem(storageKeys.votes, JSON.stringify(votes));
    return {
      message: "Voto registrado en modo demostración",
      vote: { id: Date.now(), demo: true },
      results: buildFallbackResults(candidates),
    };
  }
  throw new Error("No hay datos disponibles");
}

async function getJson(url, options = {}) {
  if (isApiPath(url)) {
    const firebaseData = await firebaseResponse(url, options);
    if (firebaseData) return firebaseData;
  }

  let response;
  try {
    const headers = { "Content-Type": "application/json", ...adminRequestHeaders(), ...(options.headers || {}) };
    response = await fetchWithTimeout(apiEndpoint(url), {
      credentials: "include",
      cache: "no-store",
      ...options,
      headers,
    });
  } catch {
    return fallbackResponse(url, options);
  }

  if (!response.ok) {
    if (response.status === 401) {
      throw new Error("Clave de acceso requerida");
    }
    const error = await response.json().catch(() => ({ message: "Error de servidor" }));
    throw new Error(error.message || "Error de servidor");
  }

  return response.json();
}

function setActiveNav() {
  const path = window.location.pathname.split("/").pop() || "index.html";
  document.querySelectorAll("[data-nav]").forEach((link) => {
    const target = link.getAttribute("href").split("/").pop() || "index.html";
    const isActive = path === target;
    const isHome = path === "index.html" && target === "index.html";
    link.classList.toggle("active", isHome || isActive);
  });
}

function initJourneySelection() {
  const cards = document.querySelectorAll(".journey-card");
  const continueBtn = document.querySelector("#continueBtn");
  const selectedBox = document.querySelector("#selectedJourneyBox");
  const selectedName = document.querySelector("#selectedJourneyName");
  if (!cards.length || !continueBtn) return;

  const applySelection = (journey) => {
    cards.forEach((item) => item.classList.toggle("selected", item.dataset.journey === journey));
    localStorage.setItem(storageKeys.journey, journey);
    continueBtn.classList.remove("disabled");
    continueBtn.removeAttribute("aria-disabled");
    if (selectedName) selectedName.textContent = journey;
    if (selectedBox) selectedBox.classList.remove("d-none");
  };

  const savedJourney = localStorage.getItem(storageKeys.journey);
  if (savedJourney) applySelection(savedJourney);

  cards.forEach((card) => {
    card.addEventListener("click", () => applySelection(card.dataset.journey));
  });
}

function candidateMarkup(candidate) {
  const isBlank = candidate.id === "blanco";
  const media = candidate.photo
    ? `<span class="candidate-photo-frame"><img class="candidate-photo" src="${versionedPhotoUrl(candidate)}" alt="Fotografía de ${candidate.name}" style="${candidateImageStyle(candidate)}" onerror="this.style.display='none'; this.nextElementSibling.style.opacity='1';"><span class="photo-fallback-text">${initials(candidate.name)}</span></span>`
    : `<span class="candidate-photo-frame candidate-placeholder">${isBlank ? '<i class="bi bi-check2-square fs-1"></i>' : initials(candidate.name)}</span>`;

  return `
    <div class="col-md-6 col-xl-4">
      <article class="candidate-card">
        <label class="d-block">
          <input class="visually-hidden" type="radio" name="candidate" value="${candidate.id}">
          <div class="d-flex align-items-center gap-3 mb-4">
            ${media}
            <div>
            <span class="eyebrow">${isBlank ? "Opción" : `Candidato #${candidate.number}`}</span>
              <h2 class="h4 mb-1">${candidate.name}</h2>
              <small class="text-secondary">${candidate.journey} · ${candidate.program_label}</small>
            </div>
          </div>
        </label>
        <div class="d-grid gap-2">
          <button class="btn btn-outline-dark view-profile" type="button" data-candidate="${candidate.id}">
            <i class="bi bi-file-earmark-text me-2"></i>Ver propuesta
          </button>
          <button class="btn btn-outline-success select-candidate" type="button" data-candidate="${candidate.id}">
            <i class="bi bi-check2-circle me-2"></i>Seleccionar
          </button>
        </div>
      </article>
    </div>
  `;
}

function candidateProposal(candidate) {
  return candidate.proposal?.trim() || "Propuesta no registrada en el sistema.";
}

async function initSimpleVotingPage() {
  const root = document.querySelector("#simpleVotingPage");
  const grid = document.querySelector("#simpleCandidateGrid");
  const continueButton = document.querySelector("#simpleContinueVote");
  if (!root || !grid || !continueButton) return;

  const journeyButtons = Array.from(document.querySelectorAll(".simple-journey-btn"));
  const journeyLabel = document.querySelector("#simpleJourneyLabel");
  const selectedName = document.querySelector("#simpleSelectedCandidate");
  const selectedDetail = document.querySelector("#simpleSelectedDetail");
  const reviewPanel = document.querySelector("#simpleReviewPanel");
  const confirmationPanel = document.querySelector("#simpleConfirmationPanel");
  const confirmButton = document.querySelector("#simpleConfirmVote");
  const editButton = document.querySelector("#simpleEditVote");

  let selectedJourney = localStorage.getItem(storageKeys.journey) || "Diurna";
  let selectedCandidate = null;
  let allCandidates = await getJson("/api/candidates");
  let candidateSignature = JSON.stringify(allCandidates.map((candidate) => [
    candidate.id,
    candidate.name,
    candidate.journey,
    candidate.program_label,
    candidate.photo,
    candidate.photo_position,
    candidate.photo_size,
    candidate.proposal,
  ]));

  const resetSelection = (hideConfirmation = true) => {
    selectedCandidate = null;
    continueButton.disabled = true;
    selectedName.textContent = "Selecciona un candidato";
    selectedDetail.textContent = "Todavía no hay una opción marcada.";
    reviewPanel?.classList.add("d-none");
    if (hideConfirmation) confirmationPanel?.classList.add("d-none");
  };

  const candidatesForJourney = () => [
    ...allCandidates.filter((candidate) => candidate.id !== "blanco" && candidate.journey === selectedJourney),
    ...allCandidates.filter((candidate) => candidate.id === "blanco"),
  ];

  const renderCandidates = (preserveSelection = false) => {
    const previousCandidateId = selectedCandidate?.id || "";
    const candidates = candidatesForJourney();
    journeyLabel.textContent = `Jornada ${selectedJourney}`;
    journeyButtons.forEach((button) => button.classList.toggle("active", button.dataset.journey === selectedJourney));
    grid.innerHTML = candidates.map(candidateMarkup).join("");
    if (preserveSelection && previousCandidateId && candidates.some((candidate) => candidate.id === previousCandidateId)) {
      selectCandidate(previousCandidateId);
    } else {
      resetSelection();
    }
  };

  const selectCandidate = (candidateId) => {
    selectedCandidate = candidatesForJourney().find((candidate) => candidate.id === candidateId);
    if (!selectedCandidate) return;
    root.querySelectorAll(".candidate-card").forEach((card) => card.classList.remove("selected"));
    const radio = root.querySelector(`input[value="${candidateId}"]`);
    radio.checked = true;
    radio.closest(".candidate-card").classList.add("selected");
    selectedName.textContent = selectedCandidate.name;
    selectedDetail.textContent = `${selectedCandidate.journey} · ${selectedCandidate.program_label}`;
    continueButton.disabled = false;
    confirmationPanel?.classList.add("d-none");
  };

  journeyButtons.forEach((button) => {
    button.addEventListener("click", () => {
      selectedJourney = button.dataset.journey;
      localStorage.setItem(storageKeys.journey, selectedJourney);
      renderCandidates();
    });
  });

  grid.addEventListener("click", (event) => {
    const selectButton = event.target.closest(".select-candidate");
    const profileButton = event.target.closest(".view-profile");

    if (selectButton) {
      selectCandidate(selectButton.dataset.candidate);
    }

    if (profileButton) {
      const candidate = candidatesForJourney().find((item) => item.id === profileButton.dataset.candidate);
      const modal = document.querySelector("#proposalModal");
      if (!candidate || !modal) return;
      modal.querySelector(".modal-title").textContent = candidate.name;
      modal.querySelector("#proposalText").textContent = candidateProposal(candidate);
      bootstrap.Modal.getOrCreateInstance(modal).show();
    }
  });

  continueButton.addEventListener("click", () => {
    if (!selectedCandidate || !reviewPanel) return;
    document.querySelector("#simpleReviewCandidate").textContent = selectedCandidate.name;
    document.querySelector("#simpleReviewProposal").textContent = candidateProposal(selectedCandidate);
    reviewPanel.classList.remove("d-none");
    reviewPanel.scrollIntoView({ behavior: "smooth", block: "nearest" });
  });

  editButton?.addEventListener("click", () => {
    reviewPanel?.classList.add("d-none");
    root.scrollIntoView({ behavior: "smooth", block: "start" });
  });

  confirmButton?.addEventListener("click", async () => {
    if (!selectedCandidate) return;
    const originalLabel = confirmButton.innerHTML;
    confirmButton.disabled = true;
    confirmButton.innerHTML = `<span class="spinner-border spinner-border-sm me-2" aria-hidden="true"></span>Guardando`;

    try {
      const response = await getJson("/api/vote", {
        method: "POST",
        body: JSON.stringify({
          candidate_id: selectedCandidate.id,
          journey: selectedJourney,
          program: selectedCandidate.program,
        }),
      });
      const ticket = response.vote?.id ? `SV-${String(response.vote.id).padStart(6, "0")}` : `SV-${Date.now().toString().slice(-8)}`;
      document.querySelector("#simpleTicketNumber").textContent = ticket;
      resetSelection(false);
      renderCandidates();
      confirmationPanel?.classList.remove("d-none");
      confirmationPanel?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    } catch (error) {
      window.alert(`No se pudo guardar el voto: ${error.message}`);
    } finally {
      confirmButton.disabled = false;
      confirmButton.innerHTML = originalLabel;
    }
  });

  const refreshCandidateCards = async () => {
    try {
      const nextCandidates = await getJson("/api/candidates");
      const nextSignature = JSON.stringify(nextCandidates.map((candidate) => [
        candidate.id,
        candidate.name,
        candidate.journey,
        candidate.program_label,
        candidate.photo,
        candidate.photo_position,
        candidate.photo_size,
        candidate.proposal,
      ]));
      if (nextSignature === candidateSignature) return;
      allCandidates = nextCandidates;
      candidateSignature = nextSignature;
      renderCandidates(Boolean(selectedCandidate));
    } catch (error) {
      console.error(error);
    }
  };

  renderCandidates();
  window.setInterval(refreshCandidateCards, 5000);
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) refreshCandidateCards();
  });
}

async function initVotingForm() {
  const grid = document.querySelector("#candidateGrid");
  const form = document.querySelector("#votingForm");
  if (!grid || !form) return;

  const submitBtn = form.querySelector("button[type='submit']");
  const journeyLabel = document.querySelector("#journeyLabel");
  const selectedJourney = localStorage.getItem(storageKeys.journey) || "Diurna";
  if (journeyLabel) journeyLabel.textContent = selectedJourney;

  const allCandidates = await getJson("/api/candidates");
  const candidates = [
    ...allCandidates.filter((candidate) => candidate.id !== "blanco" && candidate.journey === selectedJourney),
    ...allCandidates.filter((candidate) => candidate.id === "blanco"),
  ];
  if (!candidates.length) {
    grid.innerHTML = `
      <div class="col-12">
        <div class="alert alert-warning mb-0">No hay candidatos registrados para esta jornada.</div>
      </div>
    `;
    return;
  }
  grid.innerHTML = candidates.map(candidateMarkup).join("");

  const selectCandidate = (candidateId) => {
    const radio = form.querySelector(`input[value="${candidateId}"]`);
    if (!radio) return;
    radio.checked = true;
    document.querySelectorAll(".candidate-card").forEach((card) => card.classList.remove("selected"));
    radio.closest(".candidate-card").classList.add("selected");
    submitBtn.disabled = false;
  };

  grid.addEventListener("click", (event) => {
    const selectButton = event.target.closest(".select-candidate");
    const profileButton = event.target.closest(".view-profile");

    if (selectButton) {
      selectCandidate(selectButton.dataset.candidate);
    }

    if (profileButton) {
      const candidate = candidates.find((item) => item.id === profileButton.dataset.candidate);
      const modal = document.querySelector("#proposalModal");
      if (!candidate || !modal) return;
      modal.querySelector(".modal-title").textContent = candidate.name;
      modal.querySelector("#proposalText").textContent = candidateProposal(candidate);
      bootstrap.Modal.getOrCreateInstance(modal).show();
    }
  });

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const selected = form.querySelector("input[name='candidate']:checked");
    if (!selected) return;

    const candidate = candidates.find((item) => item.id === selected.value);
    localStorage.setItem(
      storageKeys.selection,
      JSON.stringify({
        candidate_id: candidate.id,
        candidate_name: candidate.name,
        journey: selectedJourney,
        program: candidate.program,
        program_label: candidate.program_label,
        proposal: candidateProposal(candidate),
      })
    );

    window.location.href = "index.html";
  });
}

function readSelection() {
  try {
    return JSON.parse(localStorage.getItem(storageKeys.selection) || "null");
  } catch {
    return null;
  }
}

function initReview() {
  const reviewBox = document.querySelector("#reviewBox");
  const emptyBox = document.querySelector("#emptyReview");
  if (!reviewBox) return;

  const selection = readSelection();
  if (!selection) {
    reviewBox.classList.add("d-none");
    emptyBox.classList.remove("d-none");
    return;
  }

  document.querySelector("#reviewJourney").textContent = selection.journey;
  document.querySelector("#reviewCandidate").textContent = selection.candidate_name;
  document.querySelector("#reviewProposal").textContent = selection.proposal;

  document.querySelector("#confirmVote").addEventListener("click", async () => {
    const button = document.querySelector("#confirmVote");
    const originalLabel = button.innerHTML;
    const previousError = document.querySelector("#voteError");
    if (previousError) previousError.remove();

    button.disabled = true;
    button.innerHTML = `<span class="spinner-border spinner-border-sm me-2" aria-hidden="true"></span>Registrando`;

    try {
      const response = await getJson("/api/vote", {
        method: "POST",
        body: JSON.stringify({
          candidate_id: selection.candidate_id,
          journey: selection.journey,
          program: selection.program,
        }),
      });

      localStorage.setItem(
        storageKeys.confirmation,
        JSON.stringify({
          ...selection,
          ticket: response.vote?.id ? `SV-${String(response.vote.id).padStart(6, "0")}` : `SV-${Date.now().toString().slice(-8)}`,
          date: new Date().toLocaleString("es-CO"),
        })
      );

      window.location.href = "index.html";
    } catch (error) {
      button.disabled = false;
      button.innerHTML = originalLabel;
      const alert = document.createElement("div");
      alert.id = "voteError";
      alert.className = "alert alert-danger mt-3 mb-0";
      alert.textContent = `No se pudo guardar el voto: ${error.message}`;
      button.closest(".border-top").after(alert);
    }
  });
}

function initConfirmation() {
  const box = document.querySelector("#confirmationBox");
  if (!box) return;

  let confirmation;
  try {
    confirmation = JSON.parse(localStorage.getItem(storageKeys.confirmation) || "null");
  } catch {
    confirmation = null;
  }

  if (!confirmation) {
    box.innerHTML = `
      <div class="alert alert-warning mb-0">
        No encontramos una confirmación reciente. Puedes iniciar un nuevo voto desde el tarjetón.
      </div>
    `;
    return;
  }

  document.querySelector("#ticketNumber").textContent = confirmation.ticket;
  document.querySelector("#confirmedCandidate").textContent = confirmation.candidate_name;
  document.querySelector("#confirmedJourney").textContent = confirmation.journey;
  document.querySelector("#confirmedDate").textContent = confirmation.date;
}

function renderCandidateSummary(candidate) {
  const detail = [candidate.ficha ? `Ficha ${candidate.ficha}` : "", candidate.journey, candidate.program_label].filter(Boolean).join(" · ");
  return `
    <div class="d-flex justify-content-between align-items-center border-bottom pb-3">
      <div>
        <strong class="d-block">${candidate.name}</strong>
        <small class="text-secondary">${detail}</small>
      </div>
      <div class="text-end">
        <strong class="text-sena">${formatNumber.format(candidate.votes)}</strong>
        <div class="small text-secondary">${candidate.percentage}%</div>
      </div>
    </div>
  `;
}

function renderParticipation(item, index) {
  const colors = ["var(--sena-green)", "var(--sena-orange)", "var(--sena-blue)"];
  return `
    <div class="d-flex justify-content-between align-items-center border-bottom pb-3">
      <div class="d-flex align-items-center gap-3">
        <span class="rounded-pill d-inline-block" style="width: 1rem; height: 1rem; background: ${colors[index] || colors[0]}"></span>
        <span>${item.label}</span>
      </div>
      <div class="text-end">
        <strong>${item.percentage}%</strong>
        <div class="small text-secondary">${formatNumber.format(item.votes)} votos</div>
      </div>
    </div>
  `;
}

async function initResults() {
  const totalVotes = document.querySelector("#totalVotes");
  const candidateSummary = document.querySelector("#candidateSummary");
  if (!totalVotes || !candidateSummary) return;
  let isLoading = false;

  const loadResults = async () => {
    if (isLoading) return;
    isLoading = true;
    const lastUpdate = document.querySelector("#lastUpdate");
    try {
      const data = await getJson("/api/results");
      if (lastUpdate) lastUpdate.textContent = data.last_update || new Date().toLocaleString("es-CO");
      totalVotes.textContent = formatNumber.format(data.total || 0);
      candidateSummary.innerHTML = data.candidates.length
        ? data.candidates.map(renderCandidateSummary).join("")
        : `<div class="alert alert-warning mb-0">No hay candidatos para mostrar.</div>`;
      const participationList = document.querySelector("#participationList");
      if (participationList) participationList.innerHTML = data.participation.map(renderParticipation).join("");
    } catch (error) {
      if (lastUpdate) lastUpdate.textContent = "No se pudo actualizar";
      candidateSummary.innerHTML = `<div class="alert alert-warning mb-0">No se pudieron cargar los resultados. Revisa la conexión o Firebase.</div>`;
      console.error(error);
    } finally {
      isLoading = false;
    }
  };

  await loadResults();
  document.querySelector("#refreshResults")?.addEventListener("click", loadResults);
  window.setInterval(() => {
    loadResults().catch((error) => console.error(error));
  }, 2500);
}

function initials(name) {
  return name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function splitFullName(name) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length <= 1) return { firstName: name.trim(), lastName: "" };
  return { firstName: parts[0], lastName: parts.slice(1).join(" ") };
}

function versionedPhotoUrl(candidate) {
  const photo = candidate?.photo || "";
  if (!photo || photo.startsWith("data:")) return photo;
  const version = encodeURIComponent([photo, candidate.photo_position || "", candidate.photo_size || ""].join("|"));
  return `${photo}${photo.includes("?") ? "&" : "?"}v=${version}`;
}

function candidatePhotoStyle(candidate) {
  if (!candidate?.photo) return "";
  const fit = candidate.photo_fit || "cover";
  const position = candidate.photo_position || (fit === "contain" ? "center center" : "center 35%");
  const rawSize = candidate.photo_size || fit;
  const size = ["cover", "contain"].includes(rawSize) ? rawSize : rawSize;
  return `background-image: url('${versionedPhotoUrl(candidate)}'); background-size: ${size}; background-position: ${position};`;
}

function candidateImageStyle(candidate) {
  const fit = candidate.photo_fit === "contain" ? "contain" : "cover";
  const position = candidate.photo_position || (fit === "contain" ? "center center" : "center 35%");
  const rawSize = candidate.photo_size || "100%";
  const zoom = rawSize.endsWith("%") ? Math.max(1, Number(rawSize.replace("%", "")) / 100) : 1;
  return `object-fit: ${fit}; object-position: ${position}; transform: scale(${zoom});`;
}

function setPhotoPreview(element, photo, fit = "cover", position = "center 35%", size = fit) {
  if (!element) return;
  element.style.backgroundImage = photo ? `url("${photo}")` : "";
  element.style.backgroundSize = size;
  element.style.backgroundPosition = position;
  element.classList.toggle("has-photo", Boolean(photo));
}

function forceCloseModal(modal) {
  if (!modal) return;
  bootstrap.Modal.getInstance(modal)?.hide();
  modal.classList.remove("show");
  modal.setAttribute("aria-hidden", "true");
  modal.removeAttribute("aria-modal");
  modal.style.display = "none";
  document.body.classList.remove("modal-open");
  document.body.style.removeProperty("overflow");
  document.body.style.removeProperty("padding-right");
  document.querySelectorAll(".modal-backdrop").forEach((backdrop) => backdrop.remove());
}

function renderReportRow(candidate) {
  const detail = [candidate.ficha ? `Ficha ${candidate.ficha}` : "", candidate.journey, candidate.program_label].filter(Boolean).join(" · ");
  return `
    <tr>
      <td class="report-number">${candidate.number}</td>
      <td>
        <div class="report-candidate">
          <strong>${candidate.name}</strong>
          <small>${detail}</small>
        </div>
      </td>
      <td class="text-end"><span class="report-votes">${formatNumber.format(candidate.votes)}</span></td>
    </tr>
  `;
}

function downloadCsv(rows) {
  const header = ["Número", "Candidato", "Ficha", "Jornada", "Programa", "Votos obtenidos"];
  const body = rows.map((row) => [row.number, row.name, row.ficha || "", row.journey, row.program_label, row.votes]);
  const csv = [header, ...body].map((line) => line.map((cell) => `"${cell}"`).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "reporte-sena-vota.csv";
  link.click();
  URL.revokeObjectURL(url);
}

async function downloadPdf() {
  try {
    const response = await fetch(apiEndpoint("/api/reports/pdf"), { credentials: "include" });
    if (!response.ok) throw new Error("PDF no disponible");
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "reporte-sena-vota.pdf";
    link.click();
    URL.revokeObjectURL(url);
  } catch {
    window.print();
  }
}

async function initReports() {
  const table = document.querySelector("#reportTable");
  if (!table) return;

  let data;
  try {
    data = await getJson("/api/reports");
  } catch (error) {
    table.innerHTML = `<tr><td colspan="3" class="text-center text-secondary py-4">No se pudieron cargar los reportes.</td></tr>`;
    document.querySelector("#reportTotal").textContent = "0";
    document.querySelector("#reportCount").textContent = "Sin conexión";
    console.error(error);
    return;
  }
  let currentRows = data.candidates;
  let currentJourney = "todas";
  let currentProgram = "todos";
  let isRefreshing = false;

  const render = () => {
    table.innerHTML = currentRows.map(renderReportRow).join("");
    document.querySelector("#reportTotal").textContent = formatNumber.format(currentRows.reduce((sum, row) => sum + row.votes, 0));
    document.querySelector("#reportCount").textContent = `Mostrando ${currentRows.length} registros`;
  };

  const applyFilters = () => {
    currentJourney = document.querySelector("#jornada").value;
    currentProgram = document.querySelector("#programa").value;
    currentRows = data.candidates.filter((row) => {
      const matchesJourney = currentJourney === "todas" || row.journey === currentJourney || row.journey === "Todas";
      const matchesProgram = currentProgram === "todos" || row.program === currentProgram || row.program === "todos";
      return matchesJourney && matchesProgram;
    });
    render();
  };

  const refreshReports = async () => {
    if (isRefreshing) return;
    isRefreshing = true;
    try {
      data = await getJson("/api/reports");
      applyFilters();
    } catch (error) {
      document.querySelector("#reportCount").textContent = "No se pudo actualizar";
      console.error(error);
    } finally {
      isRefreshing = false;
    }
  };

  render();

  document.querySelector("#reportFilters").addEventListener("submit", (event) => {
    event.preventDefault();
    applyFilters();
  });
  document.querySelector("#resetFilters").addEventListener("click", () => {
    document.querySelector("#jornada").value = "todas";
    document.querySelector("#programa").value = "todos";
    applyFilters();
  });
  document.querySelector("#downloadCsv").addEventListener("click", () => downloadCsv(currentRows));
  document.querySelector("#downloadPdf").addEventListener("click", downloadPdf);
  window.setInterval(() => {
    refreshReports().catch((error) => console.error(error));
  }, 4000);
}

function initHelp() {
  const search = document.querySelector("#helpSearch");
  if (!search) return;

  search.addEventListener("input", () => {
    const term = search.value.toLowerCase();
    document.querySelectorAll(".help-item").forEach((item) => {
      item.classList.toggle("d-none", !item.textContent.toLowerCase().includes(term));
    });
  });
}

function renderAdminCandidate(candidate, isActive = false) {
  const photo = candidate.photo
    ? `<span class="avatar-frame"><img class="candidate-avatar-img" src="${versionedPhotoUrl(candidate)}" alt="Foto de ${candidate.name}" style="${candidateImageStyle(candidate)}" onerror="this.style.display='none'; this.nextElementSibling.style.opacity='1';"><span class="photo-fallback-text">${initials(candidate.name)}</span></span>`
    : `<span class="avatar">${candidate.id === "blanco" ? "VB" : initials(candidate.name)}</span>`;

  return `
    <button class="admin-candidate-item ${isActive ? "active" : ""}" type="button" data-candidate="${candidate.id}">
      ${photo}
      <span class="text-start">
        <strong class="d-block">${candidate.name}</strong>
        <small>${candidate.program_label}</small>
      </span>
    </button>
  `;
}

function fillCandidateEditor(candidate) {
  const nameParts = splitFullName(candidate.name);
  document.querySelector("#editCandidateId").value = candidate.id;
  document.querySelector("#editName").value = nameParts.firstName;
  document.querySelector("#editLastName").value = nameParts.lastName;
  document.querySelector("#editJourney").value = candidate.journey;
  document.querySelector("#editFicha").value = candidate.ficha || "";
  document.querySelector("#editProgramLabel").value = candidate.program_label || "";
  document.querySelector("#editPhoto").value = candidate.photo || "";
  document.querySelector("#editPhotoFit").value = candidate.photo_fit || "cover";
  document.querySelector("#editPhotoPosition").value = candidate.photo_position || "center 35%";
  document.querySelector("#editPhotoSize").value = candidate.photo_size || candidate.photo_fit || "cover";
  document.querySelector("#editPhotoFile").value = "";
  setPhotoPreview(
    document.querySelector("#candidatePhotoPreview"),
    versionedPhotoUrl(candidate),
    candidate.photo_fit || "cover",
    candidate.photo_position || "center 35%",
    candidate.photo_size || candidate.photo_fit || "cover"
  );
  document.querySelector("#editProposal").value = candidate.proposal || "";
  document.querySelector("#deleteCandidateBtn").classList.toggle("d-none", candidate.id === "blanco");
  document.querySelector("#saveCandidateBtn").innerHTML = `<i class="bi bi-save me-2"></i>Actualizar candidato`;
  document.querySelector("#candidateEditorStatus").textContent = `Editando: ${candidate.name}`;
}

function clearCandidateEditor() {
  document.querySelector("#editCandidateId").value = "";
  document.querySelector("#editName").value = "";
  document.querySelector("#editLastName").value = "";
  document.querySelector("#editJourney").value = "Diurna";
  document.querySelector("#editFicha").value = "";
  document.querySelector("#editProgramLabel").value = "";
  document.querySelector("#editPhoto").value = "";
  document.querySelector("#editPhotoFit").value = "cover";
  document.querySelector("#editPhotoPosition").value = "center 35%";
  document.querySelector("#editPhotoSize").value = "100%";
  document.querySelector("#editPhotoFile").value = "";
  setPhotoPreview(document.querySelector("#candidatePhotoPreview"), "");
  document.querySelector("#editProposal").value = "";
  document.querySelector("#deleteCandidateBtn").classList.add("d-none");
  document.querySelector("#saveCandidateBtn").innerHTML = `<i class="bi bi-save me-2"></i>Guardar candidato`;
  document.querySelector("#candidateEditorStatus").textContent = "Nuevo candidato. Completa los datos y guarda.";
}

async function initAdminCandidateEditor() {
  const list = document.querySelector("#adminCandidateList");
  const form = document.querySelector("#candidateEditorForm");
  const addButton = document.querySelector("#addCandidateBtn");
  const deleteButton = document.querySelector("#deleteCandidateBtn");
  const saveButton = document.querySelector("#saveCandidateBtn");
  const saveProgress = document.querySelector("#candidateSaveProgress");
  const saveProgressBar = document.querySelector("#candidateSaveProgressBar");
  const saveProgressLabel = document.querySelector("#candidateSaveProgressLabel");
  const saveProgressPercent = document.querySelector("#candidateSaveProgressPercent");
  if (!list || !form) return;

  let candidates = await getJson("/api/candidates");
  let selectedCandidateId = candidates[0]?.id;

  const renderList = () => {
    list.innerHTML = candidates.map((candidate) => renderAdminCandidate(candidate, candidate.id === selectedCandidateId)).join("");
  };

  const refreshCandidates = async (candidateId = "") => {
    candidates = await getJson("/api/candidates");
    selectedCandidateId = candidateId || candidates[0]?.id || "";
    renderList();
    const selected = candidates.find((current) => current.id === selectedCandidateId);
    if (selected) fillCandidateEditor(selected);
    else clearCandidateEditor();
  };

  const setSaveProgress = (percent, label, visible = true) => {
    if (!saveProgress || !saveProgressBar || !saveProgressLabel || !saveProgressPercent) return;
    const safePercent = Math.min(100, Math.max(0, percent));
    saveProgress.classList.toggle("d-none", !visible);
    saveProgressBar.style.width = `${safePercent}%`;
    saveProgressBar.parentElement?.setAttribute("aria-valuenow", String(safePercent));
    saveProgressLabel.textContent = label;
    saveProgressPercent.textContent = `${safePercent}%`;
  };

  renderList();
  if (candidates[0]) fillCandidateEditor(candidates[0]);

  let pendingPhoto = "";
  let pendingPhotoFit = "cover";
  let pendingPhotoX = 50;
  let pendingPhotoY = 35;
  let pendingPhotoZoom = 100;
  let isDraggingPhoto = false;
  let dragStartX = 0;
  let dragStartY = 0;
  let dragStartPhotoX = 50;
  let dragStartPhotoY = 35;
  const photoModal = document.querySelector("#photoConfirmModal");
  const photoModalInstance = photoModal ? bootstrap.Modal.getOrCreateInstance(photoModal) : null;
  const photoConfirmPreview = document.querySelector("#photoConfirmPreview");
  const photoZoomRange = document.querySelector("#photoZoomRange");

  const pendingPhotoPosition = () => `${pendingPhotoX}% ${pendingPhotoY}%`;
  const pendingPhotoSize = () => (pendingPhotoFit === "contain" ? "contain" : `${pendingPhotoZoom}%`);
  const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

  const renderPendingPhoto = () => {
    setPhotoPreview(photoConfirmPreview, pendingPhoto, pendingPhotoFit, pendingPhotoPosition(), pendingPhotoSize());
    if (photoZoomRange) {
      photoZoomRange.value = String(pendingPhotoZoom);
    }
  };

  const resetPendingPhoto = () => {
    pendingPhotoFit = "cover";
    pendingPhotoX = 50;
    pendingPhotoY = 35;
    pendingPhotoZoom = 100;
    renderPendingPhoto();
  };

  addButton?.addEventListener("click", () => {
    selectedCandidateId = "";
    renderList();
    clearCandidateEditor();
  });

  document.querySelector("#editPhotoFile").addEventListener("change", (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setSaveProgress(10, "Leyendo la foto seleccionada...");
    document.querySelector("#candidateEditorStatus").textContent = "Leyendo la foto seleccionada...";
    const reader = new FileReader();
    reader.addEventListener("load", () => {
      pendingPhoto = String(reader.result);
      resetPendingPhoto();
      setSaveProgress(35, "Foto lista para ajustar.");
      document.querySelector("#candidateEditorStatus").textContent = "Ajusta la foto y confirma para guardarla.";
      photoModalInstance?.show();
    });
    reader.addEventListener("error", () => {
      setSaveProgress(0, "No se pudo leer la foto.", false);
      document.querySelector("#candidateEditorStatus").textContent = "No se pudo leer la foto. Intenta con otra imagen.";
    });
    reader.readAsDataURL(file);
  });

  photoConfirmPreview?.addEventListener("pointerdown", (event) => {
    if (!pendingPhoto) return;
    isDraggingPhoto = true;
    dragStartX = event.clientX;
    dragStartY = event.clientY;
    dragStartPhotoX = pendingPhotoX;
    dragStartPhotoY = pendingPhotoY;
    photoConfirmPreview.classList.add("dragging");
    photoConfirmPreview.setPointerCapture(event.pointerId);
  });
  photoConfirmPreview?.addEventListener("pointermove", (event) => {
    if (!isDraggingPhoto) return;
    const rect = photoConfirmPreview.getBoundingClientRect();
    const deltaX = ((event.clientX - dragStartX) / rect.width) * 100;
    const deltaY = ((event.clientY - dragStartY) / rect.height) * 100;
    pendingPhotoX = clamp(dragStartPhotoX - deltaX, 0, 100);
    pendingPhotoY = clamp(dragStartPhotoY - deltaY, 0, 100);
    renderPendingPhoto();
  });
  ["pointerup", "pointercancel", "lostpointercapture"].forEach((eventName) => {
    photoConfirmPreview?.addEventListener(eventName, () => {
      isDraggingPhoto = false;
      photoConfirmPreview.classList.remove("dragging");
    });
  });
  photoZoomRange?.addEventListener("input", () => {
    pendingPhotoFit = "cover";
    pendingPhotoZoom = Number(photoZoomRange.value);
    renderPendingPhoto();
  });
  document.querySelector("#photoApplyBtn")?.addEventListener("click", () => {
    if (!pendingPhoto) {
      forceCloseModal(photoModal);
      return;
    }
    document.querySelector("#editPhoto").value = pendingPhoto;
    document.querySelector("#editPhotoFit").value = pendingPhotoFit;
    document.querySelector("#editPhotoPosition").value = pendingPhotoPosition();
    document.querySelector("#editPhotoSize").value = pendingPhotoSize();
    setPhotoPreview(document.querySelector("#candidatePhotoPreview"), pendingPhoto, pendingPhotoFit, pendingPhotoPosition(), pendingPhotoSize());
    setSaveProgress(55, "Foto confirmada. Falta actualizar candidato.");
    document.querySelector("#candidateEditorStatus").textContent = "Foto confirmada. Guarda cambios para aplicarla.";
    forceCloseModal(photoModal);
  });

  list.addEventListener("click", (event) => {
    const item = event.target.closest("[data-candidate]");
    if (!item) return;
    selectedCandidateId = item.dataset.candidate;
    const candidate = candidates.find((current) => current.id === selectedCandidateId);
    if (!candidate) return;
    renderList();
    fillCandidateEditor(candidate);
  });

  deleteButton?.addEventListener("click", async () => {
    const candidateId = document.querySelector("#editCandidateId").value;
    const candidate = candidates.find((current) => current.id === candidateId);
    if (!candidate || candidate.id === "blanco") return;
    const confirmed = window.confirm(`¿Eliminar a ${candidate.name}?`);
    if (!confirmed) return;

    const status = document.querySelector("#candidateEditorStatus");
    status.textContent = "Eliminando candidato...";
    try {
      await getJson(`/api/candidates/${candidateId}`, { method: "DELETE" });
      await refreshCandidates();
      document.querySelector("#candidateEditorStatus").textContent = "Candidato eliminado. El tarjetón local ya fue actualizado.";
    } catch (error) {
      status.textContent = error.message;
    }
  });

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const candidateId = document.querySelector("#editCandidateId").value;
    const firstName = document.querySelector("#editName").value.trim();
    const lastName = document.querySelector("#editLastName").value.trim();
    const fullName = [firstName, lastName].filter(Boolean).join(" ");
    const programLabel = document.querySelector("#editProgramLabel").value.trim();
    const payload = {
      name: fullName,
      journey: document.querySelector("#editJourney").value,
      ficha: document.querySelector("#editFicha").value,
      program: programLabel.toLowerCase().replace(/\s+/g, "-") || "sin-programa",
      program_label: programLabel,
      photo: document.querySelector("#editPhoto").value,
      photo_fit: document.querySelector("#editPhotoFit").value,
      photo_position: document.querySelector("#editPhotoPosition").value,
      photo_size: document.querySelector("#editPhotoSize").value,
      proposal: document.querySelector("#editProposal").value,
    };

    const status = document.querySelector("#candidateEditorStatus");
    const originalButton = saveButton?.innerHTML || "";
    if (saveButton) {
      saveButton.disabled = true;
      saveButton.innerHTML = `<span class="spinner-border spinner-border-sm me-2" aria-hidden="true"></span>Guardando`;
    }
    setSaveProgress(payload.photo.startsWith("data:image/") ? 65 : 45, payload.photo.startsWith("data:image/") ? "Subiendo y guardando la foto..." : "Guardando cambios...");
    status.textContent = "Guardando cambios...";
    try {
      const response = await getJson(candidateId ? `/api/candidates/${candidateId}` : "/api/candidates", {
        method: candidateId ? "PUT" : "POST",
        body: JSON.stringify(payload),
      });
      forceCloseModal(photoModal);
      setSaveProgress(90, "Actualizando la lista de candidatos...");
      await refreshCandidates(response.candidate.id);
      setSaveProgress(100, "Candidato actualizado.");
      document.querySelector("#candidateEditorStatus").textContent = "Cambios guardados. El tarjetón local ya usa esta información.";
      window.setTimeout(() => setSaveProgress(100, "Candidato actualizado.", false), 1200);
    } catch (error) {
      setSaveProgress(0, error.message || "No se pudo guardar.", true);
      status.textContent = error.message;
    } finally {
      if (saveButton) {
        saveButton.disabled = false;
        saveButton.innerHTML = originalButton || `<i class="bi bi-save me-2"></i>Actualizar candidato`;
      }
    }
  });
}

document.addEventListener("DOMContentLoaded", () => {
  setActiveNav();
  initJourneySelection();
  initSimpleVotingPage().catch((error) => console.error(error));
  initVotingForm().catch((error) => console.error(error));
  initReview();
  initConfirmation();
  initResults().catch((error) => console.error(error));
  initReports().catch((error) => console.error(error));
  initHelp();
  initAdminCandidateEditor().catch((error) => console.error(error));
});

