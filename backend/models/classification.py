from datetime import datetime

def classification_document(classification, confidence, image_data, mimetype):
    return {
        "classification": classification,
        "confidence": confidence,
        "imageData": image_data,
        "mimetype": mimetype,
        "createdAt": datetime.utcnow()
    }