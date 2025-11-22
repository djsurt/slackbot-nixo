from sqlalchemy import Column, String, Float, DateTime
from datetime import datetime
from uuid import uuid4
from database import Base


class Ticket(Base):
    __tablename__ = "tickets"
    id = Column(String, primary_key=True, default=lambda: str(uuid4()))
    text = Column(String)
    channel = Column(String)
    ts = Column(DateTime, default=datetime.utcnow)
    group_id = Column(String)
    relevance_score = Column(Float)
    type = Column(String)  # bug, feature, support, question
