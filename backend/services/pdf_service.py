import os
from pdf2image import convert_from_path
import base64
from io import BytesIO

UPLOAD_DIR = "uploads"
THUMBNAIL_DIR = "uploads/thumbnails"

os.makedirs(UPLOAD_DIR, exist_ok=True)
os.makedirs(THUMBNAIL_DIR, exist_ok=True)

async def save_upload_file(upload_file, filename: str) -> str:
    file_path = os.path.join(UPLOAD_DIR, filename)
    with open(file_path, "wb") as buffer:
        content = await upload_file.read()
        buffer.write(content)
    return file_path

def generate_thumbnail(pdf_path: str, filename: str) -> str:
    try:
        images = convert_from_path(pdf_path, first_page=1, last_page=1)
        if images:
            image = images[0]
            # Resize for thumbnail
            image.thumbnail((300, 400))
            
            thumbnail_filename = f"{os.path.splitext(filename)[0]}.jpg"
            thumbnail_path = os.path.join(THUMBNAIL_DIR, thumbnail_filename)
            image.save(thumbnail_path, "JPEG")
            
            # Return relative path or base64? 
            # Let's return the relative path for static serving
            return thumbnail_path
    except Exception as e:
        print(f"Error generating thumbnail: {e}")
        return ""

def get_thumbnail_base64(thumbnail_path: str) -> str:
    if not thumbnail_path or not os.path.exists(thumbnail_path):
        return ""
    with open(thumbnail_path, "rb") as image_file:
        encoded_string = base64.b64encode(image_file.read()).decode('utf-8')
        return f"data:image/jpeg;base64,{encoded_string}"
