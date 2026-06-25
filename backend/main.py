from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv
import os

load_dotenv()

app = FastAPI(title="MushTrain API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# MongoDB connection
client = AsyncIOMotorClient(os.getenv("MONGODB_URI"))
db = client.mushtrain  # ← THIS LINE WAS MISSING

# Register routes
from backend.routes.classify import router as classify_router
from backend.routes.dashboard import router as dashboard_router
app.include_router(classify_router)
app.include_router(dashboard_router)

@app.get("/api/health")
async def health():
    return {"status": "ok", "model": "MushTrain-CNN-v1"}

# Serve frontend (must be last)
app.mount("/", StaticFiles(directory="frontend", html=True), name="frontend")