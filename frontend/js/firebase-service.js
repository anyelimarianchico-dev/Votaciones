import { firebaseConfig, isFirebaseConfigured } from "./firebase-config.js";

let app;
let db;
let firebaseModulesPromise;

async function firebaseModules() {
  if (!firebaseModulesPromise) {
    firebaseModulesPromise = Promise.all([
      import("https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js"),
      import("https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js"),
    ]).then(([appModule, firestoreModule]) => ({
      initializeApp: appModule.initializeApp,
      addDoc: firestoreModule.addDoc,
      collection: firestoreModule.collection,
      deleteDoc: firestoreModule.deleteDoc,
      doc: firestoreModule.doc,
      getDocs: firestoreModule.getDocs,
      getFirestore: firestoreModule.getFirestore,
      serverTimestamp: firestoreModule.serverTimestamp,
      setDoc: firestoreModule.setDoc,
    }));
  }
  return firebaseModulesPromise;
}

async function ensureFirebase() {
  if (!isFirebaseConfigured()) {
    throw new Error("Firebase no está configurado");
  }
  const modules = await firebaseModules();
  if (!app) {
    app = modules.initializeApp(firebaseConfig);
    db = modules.getFirestore(app);
  }
  return { db, modules };
}

export function firebaseIsReady() {
  return isFirebaseConfigured();
}

function normalizeCandidate(candidate) {
  return {
    id: String(candidate.id || `candidate-${crypto.randomUUID().slice(0, 8)}`),
    number: String(candidate.number || ""),
    name: String(candidate.name || "Candidato sin nombre"),
    journey: String(candidate.journey || "Diurna"),
    ficha: String(candidate.ficha || ""),
    program: String(candidate.program || "sin-programa"),
    program_label: String(candidate.program_label || candidate.program || "Programa no registrado"),
    photo: String(candidate.photo || ""),
    photo_fit: String(candidate.photo_fit || "cover"),
    photo_position: String(candidate.photo_position || "center 35%"),
    photo_size: String(candidate.photo_size || candidate.photo_fit || "cover"),
    proposal: String(candidate.proposal || ""),
  };
}

function sortCandidates(candidates) {
  return [...candidates].sort((a, b) => {
    if (a.id === "blanco") return 1;
    if (b.id === "blanco") return -1;
    return String(a.number).localeCompare(String(b.number), "es", { numeric: true });
  });
}

export async function loadCandidatesFromFirebase(seedCandidates = []) {
  const { db: firestore, modules } = await ensureFirebase();
  const snapshot = await modules.getDocs(modules.collection(firestore, "candidatos"));
  const candidates = snapshot.docs.map((docSnapshot) => normalizeCandidate({ id: docSnapshot.id, ...docSnapshot.data() }));

  if (candidates.length) {
    return sortCandidates(candidates);
  }

  await Promise.all(
    seedCandidates.map((candidate) => {
      const normalized = normalizeCandidate(candidate);
      return modules.setDoc(modules.doc(firestore, "candidatos", normalized.id), normalized);
    })
  );
  return sortCandidates(seedCandidates.map(normalizeCandidate));
}

export async function saveCandidateToFirebase(payload, currentCandidates = [], candidateId = "") {
  const { db: firestore, modules } = await ensureFirebase();
  const existing = currentCandidates.find((candidate) => candidate.id === candidateId);
  const numericNumbers = currentCandidates
    .filter((candidate) => candidate.id !== "blanco" && String(candidate.number).match(/^\d+$/))
    .map((candidate) => Number(candidate.number));
  const id = candidateId || `candidate-${crypto.randomUUID().slice(0, 8)}`;
  const candidate = normalizeCandidate({
    ...existing,
    ...payload,
    id,
    number: existing?.number || String(Math.max(0, ...numericNumbers) + 1).padStart(2, "0"),
  });

  await modules.setDoc(modules.doc(firestore, "candidatos", id), candidate);
  return candidate;
}

export async function deleteCandidateFromFirebase(candidateId) {
  const { db: firestore, modules } = await ensureFirebase();
  if (candidateId === "blanco") {
    throw new Error("El voto en blanco no se puede eliminar");
  }
  await modules.deleteDoc(modules.doc(firestore, "candidatos", candidateId));
  return { id: candidateId };
}

export async function saveVoteToFirebase(payload) {
  const { db: firestore, modules } = await ensureFirebase();
  const voteRef = await modules.addDoc(modules.collection(firestore, "votos"), {
    candidate_id: payload.candidate_id,
    journey: payload.journey,
    program: payload.program,
    created_at: modules.serverTimestamp(),
    source: "web",
  });

  return {
    id: voteRef.id,
    candidate_id: payload.candidate_id,
    journey: payload.journey,
    program: payload.program,
  };
}

export async function loadVotesFromFirebase() {
  const { db: firestore, modules } = await ensureFirebase();
  const snapshot = await modules.getDocs(modules.collection(firestore, "votos"));
  return snapshot.docs.map((docSnapshot) => ({
    id: docSnapshot.id,
    ...docSnapshot.data(),
  }));
}
