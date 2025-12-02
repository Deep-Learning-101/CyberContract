from sqlalchemy import Column, Integer, String, DateTime, JSON, ForeignKey
from sqlalchemy.orm import relationship
from datetime import datetime
from database import Base

class Group(Base):
    __tablename__ = "groups"
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    # Relationship
    contracts = relationship("Contract", back_populates="group")

class Contract(Base):
    __tablename__ = "contracts"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String, index=True)
    filename = Column(String)
    status = Column(String, default="uploading") # uploading, analyzing, completed, error
    extracted_data = Column(JSON, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    group_id = Column(Integer, ForeignKey("groups.id"), nullable=True)
    
    chat_history = relationship("ChatHistory", back_populates="contract", cascade="all, delete-orphan")
    group = relationship("Group", back_populates="contracts")

class ChatHistory(Base):
    __tablename__ = "chat_history"

    id = Column(Integer, primary_key=True, index=True)
    contract_id = Column(Integer, ForeignKey("contracts.id"))
    role = Column(String) # user, ai
    content = Column(String)
    timestamp = Column(DateTime, default=datetime.utcnow)

    contract = relationship("Contract", back_populates="chat_history")

