import { useState } from 'react'
import AvistamientoTable from './components/AvistamientoTable'
import AvistamientoForm  from './components/AvistamientoForm'

// Datos iniciales cargados en memoria (simulan el seed de la base de datos)
const DATOS_INICIALES = [
  { id: 1, fecha: '2024-03-15', hora: '22:15', ubicacion: 'Cerro El Plomo, Santiago',          cantidad: 1, forma: 'Disco',          observaciones: 'Objeto luminoso que se desplazaba en silencio a baja altura', registrado_por: 'Juan Pérez'     },
  { id: 2, fecha: '2024-03-16', hora: '03:40', ubicacion: 'Desierto de Atacama, sector norte', cantidad: 3, forma: 'Triangular',      observaciones: 'Tres luces en formación triangular perfecta, inmóviles por 10 min', registrado_por: 'María González' },
  { id: 3, fecha: '2024-03-17', hora: '20:05', ubicacion: 'Caleta Tortel, Aysén',              cantidad: 1, forma: 'Esfera',          observaciones: 'Esfera naranja que descendió hacia el mar y desapareció',      registrado_por: 'Carlos Silva'   },
  { id: 4, fecha: '2024-03-18', hora: '01:30', ubicacion: 'Cajón del Maipo',                   cantidad: 2, forma: 'Cigarro',         observaciones: 'Dos objetos alargados que aceleraron hacia el norte',          registrado_por: 'Ana Martínez'   },
  { id: 5, fecha: '2024-03-19', hora: '23:55', ubicacion: 'Carretera Austral km 340',          cantidad: 1, forma: 'Circular',        observaciones: 'Luz intensa que iluminó el camino por varios segundos',        registrado_por: 'Roberto Díaz'   },
]

export default function App() {
  // Lista de avistamientos guardada en memoria
  const [avistamientos, setAvistamientos] = useState(DATOS_INICIALES)

  // Contador para generar IDs únicos
  const [nextId, setNextId] = useState(6)

  // Controla si el modal está abierto o cerrado
  const [modalAbierto, setModalAbierto] = useState(false)

  // Guarda el avistamiento que se está editando (null = modo creación)
  const [editando, setEditando] = useState(null)

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

  function guardar(data) {
    if (editando) {
      // Reemplaza el avistamiento existente en la lista
      setAvistamientos(prev =>
        prev.map(av => av.id === editando.id ? { ...data, id: editando.id } : av)
      )
    } else {
      // Agrega un nuevo avistamiento con ID autogenerado
      setAvistamientos(prev => [...prev, { ...data, id: nextId }])
      setNextId(n => n + 1)
    }
    cerrarModal()
  }

  function eliminar(id) {
    if (!window.confirm('¿Seguro que deseas eliminar este avistamiento?')) return
    // Filtra la lista dejando fuera el elemento con ese ID
    setAvistamientos(prev => prev.filter(av => av.id !== id))
  }

  return (
    <div className="app">
      <header className="header">
        <h1>🛸 Registro de Avistamiento de OVNIs</h1>
        <p>Versión simple — datos en memoria del navegador</p>
      </header>

      <main className="container">
        <div className="toolbar">
          <button className="btn btn-primary" onClick={abrirCrear}>+ Nuevo avistamiento</button>
        </div>

        <AvistamientoTable
          avistamientos={avistamientos}
          onEditar={abrirEditar}
          onEliminar={eliminar}
        />
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
