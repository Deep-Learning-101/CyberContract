from pydantic import BaseModel
from typing import List, Optional, Any, Literal
from datetime import datetime

class ChatMessageBase(BaseModel):
    role: Literal['user', 'ai']
    content: str

class ChatMessageCreate(ChatMessageBase):
    pass

class ChatMessage(ChatMessageBase):
    id: int
    timestamp: datetime

    class Config:
        orm_mode = True

class GroupBase(BaseModel):
    name: str

class GroupCreate(GroupBase):
    pass

class GroupUpdate(GroupBase):
    pass

class Group(GroupBase):
    id: int
    created_at: datetime
    
    class Config:
        orm_mode = True

class ContractBase(BaseModel):
    title: str
    filename: str

class ContractCreate(ContractBase):
    pass

class Contract(ContractBase):
    id: int
    status: str
    extracted_data: Optional[Any] = None
    created_at: datetime
    chat_history: List[ChatMessage] = []
    group_id: Optional[int] = None

    class Config:
        orm_mode = True

class GlobalChatRequest(BaseModel):
    contract_ids: List[int]
    message: str

class MoveContractRequest(BaseModel):
    group_id: Optional[int] = None

