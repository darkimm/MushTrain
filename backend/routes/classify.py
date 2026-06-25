from fastapi import APIRouter, UploadFile, File, HTTPException
from PIL import Image
import numpy as np
import tensorflow as tf
import json, io, base64
from datetime import datetime
from backend.database import db  # <-- MOVED TO THE TOP HERE

router = APIRouter()

# Load model once on startup
model = tf.keras.models.load_model('model/mushroom_model.h5')
with open('model/class_indices.json', 'r') as f:
    class_indices = json.load(f)

IMG_SIZE = 224

def preprocess_image(image_bytes):
    img = Image.open(io.BytesIO(image_bytes)).convert('RGB')
    img = img.resize((IMG_SIZE, IMG_SIZE))
    arr = np.array(img) / 255.0
    return np.expand_dims(arr, axis=0)

@router.post("/classify")
async def classify_image(file: UploadFile = File(...)):
    try:
        image_bytes = await file.read()
        img_array = preprocess_image(image_bytes)

        predictions = model.predict(img_array)[0]
        class_idx = int(np.argmax(predictions))
        predicted_class = class_indices[str(class_idx)]

        confidence = {
            class_indices[str(i)]: round(float(predictions[i]) * 100, 1)
            for i in range(len(predictions))
        }

        image_b64 = base64.b64encode(image_bytes).decode('utf-8')

        # Database insert (Notice 'from backend...' is no longer here)
        await db.classifications.insert_one({
            "classification": predicted_class,
            "confidence": confidence,
            "imageData": image_b64,
            "mimetype": file.content_type,
            "createdAt": datetime.utcnow()
        })

        return {
            "success": True,
            "classification": predicted_class,
            "confidence": confidence,
            "model": "MushTrain-CNN-v1"
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))