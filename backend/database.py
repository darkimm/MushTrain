from motor.motor_asyncio import AsyncIOMotorClient
import os
from dotenv import load_dotenv

load_dotenv()

MONGO_URI = os.getenv("MONGODB_URI")  # ← changed from MONGO_URI to MONGODB_URI

client = AsyncIOMotorClient(MONGO_URI)
db = client.mushtrain