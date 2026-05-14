from fastapi import FastAPI, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from typing import List

import models
import schemas
from database import engine, get_db

# Crear tablas automáticamente si no existen
models.Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="API Avistamiento de OVNIs",
    description="Sistema CRUD para registrar avistamientos de OVNIs - Arquitectura Multicloud INACAP",
    version="1.0.0",
)

# CORS: permite que el frontend (en otra nube) consuma la API
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],          # En producción: especificar la IP/dominio del frontend
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── Health check ────────────────────────────────────────────────────────────

@app.get("/")
def root():
    return {"mensaje": "API Avistamiento de OVNIs v1.0", "status": "ok"}


@app.get("/health")
def health():
    return {"status": "ok"}


# ── CRUD Avistamientos ───────────────────────────────────────────────────────

@app.get("/avistamientos", response_model=List[schemas.AvistamientoResponse])
def listar(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    return db.query(models.Avistamiento).order_by(
        models.Avistamiento.fecha.desc(),
        models.Avistamiento.hora.desc()
    ).offset(skip).limit(limit).all()


@app.get("/avistamientos/{id}", response_model=schemas.AvistamientoResponse)
def obtener(id: int, db: Session = Depends(get_db)):
    av = db.query(models.Avistamiento).filter(models.Avistamiento.id == id).first()
    if not av:
        raise HTTPException(status_code=404, detail="Avistamiento no encontrado")
    return av


@app.post("/avistamientos", response_model=schemas.AvistamientoResponse, status_code=201)
def crear(data: schemas.AvistamientoCreate, db: Session = Depends(get_db)):
    nuevo = models.Avistamiento(**data.model_dump())
    db.add(nuevo)
    db.commit()
    db.refresh(nuevo)
    return nuevo


@app.put("/avistamientos/{id}", response_model=schemas.AvistamientoResponse)
def actualizar(id: int, data: schemas.AvistamientoUpdate, db: Session = Depends(get_db)):
    av = db.query(models.Avistamiento).filter(models.Avistamiento.id == id).first()
    if not av:
        raise HTTPException(status_code=404, detail="Avistamiento no encontrado")
    for campo, valor in data.model_dump().items():
        setattr(av, campo, valor)
    db.commit()
    db.refresh(av)
    return av


@app.delete("/avistamientos/{id}")
def eliminar(id: int, db: Session = Depends(get_db)):
    av = db.query(models.Avistamiento).filter(models.Avistamiento.id == id).first()
    if not av:
        raise HTTPException(status_code=404, detail="Avistamiento no encontrado")
    db.delete(av)
    db.commit()
    return {"mensaje": "Avistamiento eliminado correctamente"}
