from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime


class AvistamientoBase(BaseModel):
    fecha:          str           = Field(...,  example="2024-03-15")
    hora:           str           = Field(...,  example="22:15")
    ubicacion:      str           = Field(...,  example="Cerro El Plomo, Santiago")
    cantidad:       int           = Field(...,  gt=0, example=1)
    forma:          Optional[str] = Field(None, example="Disco")
    observaciones:  Optional[str] = Field(None, example="Objeto luminoso que se desplazaba en silencio")
    registrado_por: Optional[str] = Field(None, example="Juan Pérez")


class AvistamientoCreate(AvistamientoBase):
    pass


class AvistamientoUpdate(AvistamientoBase):
    pass


class AvistamientoResponse(AvistamientoBase):
    id:         int
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True
