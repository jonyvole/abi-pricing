from fastapi import FastAPI, APIRouter, HTTPException, Header, Depends
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field
from typing import List, Optional
import uuid
from datetime import datetime, timezone, date


ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]
ADMIN_PASSWORD = os.environ.get('ADMIN_PASSWORD', 'changeme')

app = FastAPI()
api_router = APIRouter(prefix="/api")

logger = logging.getLogger(__name__)


# ----- Models -----
class Category(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    slug: str
    order: int = 0
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())


class CategoryCreate(BaseModel):
    name: str
    order: int = 0


class Item(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    category_id: str
    name: str
    color: Optional[str] = None
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())


class ItemCreate(BaseModel):
    category_id: str
    name: str
    color: Optional[str] = None


class PricePoint(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    item_id: str
    date: str  # YYYY-MM-DD
    price: float
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())


class PricePointCreate(BaseModel):
    item_id: str
    date: str
    price: float


class PricePointBulkCreate(BaseModel):
    category_id: str
    date: str
    prices: dict  # item_id -> price


class SnapshotEdit(BaseModel):
    category_id: str
    old_date: str
    new_date: str
    prices: dict  # item_id -> price (empty/None = remove that item from this snapshot)


class SnapshotDelete(BaseModel):
    category_id: str
    date: str


class AdminLogin(BaseModel):
    password: str


class SiteSettings(BaseModel):
    footer_title: str = "ABI Pricing Through Time"
    footer_text_before: str = "Track in-game prices. Stay informed. Use creator code "
    footer_link_label: str = "JonyVole"
    footer_link_url: str = "https://www.arenabreakoutinfinite.com/creatorcode/index.html?codeid=JonyVole"
    footer_text_after: str = "."


DEFAULT_SETTINGS = SiteSettings().model_dump()


# ----- Auth dependency -----
def require_admin(x_admin_token: Optional[str] = Header(None)):
    if x_admin_token != ADMIN_PASSWORD:
        raise HTTPException(status_code=401, detail="Unauthorized")
    return True


def slugify(name: str) -> str:
    return ''.join(c.lower() if c.isalnum() else '-' for c in name).strip('-')


# ----- Public endpoints -----
@api_router.get("/")
async def root():
    return {"message": "ABI Pricing API"}


@api_router.get("/categories", response_model=List[Category])
async def list_categories():
    docs = await db.categories.find({}, {"_id": 0}).sort("order", 1).to_list(1000)
    return docs


@api_router.get("/items", response_model=List[Item])
async def list_items(category_id: Optional[str] = None):
    q = {"category_id": category_id} if category_id else {}
    docs = await db.items.find(q, {"_id": 0}).to_list(2000)
    return docs


@api_router.get("/price-points", response_model=List[PricePoint])
async def list_price_points(item_id: Optional[str] = None):
    q = {"item_id": item_id} if item_id else {}
    docs = await db.price_points.find(q, {"_id": 0}).sort("date", 1).to_list(10000)
    return docs


@api_router.get("/chart-data/{category_id}")
async def chart_data(category_id: str):
    """Return chart data formatted for recharts line chart.
    Output: { items: [{id,name,color}], rows: [{date, <item_id>: price, ...}] }
    """
    items = await db.items.find({"category_id": category_id}, {"_id": 0}).to_list(2000)
    item_ids = [it["id"] for it in items]
    if not item_ids:
        return {"items": [], "rows": []}
    pps = await db.price_points.find({"item_id": {"$in": item_ids}}, {"_id": 0}).sort("date", 1).to_list(20000)
    # Build date map
    dates = {}
    for p in pps:
        d = p["date"]
        dates.setdefault(d, {"date": d})
        dates[d][p["item_id"]] = p["price"]
    rows = sorted(dates.values(), key=lambda r: r["date"])
    return {"items": items, "rows": rows}


# ----- Admin endpoints -----
@api_router.post("/admin/login")
async def admin_login(body: AdminLogin):
    if body.password != ADMIN_PASSWORD:
        raise HTTPException(status_code=401, detail="Invalid password")
    return {"token": ADMIN_PASSWORD}


@api_router.get("/settings", response_model=SiteSettings)
async def get_settings():
    doc = await db.settings.find_one({"_id": "site"}, {"_id": 0})
    if not doc:
        return SiteSettings()
    merged = {**DEFAULT_SETTINGS, **doc}
    return SiteSettings(**merged)


@api_router.put("/settings", response_model=SiteSettings, dependencies=[Depends(require_admin)])
async def update_settings(body: SiteSettings):
    data = body.model_dump()
    await db.settings.update_one({"_id": "site"}, {"$set": data}, upsert=True)
    return body


@api_router.post("/categories", response_model=Category, dependencies=[Depends(require_admin)])
async def create_category(body: CategoryCreate):
    cat = Category(name=body.name, slug=slugify(body.name), order=body.order)
    await db.categories.insert_one(cat.model_dump())
    return cat


@api_router.delete("/categories/{cid}", dependencies=[Depends(require_admin)])
async def delete_category(cid: str):
    items = await db.items.find({"category_id": cid}, {"_id": 0, "id": 1}).to_list(2000)
    item_ids = [it["id"] for it in items]
    await db.price_points.delete_many({"item_id": {"$in": item_ids}})
    await db.items.delete_many({"category_id": cid})
    res = await db.categories.delete_one({"id": cid})
    if res.deleted_count == 0:
        raise HTTPException(404, "Not found")
    return {"ok": True}


@api_router.post("/items", response_model=Item, dependencies=[Depends(require_admin)])
async def create_item(body: ItemCreate):
    cat = await db.categories.find_one({"id": body.category_id}, {"_id": 0})
    if not cat:
        raise HTTPException(404, "Category not found")
    item = Item(category_id=body.category_id, name=body.name, color=body.color)
    await db.items.insert_one(item.model_dump())
    return item


@api_router.delete("/items/{iid}", dependencies=[Depends(require_admin)])
async def delete_item(iid: str):
    await db.price_points.delete_many({"item_id": iid})
    res = await db.items.delete_one({"id": iid})
    if res.deleted_count == 0:
        raise HTTPException(404, "Not found")
    return {"ok": True}


@api_router.post("/price-points", response_model=PricePoint, dependencies=[Depends(require_admin)])
async def create_price_point(body: PricePointCreate):
    # Validate date
    try:
        datetime.strptime(body.date, "%Y-%m-%d")
    except ValueError:
        raise HTTPException(400, "Invalid date format, use YYYY-MM-DD")
    item = await db.items.find_one({"id": body.item_id}, {"_id": 0})
    if not item:
        raise HTTPException(404, "Item not found")
    # Upsert: if same item+date exists, replace
    existing = await db.price_points.find_one({"item_id": body.item_id, "date": body.date}, {"_id": 0})
    if existing:
        await db.price_points.update_one(
            {"item_id": body.item_id, "date": body.date},
            {"$set": {"price": body.price}}
        )
        existing["price"] = body.price
        return existing
    pp = PricePoint(item_id=body.item_id, date=body.date, price=body.price)
    await db.price_points.insert_one(pp.model_dump())
    return pp


@api_router.post("/price-points/bulk", dependencies=[Depends(require_admin)])
async def create_price_points_bulk(body: PricePointBulkCreate):
    try:
        datetime.strptime(body.date, "%Y-%m-%d")
    except ValueError:
        raise HTTPException(400, "Invalid date format, use YYYY-MM-DD")
    created = []
    for item_id, price in body.prices.items():
        if price is None or price == "":
            continue
        try:
            price_f = float(price)
        except (TypeError, ValueError):
            continue
        existing = await db.price_points.find_one({"item_id": item_id, "date": body.date}, {"_id": 0})
        if existing:
            await db.price_points.update_one(
                {"item_id": item_id, "date": body.date},
                {"$set": {"price": price_f}}
            )
            existing["price"] = price_f
            created.append(existing)
        else:
            pp = PricePoint(item_id=item_id, date=body.date, price=price_f)
            await db.price_points.insert_one(pp.model_dump())
            created.append(pp.model_dump())
    return {"created": len(created), "items": created}


@api_router.delete("/price-points/{pid}", dependencies=[Depends(require_admin)])
async def delete_price_point(pid: str):
    res = await db.price_points.delete_one({"id": pid})
    if res.deleted_count == 0:
        raise HTTPException(404, "Not found")
    return {"ok": True}


@api_router.post("/price-points/edit-snapshot", dependencies=[Depends(require_admin)])
async def edit_snapshot(body: SnapshotEdit):
    try:
        datetime.strptime(body.old_date, "%Y-%m-%d")
        datetime.strptime(body.new_date, "%Y-%m-%d")
    except ValueError:
        raise HTTPException(400, "Invalid date format, use YYYY-MM-DD")
    items = await db.items.find({"category_id": body.category_id}, {"_id": 0, "id": 1}).to_list(2000)
    valid_item_ids = {it["id"] for it in items}
    affected = 0
    for item_id, raw in body.prices.items():
        if item_id not in valid_item_ids:
            continue
        # Empty / None / "" -> remove from old_date snapshot
        if raw is None or raw == "":
            await db.price_points.delete_many({"item_id": item_id, "date": body.old_date})
            affected += 1
            continue
        try:
            price_f = float(raw)
        except (TypeError, ValueError):
            continue
        # Always remove old date entry first (handles rename + same-date upsert)
        await db.price_points.delete_many({"item_id": item_id, "date": body.old_date})
        # If new_date != old_date and there's already a different entry at new_date, replace it
        await db.price_points.delete_many({"item_id": item_id, "date": body.new_date})
        pp = PricePoint(item_id=item_id, date=body.new_date, price=price_f)
        await db.price_points.insert_one(pp.model_dump())
        affected += 1
    return {"affected": affected, "old_date": body.old_date, "new_date": body.new_date}


@api_router.post("/price-points/delete-snapshot", dependencies=[Depends(require_admin)])
async def delete_snapshot(body: SnapshotDelete):
    items = await db.items.find({"category_id": body.category_id}, {"_id": 0, "id": 1}).to_list(2000)
    item_ids = [it["id"] for it in items]
    res = await db.price_points.delete_many({"item_id": {"$in": item_ids}, "date": body.date})
    return {"deleted": res.deleted_count}


# ----- Seed -----
DEFAULT_CATEGORIES = [
    "Helmets", "Masks", "Body Armour", "Unarmoured Chest Rigs",
    "Backpacks", "Headsets", "Tier 3 Ammo", "Tier 4 Ammo",
    "Tier 5 Ammo", "Grenades"
]

DEFAULT_ITEMS = {
    "Helmets": [
        ("MICH 2000", "#FFB300"),
        ("LShZ-2DTM", "#4CAF50"),
        ("Altyn", "#FF3B30"),
        ("Maska-1Sch", "#3DA9FC"),
    ],
    "Tier 5 Ammo": [
        ("7.62x39 BP", "#FFB300"),
        ("5.45x39 7N39", "#4CAF50"),
        ("12.7x55 PS12B", "#FF3B30"),
    ],
}

SAMPLE_DATES = ["2025-09-01", "2025-10-01", "2025-11-01", "2025-12-01", "2026-01-01"]


@app.on_event("startup")
async def seed_db():
    count = await db.categories.count_documents({})
    if count > 0:
        return
    logger.info("Seeding default categories and sample data...")
    for i, name in enumerate(DEFAULT_CATEGORIES):
        cat = Category(name=name, slug=slugify(name), order=i)
        await db.categories.insert_one(cat.model_dump())
        items_for_cat = DEFAULT_ITEMS.get(name, [])
        for j, (item_name, color) in enumerate(items_for_cat):
            item = Item(category_id=cat.id, name=item_name, color=color)
            await db.items.insert_one(item.model_dump())
            base = 1000 * (j + 1)
            for k, d in enumerate(SAMPLE_DATES):
                price = base + (k * 200) + (j * 50)
                pp = PricePoint(item_id=item.id, date=d, price=float(price))
                await db.price_points.insert_one(pp.model_dump())
    logger.info("Seed complete.")


app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)


@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
