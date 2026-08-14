from __future__ import annotations

import json
import base64
import re
from json import JSONDecodeError
from datetime import datetime
from pathlib import Path
from typing import Any
from uuid import uuid4


BASE_DIR = Path(__file__).resolve().parent
ROOT_DIR = BASE_DIR.parent
DATA_DIR = BASE_DIR / "data"
ASSETS_DIR = ROOT_DIR / "frontend" / "assets"
FRONTEND_DATA_DIR = ROOT_DIR / "frontend" / "data"
FRONTEND_CANDIDATES_FILE = FRONTEND_DATA_DIR / "candidates.json"
VOTES_FILE = DATA_DIR / "votes.json"
CANDIDATES_FILE = DATA_DIR / "candidates.json"


DEFAULT_CANDIDATES: list[dict[str, str]] = [
    {
        "id": "ruth",
        "number": "01",
        "name": "Ruth",
        "journey": "Diurna",
        "ficha": "2874521",
        "program": "analisis-y-desarrollo-de-software",
        "program_label": "Tecnólogo en Análisis y Desarrollo de Software",
        "photo": "assets/candidate-ruth.png",
        "proposal": "Fortalecer la comunicación entre aprendices e instructores, crear espacios de apoyo académico y promover actividades de integración para la jornada diurna.",
    },
    {
        "id": "carlos",
        "number": "02",
        "name": "Carlos Gómez",
        "journey": "Mixta",
        "ficha": "2874522",
        "program": "contabilizacion-de-operaciones",
        "program_label": "Técnico en Contabilización de Operaciones",
        "photo": "assets/candidate-carlos.png",
        "proposal": "Impulsar jornadas de acompañamiento para proyectos formativos, mejorar la organización de horarios y abrir canales de escucha para aprendices de jornada mixta.",
    },
    {
        "id": "diana",
        "number": "03",
        "name": "Diana Ruiz",
        "journey": "Virtual",
        "ficha": "2874523",
        "program": "analisis-y-desarrollo-de-software",
        "program_label": "Tecnólogo en Análisis y Desarrollo de Software",
        "photo": "assets/candidate-diana.png",
        "proposal": "Crear grupos de apoyo virtual, promover encuentros de seguimiento académico y facilitar la participación de aprendices que estudian desde casa.",
    },
    {
        "id": "andres",
        "number": "04",
        "name": "Andrés Vargas",
        "journey": "Diurna",
        "ficha": "2874524",
        "program": "contabilizacion-de-operaciones",
        "program_label": "Técnico en Contabilización de Operaciones",
        "photo": "assets/candidate-andres.png",
        "proposal": "Gestionar actividades de bienestar, apoyar la participación en eventos institucionales y representar necesidades de los aprendices ante coordinación.",
    },
    {
        "id": "blanco",
        "number": "--",
        "name": "Voto en Blanco",
        "journey": "Todas",
        "ficha": "",
        "program": "todos",
        "program_label": "Todos los programas",
        "photo": "",
        "proposal": "El voto en blanco permite participar sin apoyar una candidatura específica.",
    },
]

EMPTY_STORE: dict[str, Any] = {"last_id": 0, "votes": []}
CANDIDATE_FIELDS = [
    "id",
    "number",
    "name",
    "journey",
    "ficha",
    "program",
    "program_label",
    "photo",
    "photo_fit",
    "photo_position",
    "photo_size",
    "proposal",
]
PHOTO_MIME_EXTENSIONS = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
}


def ensure_data_files() -> None:
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    if not VOTES_FILE.exists():
        save_vote_store(EMPTY_STORE.copy())
    if not CANDIDATES_FILE.exists():
        save_candidates(DEFAULT_CANDIDATES)


def blank_candidate() -> dict[str, str]:
    return DEFAULT_CANDIDATES[-1].copy()


def normalize_candidate(candidate: dict[str, Any]) -> dict[str, str]:
    normalized = {
        "id": str(candidate.get("id") or f"candidate-{uuid4().hex[:8]}"),
        "number": str(candidate.get("number") or ""),
        "name": str(candidate.get("name") or "Candidato sin nombre"),
        "journey": str(candidate.get("journey") or "Diurna"),
        "ficha": str(candidate.get("ficha") or ""),
        "program": str(candidate.get("program") or "sin-programa"),
        "program_label": str(candidate.get("program_label") or candidate.get("program") or "Programa no registrado"),
        "photo": str(candidate.get("photo") or ""),
        "photo_fit": str(candidate.get("photo_fit") or "cover"),
        "photo_position": str(candidate.get("photo_position") or "center 35%"),
        "photo_size": str(candidate.get("photo_size") or candidate.get("photo_fit") or "cover"),
        "proposal": str(candidate.get("proposal") or ""),
    }
    if normalized["id"] == "blanco":
        normalized.update({**blank_candidate(), **normalized, "number": "--"})
    return {key: normalized[key] for key in CANDIDATE_FIELDS}


def load_candidates() -> list[dict[str, str]]:
    ensure_data_files()
    try:
        with CANDIDATES_FILE.open("r", encoding="utf-8-sig") as file:
            raw_candidates: Any = json.load(file)
    except (JSONDecodeError, OSError):
        save_candidates(DEFAULT_CANDIDATES)
        return [candidate.copy() for candidate in DEFAULT_CANDIDATES]

    if not isinstance(raw_candidates, list):
        save_candidates(DEFAULT_CANDIDATES)
        return [candidate.copy() for candidate in DEFAULT_CANDIDATES]

    candidates: list[dict[str, str]] = []
    seen_ids: set[str] = set()
    changed = False
    for raw_candidate in raw_candidates:
        if not isinstance(raw_candidate, dict):
            changed = True
            continue
        candidate = normalize_candidate(raw_candidate)
        if any(raw_candidate.get(key) != candidate[key] for key in CANDIDATE_FIELDS):
            changed = True
        if candidate["id"] in seen_ids:
            changed = True
            continue
        seen_ids.add(candidate["id"])
        candidates.append(candidate)

    if "blanco" not in seen_ids:
        candidates.append(blank_candidate())
        changed = True

    ordered_candidates = [candidate for candidate in candidates if candidate["id"] != "blanco"] + [
        candidate for candidate in candidates if candidate["id"] == "blanco"
    ]
    if ordered_candidates != candidates:
        changed = True
    candidates = ordered_candidates
    if changed:
        save_candidates(candidates)
    return candidates


def save_candidates(candidates: list[dict[str, str]]) -> None:
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    FRONTEND_DATA_DIR.mkdir(parents=True, exist_ok=True)
    data = json.dumps(candidates, indent=2, ensure_ascii=False)
    write_json_text(CANDIDATES_FILE, data)
    write_json_text(FRONTEND_CANDIDATES_FILE, data)


def write_json_text(path: Path, data: str) -> None:
    temp_path = path.with_name(f"{path.name}.{uuid4().hex}.tmp")
    temp_path.write_text(data, encoding="utf-8")
    temp_path.replace(path)


def next_candidate_number(candidates: list[dict[str, str]]) -> str:
    numeric_numbers = [int(candidate["number"]) for candidate in candidates if candidate["number"].isdigit()]
    return str(max(numeric_numbers, default=0) + 1).zfill(2)


def save_candidate_photo(candidate_id: str, photo: str) -> str:
    if not photo.startswith("data:image/"):
        return photo

    match = re.match(r"^data:(image/(?:jpeg|png|webp));base64,(.+)$", photo, flags=re.DOTALL)
    if not match:
        return ""

    mime_type, encoded = match.groups()
    extension = PHOTO_MIME_EXTENSIONS.get(mime_type, "jpg")
    ASSETS_DIR.mkdir(parents=True, exist_ok=True)
    photo_path = ASSETS_DIR / f"candidate-{candidate_id}-{uuid4().hex[:8]}.{extension}"
    photo_path.write_bytes(base64.b64decode(encoded))
    return f"assets/{photo_path.name}"


def build_candidate_payload(payload: dict[str, Any], candidates: list[dict[str, str]]) -> dict[str, str]:
    program_label = str(payload.get("program_label") or "").strip()
    program = str(payload.get("program") or program_label.lower().replace(" ", "-") or "sin-programa").strip()
    candidate_id = f"candidate-{uuid4().hex[:8]}"
    return normalize_candidate(
        {
            "id": candidate_id,
            "number": next_candidate_number(candidates),
            "name": str(payload.get("name") or "Nuevo candidato").strip(),
            "journey": str(payload.get("journey") or "Diurna").strip(),
            "ficha": str(payload.get("ficha") or "").strip(),
            "program": program,
            "program_label": program_label or "Programa no registrado",
            "photo": save_candidate_photo(candidate_id, str(payload.get("photo") or "").strip()),
            "photo_fit": str(payload.get("photo_fit") or "cover").strip(),
            "photo_position": str(payload.get("photo_position") or "center 35%").strip(),
            "photo_size": str(payload.get("photo_size") or payload.get("photo_fit") or "cover").strip(),
            "proposal": str(payload.get("proposal") or "").strip(),
        }
    )


def create_candidate(payload: dict[str, Any]) -> dict[str, str]:
    candidates = load_candidates()
    new_candidate = build_candidate_payload(payload, candidates)
    without_blank = [candidate for candidate in candidates if candidate["id"] != "blanco"]
    blank_rows = [candidate for candidate in candidates if candidate["id"] == "blanco"]
    candidates = without_blank + [new_candidate] + blank_rows
    save_candidates(candidates)
    return new_candidate


def delete_candidate(candidate_id: str) -> dict[str, str]:
    if candidate_id == "blanco":
        raise ValueError("El voto en blanco no se puede eliminar")

    candidates = load_candidates()
    remaining = [candidate for candidate in candidates if candidate["id"] != candidate_id]
    if len(remaining) == len(candidates):
        raise ValueError("Candidato no válido")

    removed = next(candidate for candidate in candidates if candidate["id"] == candidate_id)
    save_candidates(remaining)
    return removed


def update_candidate(candidate_id: str, payload: dict[str, Any]) -> dict[str, str]:
    editable_fields = {
        "name",
        "journey",
        "ficha",
        "program",
        "program_label",
        "photo",
        "photo_fit",
        "photo_position",
        "photo_size",
        "proposal",
    }
    candidates = load_candidates()
    for candidate in candidates:
        if candidate["id"] == candidate_id:
            for field in editable_fields:
                if field in payload:
                    value = str(payload[field]).strip()
                    candidate[field] = save_candidate_photo(candidate_id, value) if field == "photo" else value
            save_candidates(candidates)
            return candidate
    raise ValueError("Candidato no válido")


def load_vote_store() -> dict[str, Any]:
    ensure_data_files()
    try:
        with VOTES_FILE.open("r", encoding="utf-8-sig") as file:
            raw_data: Any = json.load(file)
    except (JSONDecodeError, OSError, ValueError):
        save_vote_store(EMPTY_STORE.copy())
        return EMPTY_STORE.copy()

    if isinstance(raw_data, dict) and "votes" in raw_data and "last_id" in raw_data:
        return {"last_id": int(raw_data["last_id"]), "votes": list(raw_data["votes"])}

    save_vote_store(EMPTY_STORE.copy())
    return EMPTY_STORE.copy()


def save_vote_store(store: dict[str, Any]) -> None:
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    write_json_text(VOTES_FILE, json.dumps(store, indent=2, ensure_ascii=False))


def candidate_by_id(candidate_id: str) -> dict[str, str] | None:
    return next((candidate for candidate in load_candidates() if candidate["id"] == candidate_id), None)


def register_vote(candidate_id: str, journey: str | None = None, program: str | None = None) -> dict[str, Any]:
    candidate = candidate_by_id(candidate_id)
    if candidate is None:
        raise ValueError("Candidato no válido")

    store = load_vote_store()
    next_id = int(store["last_id"]) + 1
    record = {
        "id": next_id,
        "candidate_id": candidate_id,
        "journey": journey or candidate["journey"],
        "program": program or candidate["program"],
        "created_at": datetime.now().isoformat(timespec="seconds"),
    }

    store["last_id"] = next_id
    store["votes"].append(record)
    save_vote_store(store)
    return record


def vote_counts() -> dict[str, int]:
    store = load_vote_store()
    counts = {candidate["id"]: 0 for candidate in load_candidates()}
    for vote in store["votes"]:
        candidate_id = vote.get("candidate_id")
        if candidate_id in counts:
            counts[candidate_id] += 1
    return counts


def build_results() -> dict[str, Any]:
    store = load_vote_store()
    counts = vote_counts()
    candidates = load_candidates()
    total = sum(counts.values())
    rows = []

    for candidate in candidates:
        count = counts.get(candidate["id"], 0)
        percentage = round((count / total) * 100, 1) if total else 0
        rows.append({**candidate, "votes": count, "percentage": percentage})

    rows.sort(key=lambda item: item["votes"], reverse=True)

    participation = []
    for label in ["Diurna", "Mixta", "Virtual"]:
        count = sum(1 for vote in store["votes"] if vote.get("journey") == label)
        participation.append(
            {
                "label": f"Jornada {label}",
                "votes": count,
                "percentage": round((count / total) * 100, 1) if total else 0,
            }
        )

    return {
        "total": total,
        "last_update": datetime.now().strftime("%d/%m/%Y %H:%M:%S"),
        "last_vote_id": int(store["last_id"]),
        "candidates": rows,
        "participation": participation,
        "vote_records": store["votes"],
    }
