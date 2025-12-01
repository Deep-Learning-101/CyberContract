from sqlalchemy import Column, Integer, String, DateTime, JSON, ForeignKey
from sqlalchemy.orm import relationship
from datetime import datetime
from database import Base

class Contract(Base):
    __tablename__ = "contracts"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String, index=True)
    filename = Column(String)
    status = Column(String, default="uploading") # uploading, analyzing, completed, error
    extracted_data = Column(JSON, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    chat_history = relationship("ChatHistory", back_populates="contract", cascade="all, delete-orphan")

class ChatHistory(Base):
    __tablename__ = "chat_history"

    id = Column(Integer, primary_key=True, index=True)
    contract_id = Column(Integer, ForeignKey("contracts.id"))
    role = Column(String) # user, ai
    content = Column(String)
    timestamp = Column(DateTime, default=datetime.utcnow)

    contract = relationship("Contract", back_populates="chat_history")
