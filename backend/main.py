from fastapi import FastAPI, Depends, HTTPException, UploadFile, File, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from sqlalchemy.orm import Session
from typing import List
from datetime import datetime
import os
import shutil

from database import engine, Base, get_db
import models, schemas
from services import pdf_service, gemini_service

# Create database tables
Base.metadata.create_all(bind=engine)

app = FastAPI()

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, specify the frontend URL
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount static files for thumbnails
app.mount("/uploads", StaticFiles(directory="uploads"), name="uploads")

@app.get("/")
def read_root():
    return {"message": "CyberContract Backend API"}

@app.post("/api/upload", response_model=schemas.Contract)
async def upload_contract(
    file: UploadFile = File(...), 
    db: Session = Depends(get_db),
    background_tasks: BackgroundTasks = None
):
    # 1. Save file
    filename = file.filename
    file_path = await pdf_service.save_upload_file(file, filename)
    
    # 2. Create DB record
    db_contract = models.Contract(
        title=filename,
        filename=filename,
        status="uploading"
    )
    db.add(db_contract)
    db.commit()
    db.refresh(db_contract)
    
    # 3. Generate thumbnail (async or background)
    # For simplicity, we do it synchronously here or use background tasks
    # Using background task for thumbnail and analysis is better
    if background_tasks:
        background_tasks.add_task(process_new_contract, db_contract.id, file_path, filename, db)
    else:
        # Fallback if no background task (shouldn't happen with FastAPI)
        process_new_contract(db_contract.id, file_path, filename, db)

    return db_contract

def process_new_contract(contract_id: int, file_path: str, filename: str, db: Session):
    # Re-fetch contract with a new session if needed, but here we pass ID
    # Note: db session might be closed if passed from route, so better to create new session
    # For simplicity in this demo, we assume we can use a new session
    
    with Session(engine) as session:
        contract = session.query(models.Contract).filter(models.Contract.id == contract_id).first()
        if not contract:
            return

        try:
            # Generate Thumbnail
            thumbnail_path = pdf_service.generate_thumbnail(file_path, filename)
            # We don't store thumbnail path in DB in this simple schema, 
            # but we could. For now, we assume standard naming or just rely on static serving.
            
            # Start Analysis
            contract.status = "analyzing"
            session.commit()
            
            extracted_data = gemini_service.analyze_contract_content(file_path)
            
            contract.extracted_data = extracted_data
            contract.status = "completed"
            session.commit()
            
        except Exception as e:
            print(f"Error processing contract {contract_id}: {e}")
            contract.status = "error"
            session.commit()

# Note: gemini_service.analyze_contract_content is sync now.

@app.get("/api/contracts", response_model=List[schemas.Contract])
def read_contracts(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    contracts = db.query(models.Contract).order_by(models.Contract.created_at.desc()).offset(skip).limit(limit).all()
    return contracts

@app.get("/api/contracts/{contract_id}", response_model=schemas.Contract)
def read_contract(contract_id: int, db: Session = Depends(get_db)):
    contract = db.query(models.Contract).filter(models.Contract.id == contract_id).first()
    if contract is None:
        raise HTTPException(status_code=404, detail="Contract not found")
    return contract

@app.delete("/api/contracts/{contract_id}")
def delete_contract(contract_id: int, db: Session = Depends(get_db)):
    contract = db.query(models.Contract).filter(models.Contract.id == contract_id).first()
    if contract is None:
        raise HTTPException(status_code=404, detail="Contract not found")
    
    # Delete files
    try:
        file_path = os.path.join(pdf_service.UPLOAD_DIR, contract.filename)
        if os.path.exists(file_path):
            os.remove(file_path)
        # Delete thumbnail
        thumb_name = f"{os.path.splitext(contract.filename)[0]}.jpg"
        thumb_path = os.path.join(pdf_service.THUMBNAIL_DIR, thumb_name)
        if os.path.exists(thumb_path):
            os.remove(thumb_path)
    except Exception as e:
        print(f"Error deleting files: {e}")

    db.delete(contract)
    db.commit()
    return {"ok": True}

@app.post("/api/chat/{contract_id}", response_model=schemas.ChatMessage)
def chat_contract(
    contract_id: int, 
    message: schemas.ChatMessageCreate, 
    db: Session = Depends(get_db)
):
    contract = db.query(models.Contract).filter(models.Contract.id == contract_id).first()
    if not contract:
        raise HTTPException(status_code=404, detail="Contract not found")
    
    if contract.status != "completed" or not contract.extracted_data:
        raise HTTPException(status_code=400, detail="Contract analysis not completed")

    # Save User Message
    user_msg = models.ChatHistory(
        contract_id=contract_id,
        role="user",
        content=message.content
    )
    db.add(user_msg)
    db.commit()
    
    # Get History
    history = db.query(models.ChatHistory).filter(
        models.ChatHistory.contract_id == contract_id
    ).order_by(models.ChatHistory.timestamp).all()
    
    history_dicts = [{"role": h.role, "content": h.content} for h in history]
    
    # Call Gemini
    try:
        ai_response_text = gemini_service.chat_with_contract(
            contract.extracted_data, 
            history_dicts, 
            message.content
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
        
    # Save AI Message
    ai_msg = models.ChatHistory(
        contract_id=contract_id,
        role="ai",
        content=ai_response_text
    )
    db.add(ai_msg)
    db.commit()
    db.refresh(ai_msg)
    
    return ai_msg

@app.post("/api/chat/global", response_model=schemas.ChatMessage)
def global_chat(
    request: schemas.GlobalChatRequest,
    db: Session = Depends(get_db)
):
    # Fetch all requested contracts
    contracts = db.query(models.Contract).filter(models.Contract.id.in_(request.contract_ids)).all()
    
    if not contracts:
        raise HTTPException(status_code=404, detail="No contracts found")
        
    # Prepare data for Gemini
    contracts_data = []
    for c in contracts:
        if c.status == "completed" and c.extracted_data:
            contracts_data.append({
                "title": c.title,
                "extracted_data": c.extracted_data
            })
            
    if not contracts_data:
        raise HTTPException(status_code=400, detail="No completed contracts available for analysis")

    # Call Gemini
    try:
        ai_response_text = gemini_service.chat_with_multiple_contracts(
            contracts_data,
            request.message
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
        
    # Return as a ChatMessage (without ID/timestamp persistence for now, or we could create a 'global' session)
    # For simplicity, we return a transient message
    return {
        "id": 0, # Transient
        "role": "ai",
        "content": ai_response_text,
        "timestamp": datetime.now()
    }

# ============ Group Management APIs ============

@app.get("/api/groups", response_model=List[schemas.Group])
def read_groups(db: Session = Depends(get_db)):
    """取得所有群組"""
    groups = db.query(models.Group).order_by(models.Group.created_at).all()
    return groups

@app.post("/api/groups", response_model=schemas.Group)
def create_group(group: schemas.GroupCreate, db: Session = Depends(get_db)):
    """建立新群組"""
    db_group = models.Group(name=group.name)
    db.add(db_group)
    db.commit()
    db.refresh(db_group)
    return db_group

@app.put("/api/groups/{group_id}", response_model=schemas.Group)
def update_group(group_id: int, group: schemas.GroupUpdate, db: Session = Depends(get_db)):
    """重新命名群組"""
    db_group = db.query(models.Group).filter(models.Group.id == group_id).first()
    if not db_group:
        raise HTTPException(status_code=404, detail="Group not found")
    
    db_group.name = group.name
    db.commit()
    db.refresh(db_group)
    return db_group

@app.delete("/api/groups/{group_id}")
def delete_group(group_id: int, db: Session = Depends(get_db)):
    """刪除群組（群組內的合約會移至未分組）"""
    db_group = db.query(models.Group).filter(models.Group.id == group_id).first()
    if not db_group:
        raise HTTPException(status_code=404, detail="Group not found")
    
    # 將群組內的合約移到未分組
    db.query(models.Contract).filter(models.Contract.group_id == group_id).update({"group_id": None})
    
    db.delete(db_group)
    db.commit()
    return {"ok": True}

@app.put("/api/contracts/{contract_id}/group")
def move_contract_to_group(
    contract_id: int, 
    request: schemas.MoveContractRequest,
    db: Session = Depends(get_db)
):
    """移動合約到群組（group_id 為 null 表示移至未分組）"""
    contract = db.query(models.Contract).filter(models.Contract.id == contract_id).first()
    if not contract:
        raise HTTPException(status_code=404, detail="Contract not found")
    
    if request.group_id is not None:
        group = db.query(models.Group).filter(models.Group.id == request.group_id).first()
        if not group:
            raise HTTPException(status_code=404, detail="Group not found")
    
    contract.group_id = request.group_id
    db.commit()
    return {"ok": True}

