"""API du service data (appelée par l'API Symfony, jamais directement par le navigateur).

    GET  /health                                  supervision (Florian)
    POST /scores                                  calcul du score d'un diagnostic (US-04)
    GET  /veille/texts?theme=&naf=&since=&limit=  textes réglementaires récents (US-11)
    GET  /organizations/{id}/indicators           indicateurs du tableau de bord central
    GET  /quality                                 contrôles de qualité des données

Authentification service à service : en-tête `X-Service-Token` comparé à la variable SERVICE_TOKEN.
Documentation interactive : /docs (générée par FastAPI).
"""

from __future__ import annotations

import hmac
import json
import os
from datetime import date
from functools import lru_cache
from pathlib import Path

from fastapi import Depends, FastAPI, Header, HTTPException, Query
from pydantic import BaseModel, Field

from . import __version__, indicators, quality, scoring, taxonomy
from .db import create_data_tables, get_engine
from .regulatory.store import list_texts

QUESTIONNAIRES_DIR = Path(__file__).parent

app = FastAPI(title="Réglo · service data", version=__version__,
              description="Score du diagnostic, veille réglementaire, indicateurs et qualité des données.")


@lru_cache
def engine():
    eng = get_engine()
    create_data_tables(eng, include_app=os.environ.get("REGLO_DEMO_APP_TABLES") == "1")
    return eng


def require_token(x_service_token: str | None = Header(default=None)) -> None:
    expected = os.environ.get("SERVICE_TOKEN")
    if expected is None:
        return  # développement local : pas de jeton configuré
    if not x_service_token or not hmac.compare_digest(x_service_token, expected):
        raise HTTPException(status_code=401, detail="Jeton de service invalide.")


@lru_cache
def load_questionnaire(version: str) -> dict:
    """Questionnaire publié. En attendant le contenu réel, seul l'exemple fictif est disponible."""
    if version != "exemple-1":
        raise HTTPException(status_code=404, detail=f"Questionnaire « {version} » inconnu.")
    return json.loads((QUESTIONNAIRES_DIR / "questionnaire_example.json").read_text(encoding="utf-8"))


class AnswerIn(BaseModel):
    question_id: str
    value: bool | int | str | list[str] | None = None
    not_applicable: bool = False
    justification: str | None = Field(default=None, max_length=5000)
    has_document: bool = False


class ScoreRequest(BaseModel):
    questionnaire_version: str
    answers: list[AnswerIn]
    # Questionnaire envoyé par l'API Symfony avec les réponses (US-06) : une seule source
    # (api/config/questionnaire/), donc pas de copie qui diverge. Contrôlé comme les publiés.
    questionnaire: dict | None = None


def request_questionnaire(req: ScoreRequest) -> dict:
    if req.questionnaire is None:
        return load_questionnaire(req.questionnaire_version)
    errors = scoring.validate_questionnaire(req.questionnaire)
    if errors:
        raise HTTPException(status_code=422, detail={"message": "Questionnaire invalide.", "errors": errors})
    if req.questionnaire.get("version") != req.questionnaire_version:
        raise HTTPException(status_code=422, detail="La version du questionnaire ne correspond pas.")
    return req.questionnaire


@app.get("/health")
def health():
    return {"status": "ok", "version": __version__, "algo_version": scoring.ALGO_VERSION}


@app.post("/scores", dependencies=[Depends(require_token)])
def compute_scores(req: ScoreRequest):
    questionnaire = request_questionnaire(req)
    try:
        result = scoring.compute(questionnaire, [scoring.Answer(**a.model_dump()) for a in req.answers])
    except scoring.ScoringError as e:
        # US-03 : le diagnostic ne peut pas être validé tant que des champs obligatoires sont vides.
        raise HTTPException(status_code=422, detail={"message": "Diagnostic incomplet ou invalide.", "errors": e.errors})
    return {
        "algo_version": result.algo_version,
        "questionnaire_version": result.questionnaire_version,
        "global": result.global_score,
        "maturity": result.maturity,
        "pillars": result.pillars,
        "themes": result.themes,
        "coverage": result.coverage,
        "gaps": result.gaps,
    }


@app.get("/veille/texts", dependencies=[Depends(require_token)])
def regulatory_texts(theme: str | None = Query(default=None, description=", ".join(taxonomy.THEMES)),
                     naf: str | None = Query(default=None, min_length=1, max_length=1, description="Section NAF (A à U)"),
                     since: date | None = None, limit: int = Query(default=50, ge=1, le=200)):
    if theme and theme not in taxonomy.THEMES:
        raise HTTPException(status_code=400, detail=f"Thème inconnu. Thèmes : {', '.join(taxonomy.THEMES)}.")
    texts = list_texts(engine(), theme=theme, naf_section=naf.upper() if naf else None, since=since, limit=limit)
    # US-11 : si aucune actualité n'est disponible, l'interface affiche un message (liste vide + total 0).
    return {"total": len(texts), "themes": {k: v["label"] for k, v in taxonomy.THEMES.items()}, "texts": texts}


@app.get("/organizations/{organization_id}/indicators", dependencies=[Depends(require_token)])
def organization_indicators(organization_id: str, due_soon_days: int = Query(default=14, ge=1, le=90)):
    return indicators.organization_indicators(engine(), organization_id, due_soon_days=due_soon_days)


@app.get("/quality", dependencies=[Depends(require_token)])
def data_quality():
    checks = quality.run_checks(engine())
    return {"summary": quality.summary(checks), "checks": checks}
