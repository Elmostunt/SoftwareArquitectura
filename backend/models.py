from sqlalchemy import Column, Integer, String, Text, DateTime
from sqlalchemy.sql import func
from database import Base


class Avistamiento(Base):
    __tablename__ = "avistamientos"

    id             = Column(Integer, primary_key=True, index=True)
    fecha          = Column(String(10),  nullable=False)
    hora           = Column(String(8),   nullable=False)
    ubicacion      = Column(String(200), nullable=False)
    cantidad       = Column(Integer,     nullable=False)
    forma          = Column(String(100), default="No identificada")
    observaciones  = Column(Text,        nullable=True)
    registrado_por = Column(String(100), nullable=True)
    created_at     = Column(DateTime,    server_default=func.now())
    updated_at     = Column(DateTime,    server_default=func.now(), onupdate=func.now())
