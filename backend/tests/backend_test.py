import os
import pytest
import requests

BASE = os.environ.get("REACT_APP_BACKEND_URL", "https://chart-customizer.preview.emergentagent.com").rstrip("/")
API = f"{BASE}/api"
PW = "jonyvole2026"
HDR = {"X-Admin-Token": PW}


def test_root():
    r = requests.get(f"{API}/")
    assert r.status_code == 200


def test_categories_seeded():
    r = requests.get(f"{API}/categories")
    assert r.status_code == 200
    cats = r.json()
    names = [c["name"] for c in cats]
    expected = ["Helmets", "Masks", "Body Armour", "Unarmoured Chest Rigs", "Backpacks",
                "Headsets", "Tier 3 Ammo", "Tier 4 Ammo", "Tier 5 Ammo", "Grenades"]
    for e in expected:
        assert e in names, f"Missing {e}"
    # sorted by order
    orders = [c["order"] for c in cats]
    assert orders == sorted(orders)


def _get_cat(name):
    r = requests.get(f"{API}/categories")
    return next(c for c in r.json() if c["name"] == name)


def test_chart_data_helmets():
    cat = _get_cat("Helmets")
    r = requests.get(f"{API}/chart-data/{cat['id']}")
    assert r.status_code == 200
    data = r.json()
    item_names = [i["name"] for i in data["items"]]
    for n in ["MICH 2000", "LShZ-2DTM", "Altyn", "Maska-1Sch"]:
        assert n in item_names
    assert len(data["rows"]) == 5


def test_admin_login_correct():
    r = requests.post(f"{API}/admin/login", json={"password": PW})
    assert r.status_code == 200
    assert r.json()["token"] == PW


def test_admin_login_wrong():
    r = requests.post(f"{API}/admin/login", json={"password": "wrong"})
    assert r.status_code == 401


def test_protected_no_token():
    r = requests.post(f"{API}/categories", json={"name": "Nope", "order": 999})
    assert r.status_code == 401


def test_create_category_and_delete_cascades():
    # Create
    r = requests.post(f"{API}/categories", json={"name": "TEST_Cat1", "order": 99}, headers=HDR)
    assert r.status_code == 200, r.text
    cat = r.json()
    cid = cat["id"]
    # In list
    r2 = requests.get(f"{API}/categories")
    assert any(c["id"] == cid for c in r2.json())

    # Create item under it
    r3 = requests.post(f"{API}/items", json={"category_id": cid, "name": "TEST_Item1", "color": "#FFB300"}, headers=HDR)
    assert r3.status_code == 200, r3.text
    item = r3.json()
    iid = item["id"]
    assert item["category_id"] == cid

    # Bulk price points
    r4 = requests.post(f"{API}/price-points/bulk",
                       json={"category_id": cid, "date": "2026-01-01", "prices": {iid: 1234}},
                       headers=HDR)
    assert r4.status_code == 200, r4.text
    assert r4.json()["created"] == 1

    # Upsert single price-point: same item+date replaces
    r5 = requests.post(f"{API}/price-points",
                       json={"item_id": iid, "date": "2026-01-01", "price": 5678},
                       headers=HDR)
    assert r5.status_code == 200, r5.text
    assert r5.json()["price"] == 5678

    # Verify chart-data reflects
    r6 = requests.get(f"{API}/chart-data/{cid}")
    rows = r6.json()["rows"]
    assert len(rows) == 1 and rows[0][iid] == 5678

    # Delete category cascades
    r7 = requests.delete(f"{API}/categories/{cid}", headers=HDR)
    assert r7.status_code == 200
    # Items gone
    r8 = requests.get(f"{API}/items?category_id={cid}")
    assert r8.json() == []
    # Price points gone
    r9 = requests.get(f"{API}/price-points?item_id={iid}")
    assert r9.json() == []


def test_delete_item_cascade():
    cat = _get_cat("Helmets")
    r = requests.post(f"{API}/items", json={"category_id": cat["id"], "name": "TEST_DelItem", "color": "#FFB300"}, headers=HDR)
    iid = r.json()["id"]
    requests.post(f"{API}/price-points",
                  json={"item_id": iid, "date": "2026-02-01", "price": 100},
                  headers=HDR)
    rd = requests.delete(f"{API}/items/{iid}", headers=HDR)
    assert rd.status_code == 200
    rp = requests.get(f"{API}/price-points?item_id={iid}")
    assert rp.json() == []
