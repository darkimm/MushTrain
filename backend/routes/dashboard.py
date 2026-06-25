from fastapi import APIRouter
from backend.database import db

router = APIRouter()

@router.get("/dashboard/stats")
async def get_stats():
    total_scans = await db.classifications.count_documents({})
    pipeline = [{"$group": {"_id": "$classification", "count": {"$sum": 1}}}]
    breakdown = {}
    async for doc in db.classifications.aggregate(pipeline):
        breakdown[doc["_id"]] = doc["count"]
    most_common = max(breakdown, key=breakdown.get) if breakdown else "—"
    last_scan = await db.classifications.find_one(sort=[("createdAt", -1)])
    return {
        "totalScans": total_scans,
        "mostCommon": most_common,
        "lastScanAt": last_scan["createdAt"].isoformat() if last_scan else None,
        "breakdown": breakdown
    }

@router.get("/dashboard/breakdown")
async def get_breakdown():
    result = {"fresh": 0, "damaged": 0, "rotten": 0}
    async for doc in db.classifications.aggregate([
        {"$group": {"_id": "$classification", "count": {"$sum": 1}}}
    ]):
        result[doc["_id"]] = doc["count"]
    return result

@router.get("/dashboard/timeline")
async def get_timeline():
    pipeline = [
        {"$group": {
            "_id": {"$dateToString": {"format": "%Y-%m-%d", "date": "$createdAt"}},
            "count": {"$sum": 1}
        }},
        {"$sort": {"_id": 1}},
        {"$limit": 14}
    ]
    labels, counts = [], []
    async for doc in db.classifications.aggregate(pipeline):
        labels.append(doc["_id"])
        counts.append(doc["count"])
    return {"labels": labels, "counts": counts}

@router.get("/dashboard/recent")
async def get_recent():
    results = []
    async for doc in db.classifications.find().sort("createdAt", -1).limit(10):
        doc["_id"] = str(doc["_id"])
        doc["createdAt"] = doc["createdAt"].isoformat()
        results.append(doc)
    return results

@router.get("/model/info")
async def get_model_info():
    return {
        "name": "MushTrain CNN v1",
        "architecture": "MobileNetV2 + Custom Head",
        "inputSize": "224x224",
        "classes": ["fresh", "damaged", "rotten"],
        "framework": "TensorFlow/Keras",
        "technique": "Transfer Learning + Fine-tuning"
    }