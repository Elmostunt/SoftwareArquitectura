import { useState, useEffect } from 'react'
import AvistamientoTable from './components/AvistamientoTable'
import AvistamientoForm  from './components/AvistamientoForm'
import { api } from './api'

export default function App() {
  const [avistamientos, setAvistamientos] = useState([])
  const [cargando, setCargando]           = useState(true)
  const [error, setError]                 = useState(null)
  const [modalAbierto, setModalAbierto]   = useState(false)
  const [editando, setEditando]           = useState(null)

  async function cargar() {
    setCargando(true)
    setError(null)
    try {
      const datos = await api.listar()
      setAvistamientos(datos)
    } catch (err) {
      setError(err.message)
    } finally {
      setCargando(false)
    }
  }

  useEffect(() => { cargar() }, [])

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
        await api.actualizar(editando.id, data)
      } else {
        await api.crear(data)
      }
      cerrarModal()
      await cargar()
    } catch (err) {
      alert('Error al guardar: ' + err.message)
    }
  }

  async function eliminar(id) {
    if (!window.confirm('¿Seguro que deseas eliminar este avistamiento?')) return
    try {
      await api.eliminar(id)
      await cargar()
    } catch (err) {
      alert('Error al eliminar: ' + err.message)
    }
  }

  return (
    <div className="app">
      <header className="header">
        <h1>🛸 Registro de Avistamiento de OVNIs</h1>
        <p>Frontend en Google Cloud — API en AWS (Load Balancer)</p>
      </header>

      <main className="container">
        <div className="toolbar">
          <button className="btn btn-primary" onClick={abrirCrear}>+ Nuevo avistamiento</button>
          <button className="btn btn-secondary" onClick={cargar} disabled={cargando}>
            {cargando ? 'Cargando...' : 'Recargar'}
          </button>
        </div>

        {error && (
          <div className="state-msg" style={{ color: '#c53030' }}>
            Error al conectar con la API: {error}
            <br />
            <small>Verifica que el backend en AWS está activo y que el proxy nginx está configurado correctamente.</small>
          </div>
        )}

        {cargando && !error && (
          <div className="state-msg">Cargando avistamientos...</div>
        )}

        {!cargando && !error && (
          <AvistamientoTable
            avistamientos={avistamientos}
            onEditar={abrirEditar}
            onEliminar={eliminar}
          />
        )}
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
