import { useState, useEffect } from 'react'
import AvistamientoTable from './components/AvistamientoTable'
import AvistamientoForm  from './components/AvistamientoForm'
import {
  getAvistamientos,
  createAvistamiento,
  updateAvistamiento,
  deleteAvistamiento,
} from './api'

// Exponemos React globalmente para que el formulario pueda usar useState
// (evita importarlo en cada componente hijo en proyectos de clase simples)
import React from 'react'
window.React = React

export default function App() {
  const [avistamientos, setAvistamientos] = useState([])
  const [loading,       setLoading]       = useState(true)
  const [error,         setError]         = useState(null)
  const [modalAbierto,  setModalAbierto]  = useState(false)
  const [editando,      setEditando]      = useState(null)   // objeto completo o null

  useEffect(() => { cargar() }, [])

  async function cargar() {
    try {
      setLoading(true)
      setError(null)
      setAvistamientos(await getAvistamientos())
    } catch {
      setError('No se pudo conectar con el servidor. Verifica la URL del backend.')
    } finally {
      setLoading(false)
    }
  }

  function abrirCrear() {
    setEditando(null)
    setModalAbierto(true)
  }

  function abrirEditar(av) {
    setEditando(av)
    setModalAbierto(true)
  }

  function cerrarModal() {
    setModalAbierto(false)
    setEditando(null)
  }

  async function guardar(data) {
    try {
      if (editando) {
        await updateAvistamiento(editando.id, data)
      } else {
        await createAvistamiento(data)
      }
      cerrarModal()
      await cargar()
    } catch (e) {
      alert(`Error al guardar: ${e.message}`)
    }
  }

  async function eliminar(id) {
    if (!window.confirm('¿Seguro que deseas eliminar este avistamiento?')) return
    try {
      await deleteAvistamiento(id)
      await cargar()
    } catch (e) {
      alert(`Error al eliminar: ${e.message}`)
    }
  }

  return (
    <div className="app">
      <header className="header">
        <h1>🛸 Registro de Avistamiento de OVNIs</h1>
        <p>Arquitectura Multicloud — AWS (Backend + RDS) | Otra Nube (Frontend)</p>
      </header>

      <main className="container">
        <div className="toolbar">
          <button className="btn btn-primary"   onClick={abrirCrear}>+ Nuevo avistamiento</button>
          <button className="btn btn-secondary" onClick={cargar}>↻ Actualizar</button>
        </div>

        {error && <div className="alert alert-error">{error}</div>}

        {loading
          ? <div className="state-msg">Cargando datos...</div>
          : <AvistamientoTable
              avistamientos={avistamientos}
              onEditar={abrirEditar}
              onEliminar={eliminar}
            />
        }
      </main>

      {modalAbierto && (
        <AvistamientoForm
          avistamiento={editando}
          onGuardar={guardar}
          onCerrar={cerrarModal}
        />
      )}
    </div>
  )
}
