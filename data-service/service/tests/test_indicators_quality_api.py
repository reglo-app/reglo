"""Scénarios de test des indicateurs du tableau de bord, des contrôles de qualité et de l'API."""

from datetime import date, datetime, timezone

import pytest
from fastapi.testclient import TestClient

from reglo_data import api, quality
from reglo_data.db import (action, certificate, create_data_tables, diagnostic, document, enrollment, get_engine,
                           membership, organization, regulatory_alert, regulatory_text, score)
from reglo_data.indicators import organization_indicators

TODAY = date(2026, 10, 13)


def ts(day: str) -> datetime:
    return datetime.fromisoformat(day).replace(tzinfo=timezone.utc)


@pytest.fixture
def engine(tmp_path):
    eng = get_engine(f"sqlite:///{tmp_path / 'demo.sqlite'}")
    create_data_tables(eng, include_app=True)
    with eng.begin() as c:
        c.execute(organization.insert(), [{"id": "org1", "name": "Atelier du Val"}, {"id": "org2", "name": "Autre"}])
        c.execute(membership.insert(), [{"organization_id": "org1", "user_id": u, "role": "user"} for u in ("u1", "u2", "u3", "u4")]
                  + [{"organization_id": "org2", "user_id": "x1", "role": "user"}])
        c.execute(diagnostic.insert(), [
            {"id": "d1", "organization_id": "org1", "questionnaire_version": "exemple-1", "status": "validated", "validated_at": ts("2026-03-01")},
            {"id": "d2", "organization_id": "org1", "questionnaire_version": "exemple-1", "status": "validated", "validated_at": ts("2026-09-01")},
            {"id": "d3", "organization_id": "org1", "questionnaire_version": "exemple-1", "status": "draft", "validated_at": None},
            {"id": "dx", "organization_id": "org2", "questionnaire_version": "exemple-1", "status": "validated", "validated_at": ts("2026-10-01")},
        ])
        c.execute(score.insert(), [
            {"diagnostic_id": "d1", "scope": "global", "key": "global", "value": 40.0, "algo_version": "1.0.0"},
            {"diagnostic_id": "d2", "scope": "global", "key": "global", "value": 55.5, "algo_version": "1.0.0"},
            {"diagnostic_id": "d2", "scope": "pillar", "key": "social", "value": 70.0, "algo_version": "1.0.0"},
            {"diagnostic_id": "dx", "scope": "global", "key": "global", "value": 99.0, "algo_version": "1.0.0"},
        ])
        c.execute(action.insert(), [
            {"id": "a1", "organization_id": "org1", "status": "todo", "due_date": date(2026, 10, 1), "created_at": ts("2026-09-01")},       # en retard
            {"id": "a2", "organization_id": "org1", "status": "in_progress", "due_date": date(2026, 10, 20), "created_at": ts("2026-09-01")},  # proche
            {"id": "a3", "organization_id": "org1", "status": "done", "due_date": date(2026, 9, 1), "created_at": ts("2026-08-01")},
            {"id": "a4", "organization_id": "org1", "status": "todo", "due_date": date(2026, 12, 31), "created_at": ts("2026-09-01")},
            {"id": "ax", "organization_id": "org2", "status": "todo", "due_date": date(2026, 1, 1), "created_at": ts("2026-09-01")},
        ])
        c.execute(enrollment.insert(), [
            {"user_id": "u1", "module_id": "m1", "organization_id": "org1", "progress": 1.0, "quiz_score": 80.0, "completed_at": ts("2026-09-10")},
            {"user_id": "u2", "module_id": "m1", "organization_id": "org1", "progress": 1.0, "quiz_score": 60.0, "completed_at": ts("2026-09-12")},
            {"user_id": "u3", "module_id": "m1", "organization_id": "org1", "progress": 0.4, "quiz_score": None, "completed_at": None},
        ])
        c.execute(certificate.insert(), [{"id": "c1", "organization_id": "org1", "user_id": "u1", "verification_code": "ABC123"}])
        c.execute(document.insert(), [
            {"id": "doc1", "organization_id": "org1", "mime": "application/pdf", "size_bytes": 1000, "uploaded_at": ts("2026-10-02")},
            {"id": "doc2", "organization_id": "org1", "mime": "application/x-msdownload", "size_bytes": 1000, "uploaded_at": ts("2026-10-03")},
        ])
        c.execute(regulatory_alert.insert(), [{"organization_id": "org1", "text_id": "T1", "read_at": None},
                                              {"organization_id": "org1", "text_id": "T2", "read_at": ts("2026-10-05")}])
        c.execute(regulatory_text.insert(), [{"id": "T1", "source": "JORF", "nature": "DECRET", "reference": "R1", "title": "Prévention",
                                              "published_at": date(2026, 10, 12), "url": "https://x", "themes": ["social"],
                                              "naf_scope": [], "collected_at": ts("2026-10-12")}])
    return eng


def test_indicateurs_d_une_organisation(engine):
    ind = organization_indicators(engine, "org1", today=TODAY)
    assert ind["score"]["global"] == 55.5 and ind["score"]["pillars"] == {"social": 70.0}
    assert ind["score"]["evolution"] == 15.5                     # 55,5 − 40 (US-10)
    assert ind["actions"]["total"] == 4 and ind["actions"]["late"] == 1 and ind["actions"]["due_soon"] == 1
    assert ind["actions"]["completion_rate"] == 0.25
    assert ind["training"]["completion_rate"] == round(2 / 3, 3) and ind["training"]["trained_members_share"] == 0.5
    assert ind["training"]["average_quiz_score"] == 70.0
    assert ind["certificates"] == 1 and ind["documents"]["count"] == 2 and ind["regulatory_alerts_unread"] == 1


def test_isolation_entre_organisations(engine):
    ind = organization_indicators(engine, "org2", today=TODAY)
    assert ind["score"]["global"] == 99.0 and ind["actions"]["total"] == 1 and ind["certificates"] == 0
    assert organization_indicators(engine, "inconnue", today=TODAY)["actions"]["total"] == 0


def test_controles_de_qualite(engine):
    checks = {c["id"]: c for c in quality.run_checks(engine, today=TODAY)}
    assert checks["veille_fraicheur"]["status"] == "ok"
    assert checks["document_format"]["anomalies"] == 1           # exécutable refusé
    assert checks["diagnostic_sans_score"]["status"] == "ok"
    assert checks["score_bornes"]["status"] == "ok"
    s = quality.summary(list(checks.values()))
    assert s["checks"] == len(checks) and s["erreurs"] == 1


def test_qualite_detecte_veille_perimee(engine):
    late = {c["id"]: c for c in quality.run_checks(engine, today=date(2026, 12, 1))}
    assert late["veille_fraicheur"]["status"] == "alerte" and late["veille_fraicheur"]["corrective_action"]


@pytest.fixture
def client(engine, monkeypatch):
    monkeypatch.setattr(api, "engine", lambda: engine)
    monkeypatch.delenv("SERVICE_TOKEN", raising=False)
    return TestClient(api.app)


def test_api_sante(client):
    assert client.get("/health").json()["status"] == "ok"


def test_api_score(client):
    answers = [{"question_id": q, "value": v} for q, v in [
        ("S1", "no"), ("S2", 0), ("S3", "no"), ("S4", "lt25"), ("E1", "no"), ("E2", []), ("E3", 0),
        ("H1", 0), ("H2", "no"), ("G1", "no"), ("G2", 0)]]
    r = client.post("/scores", json={"questionnaire_version": "exemple-1", "answers": answers})
    assert r.status_code == 200 and r.json()["global"] == 0.0 and len(r.json()["gaps"]) == 3


def test_api_score_incomplet_refuse(client):
    r = client.post("/scores", json={"questionnaire_version": "exemple-1", "answers": [{"question_id": "S1", "value": "yes"}]})
    assert r.status_code == 422 and r.json()["detail"]["errors"]


def test_api_questionnaire_inconnu(client):
    assert client.post("/scores", json={"questionnaire_version": "v99", "answers": []}).status_code == 404


QUESTIONNAIRE_ENVOYE = {
    "version": "envoye-1",
    "pillars": [{"id": "safety", "label": "Sécurité", "weight": 1, "themes": [
        {"id": "risques", "label": "Risques", "weight": 1, "questions": [
            {"id": "safety.risques.01", "label": "DUERP à jour ?", "type": "yes_no", "weight": 1}]}]}],
}


def test_api_score_avec_questionnaire_envoye(client):
    """US-06 : l'API Symfony envoie son questionnaire avec les réponses."""
    r = client.post("/scores", json={"questionnaire_version": "envoye-1", "questionnaire": QUESTIONNAIRE_ENVOYE,
                                     "answers": [{"question_id": "safety.risques.01", "value": "partial"}]})
    assert r.status_code == 200
    assert r.json()["global"] == 50.0 and r.json()["pillars"] == {"safety": 50.0}
    assert r.json()["questionnaire_version"] == "envoye-1"


def test_api_questionnaire_envoye_invalide_refuse(client):
    invalide = {**QUESTIONNAIRE_ENVOYE, "pillars": [{**QUESTIONNAIRE_ENVOYE["pillars"][0], "weight": -1}]}
    r = client.post("/scores", json={"questionnaire_version": "envoye-1", "questionnaire": invalide, "answers": []})
    assert r.status_code == 422
    r = client.post("/scores", json={"questionnaire_version": "autre", "questionnaire": QUESTIONNAIRE_ENVOYE,
                                     "answers": []})
    assert r.status_code == 422


def test_api_veille(client):
    r = client.get("/veille/texts", params={"theme": "social", "since": "2026-10-01"})
    assert r.status_code == 200 and r.json()["total"] == 1
    assert client.get("/veille/texts", params={"theme": "inconnu"}).status_code == 400
    empty = client.get("/veille/texts", params={"theme": "csrd", "since": "2026-10-01"}).json()
    assert empty["total"] == 0 and empty["texts"] == []          # US-11 : l'interface affiche un message


def test_api_indicateurs_et_qualite(client):
    assert client.get("/organizations/org1/indicators").json()["actions"]["total"] == 4
    assert client.get("/quality").json()["summary"]["checks"] >= 8


def test_api_jeton_de_service(client, monkeypatch):
    monkeypatch.setenv("SERVICE_TOKEN", "secret-de-test")
    assert client.get("/quality").status_code == 401
    assert client.get("/quality", headers={"X-Service-Token": "mauvais"}).status_code == 401
    assert client.get("/quality", headers={"X-Service-Token": "secret-de-test"}).status_code == 200
    assert client.get("/health").status_code == 200              # la supervision reste ouverte


def test_qualite_sans_tables_de_la_plateforme(tmp_path):
    eng = get_engine(f"sqlite:///{tmp_path / 'veille_seule.sqlite'}")
    create_data_tables(eng)                                       # schéma veille seulement
    checks = {c["id"]: c for c in quality.run_checks(eng, today=TODAY)}
    assert checks["diagnostic_sans_score"]["status"] == "non applicable"
    assert checks["veille_fraicheur"]["status"] == "alerte"       # base vide : aucune donnée fraîche
