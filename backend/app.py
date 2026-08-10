from __future__ import annotations

from io import BytesIO
from pathlib import Path

from flask import Flask, jsonify, redirect, request, send_file, send_from_directory, session
from flask_cors import CORS
from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_RIGHT
from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.platypus import Image, Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle

from data_store import build_results, create_candidate, delete_candidate, load_candidates, register_vote, update_candidate


ROOT_DIR = Path(__file__).resolve().parent.parent
FRONTEND_DIR = ROOT_DIR / "frontend"

app = Flask(__name__, static_folder=str(FRONTEND_DIR), static_url_path="")
app.config["SECRET_KEY"] = "sena-vota-admin-session-2026"
CORS(app, supports_credentials=True)

ADMIN_PASSWORD = "Adminos_2026"
ADMIN_PAGE_PATHS = {
    "/admin",
    "/admin.html",
    "/resultados",
    "/resultados.html",
    "/reportes",
    "/reportes.html",
}
ADMIN_OPEN_PATHS = {
    "/admin-login",
    "/admin-login.html",
    "/api/admin/login",
    "/api/admin/logout",
    "/api/admin/session",
}


def send_page(filename: str):
    return send_from_directory(FRONTEND_DIR, filename)


def requires_admin_access() -> bool:
    if request.path in ADMIN_OPEN_PATHS:
        return False
    if request.path in ADMIN_PAGE_PATHS:
        return True
    if request.path in {"/api/results", "/api/reports", "/api/reports/pdf"}:
        return True
    if request.path.startswith("/api/candidates") and request.method in {"POST", "PUT", "DELETE"}:
        return True
    return False


@app.before_request
def protect_admin_area():
    if not requires_admin_access() or session.get("admin_authenticated"):
        return None
    if request.path.startswith("/api/"):
        return jsonify({"message": "Clave de acceso requerida"}), 401
    return redirect(f"/admin-login.html?next={request.path}")


@app.after_request
def prevent_admin_cache(response):
    if request.path in ADMIN_PAGE_PATHS or request.path in ADMIN_OPEN_PATHS or request.path.startswith("/api/admin"):
        response.headers["Cache-Control"] = "no-store, no-cache, must-revalidate, max-age=0"
        response.headers["Pragma"] = "no-cache"
        response.headers["Expires"] = "0"
    return response


@app.get("/")
def home():
    return send_page("index.html")


def clean_admin_next(raw_next: str | None) -> str:
    allowed = {"admin.html", "/admin.html", "/admin", "resultados.html", "/resultados.html", "reportes.html", "/reportes.html"}
    next_page = raw_next or "admin.html"
    if next_page not in allowed:
        return "admin.html"
    if next_page == "/admin":
        return "admin.html"
    return next_page.lstrip("/")


@app.get("/admin-login")
@app.get("/admin-login.html")
def admin_login_page():
    return send_page("admin-login.html")


@app.post("/admin-login")
def admin_login_form():
    password = str(request.form.get("password") or "").strip()
    next_page = clean_admin_next(request.form.get("next"))
    if password != ADMIN_PASSWORD:
        return redirect(f"/admin-login.html?error=1&next={next_page}")
    session["admin_authenticated"] = True
    return redirect(f"/{next_page}")


@app.post("/api/admin/login")
def admin_login():
    payload = request.get_json(silent=True) or {}
    password = str(payload.get("password") or "").strip()
    if password != ADMIN_PASSWORD:
        return jsonify({"message": "Clave incorrecta"}), 401
    session["admin_authenticated"] = True
    return jsonify({"message": "Acceso permitido"})


@app.post("/api/admin/logout")
def admin_logout():
    session.pop("admin_authenticated", None)
    return jsonify({"message": "Sesión cerrada"})


@app.get("/api/admin/session")
def admin_session():
    return jsonify({"authenticated": bool(session.get("admin_authenticated"))})


@app.get("/votar")
def vote_page():
    return send_page("votar.html")


@app.get("/revision")
def review_page():
    return send_page("revision.html")


@app.get("/confirmacion")
def confirmation_page():
    return send_page("confirmacion.html")


@app.get("/admin")
def admin_page():
    return send_page("admin.html")


@app.get("/resultados")
def results_page():
    return send_page("resultados.html")


@app.get("/reportes")
def reports_page():
    return send_page("reportes.html")


@app.get("/ayuda")
def help_page():
    return send_page("ayuda.html")


@app.get("/privacidad")
def privacy_page():
    return send_page("privacidad.html")


@app.get("/terminos")
def terms_page():
    return send_page("terminos.html")


@app.get("/transparencia")
def transparency_page():
    return send_page("transparencia.html")


@app.get("/api/candidates")
def candidates():
    return jsonify(load_candidates())


@app.post("/api/candidates")
def add_candidate():
    payload = request.get_json(silent=True) or {}
    candidate = create_candidate(payload)
    return jsonify({"message": "Candidato creado", "candidate": candidate}), 201


@app.put("/api/candidates/<candidate_id>")
def edit_candidate(candidate_id):
    payload = request.get_json(silent=True) or {}
    try:
        candidate = update_candidate(candidate_id, payload)
    except ValueError as error:
        return jsonify({"message": str(error)}), 404
    return jsonify({"message": "Candidato actualizado", "candidate": candidate})


@app.delete("/api/candidates/<candidate_id>")
def remove_candidate(candidate_id):
    try:
        candidate = delete_candidate(candidate_id)
    except ValueError as error:
        return jsonify({"message": str(error)}), 400
    return jsonify({"message": "Candidato eliminado", "candidate": candidate})


@app.get("/api/results")
def results():
    return jsonify(build_results())


@app.post("/api/vote")
def vote():
    payload = request.get_json(silent=True) or {}
    candidate_id = payload.get("candidate_id")
    journey = payload.get("journey")
    program = payload.get("program")

    try:
        vote_record = register_vote(candidate_id, journey, program)
    except ValueError as error:
        return jsonify({"message": str(error)}), 400

    return jsonify({"message": "Voto registrado correctamente", "vote": vote_record, "results": build_results()})


@app.get("/api/reports")
def reports():
    return jsonify(build_results())


@app.get("/api/reports/pdf")
def reports_pdf():
    data = build_results()
    candidate_count = len(data["candidates"])
    buffer = BytesIO()
    document = SimpleDocTemplate(buffer, pagesize=letter, rightMargin=34, leftMargin=34, topMargin=28, bottomMargin=28)
    styles = getSampleStyleSheet()
    title_style = ParagraphStyle(
        "ReportTitle",
        parent=styles["Title"],
        textColor=colors.white,
        fontSize=24,
        leading=28,
        alignment=TA_RIGHT,
        spaceAfter=0,
    )
    subtitle_style = ParagraphStyle(
        "ReportSubtitle",
        parent=styles["Normal"],
        textColor=colors.white,
        fontSize=9,
        leading=11,
        alignment=TA_RIGHT,
    )
    label_style = ParagraphStyle(
        "MetricLabel",
        parent=styles["Normal"],
        textColor=colors.HexColor("#475447"),
        fontSize=7,
        leading=8,
        alignment=TA_CENTER,
    )
    value_style = ParagraphStyle(
        "MetricValue",
        parent=styles["Heading2"],
        textColor=colors.HexColor("#124b00"),
        fontSize=18,
        leading=20,
        alignment=TA_CENTER,
    )
    candidate_style = ParagraphStyle("CandidateCell", parent=styles["BodyText"], fontSize=9, leading=10)
    detail_style = ParagraphStyle(
        "DetailCell",
        parent=styles["BodyText"],
        fontSize=7.5,
        leading=9,
        textColor=colors.HexColor("#4d5a4d"),
    )

    logo_path = FRONTEND_DIR / "assets" / "logo-sena.png"
    logo = Image(str(logo_path), width=42, height=42) if logo_path.exists() else Paragraph("SENA", title_style)
    header = Table(
        [
            [logo, Paragraph("REPORTE DE VOTACION", title_style)],
            ["", Paragraph(f"Generado: {data['last_update']} | Sistema SENA Vota", subtitle_style)],
        ],
        colWidths=[70, 474],
        rowHeights=[48, 22],
    )
    header.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#145a32")),
                ("BACKGROUND", (0, 1), (-1, 1), colors.HexColor("#0f3f25")),
                ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                ("ALIGN", (0, 0), (0, 0), "CENTER"),
                ("LEFTPADDING", (0, 0), (-1, -1), 14),
                ("RIGHTPADDING", (0, 0), (-1, -1), 14),
                ("TOPPADDING", (0, 0), (-1, -1), 8),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 8),
            ]
        )
    )

    metrics = Table(
        [
            [
                [Paragraph(str(data["total"]), value_style), Paragraph("Votos registrados", label_style)],
                [Paragraph(str(candidate_count), value_style), Paragraph("Candidatos registrados", label_style)],
                [Paragraph(str(data["last_vote_id"]), value_style), Paragraph("Ultimo ID de voto", label_style)],
            ]
        ],
        colWidths=[174, 174, 174],
        rowHeights=[58],
    )
    metrics.setStyle(
        TableStyle(
            [
                ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#cfe2c8")),
                ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#f4fbf1")),
                ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                ("LEFTPADDING", (0, 0), (-1, -1), 8),
                ("RIGHTPADDING", (0, 0), (-1, -1), 8),
            ]
        )
    )

    table_data = [["No.", "Candidato", "Jornada y programa", "Votos"]]
    for candidate in data["candidates"]:
        detail = " - ".join(
            item
            for item in [
                f"Ficha {candidate['ficha']}" if candidate.get("ficha") else "",
                candidate["journey"],
                candidate["program_label"],
            ]
            if item
        )
        table_data.append(
            [
                candidate["number"],
                Paragraph(candidate["name"], candidate_style),
                Paragraph(detail, detail_style),
                str(candidate["votes"]),
            ]
        )

    table_data.append(["", "Total votos validos", "", str(data["total"])])

    table = Table(table_data, colWidths=[44, 170, 250, 58], repeatRows=1)
    table.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#39a900")),
                ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
                ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#d8e6d0")),
                ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
                ("FONTSIZE", (0, 0), (-1, 0), 8),
                ("FONTSIZE", (0, 1), (-1, -1), 8.5),
                ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#f6f8f4")]),
                ("FONTNAME", (0, -1), (-1, -1), "Helvetica-Bold"),
                ("BACKGROUND", (0, -1), (-1, -1), colors.HexColor("#eef8e9")),
                ("ALIGN", (0, 1), (0, -1), "CENTER"),
                ("ALIGN", (3, 1), (3, -1), "RIGHT"),
                ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                ("TOPPADDING", (0, 0), (-1, -1), 5),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
                ("LEFTPADDING", (0, 0), (-1, -1), 7),
                ("RIGHTPADDING", (0, 0), (-1, -1), 7),
            ]
        )
    )

    footer = Paragraph(
        "Reporte consolidado para administracion. Los aprendices no ven resultados ni reportes en el flujo de votacion.",
        ParagraphStyle(
            "FooterNote",
            parent=styles["Normal"],
            fontSize=8,
            leading=10,
            textColor=colors.HexColor("#5d6a5d"),
            alignment=TA_CENTER,
        ),
    )
    story = [header, Spacer(1, 14), metrics, Spacer(1, 14), table, Spacer(1, 12), footer]

    document.build(story)
    buffer.seek(0)
    return send_file(buffer, mimetype="application/pdf", as_attachment=True, download_name="reporte-sena-vota.pdf")


if __name__ == "__main__":
    app.run(debug=True, host="127.0.0.1", port=5000)
