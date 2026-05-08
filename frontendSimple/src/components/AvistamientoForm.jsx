import { useState } from 'react'

const FORMAS = ['No identificada', 'Disco', 'Circular', 'Triangular', 'Cigarro', 'Esfera', 'Irregular', 'Otra']

const VACIO = {
  fecha: '', hora: '', ubicacion: '', cantidad: 1,
  forma: 'No identificada', observaciones: '', registrado_por: '',
}

export default function AvistamientoForm({ avistamiento, onGuardar, onCerrar }) {
  const [form, setForm] = useState(
    avistamiento
      ? {
          fecha:          avistamiento.fecha          || '',
          hora:           avistamiento.hora           || '',
          ubicacion:      avistamiento.ubicacion      || '',
          cantidad:       avistamiento.cantidad       || 1,
          forma:          avistamiento.forma          || 'No identificada',
          observaciones:  avistamiento.observaciones  || '',
          registrado_por: avistamiento.registrado_por || '',
        }
      : { ...VACIO }
  )

  function handleChange(e) {
    const { name, value } = e.target
    setForm(prev => ({ ...prev, [name]: value }))
  }

  function handleSubmit(e) {
    e.preventDefault()
    onGuardar({ ...form, cantidad: parseInt(form.cantidad, 10) })
  }

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onCerrar()}>
      <div className="modal">
        <div className="modal-header">
          <h2>{avistamiento ? 'Editar Avistamiento' : 'Nuevo Avistamiento de OVNI'}</h2>
          <button className="modal-close" onClick={onCerrar} title="Cerrar">&times;</button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="form-grid">

            <div className="form-group">
              <label>Fecha *</label>
              <input type="date" name="fecha" value={form.fecha} onChange={handleChange} required />
            </div>

            <div className="form-group">
              <label>Hora *</label>
              <input type="time" name="hora" value={form.hora} onChange={handleChange} required />
            </div>

            <div className="form-group col-2">
              <label>Ubicación *</label>
              <input
                type="text" name="ubicacion" value={form.ubicacion} onChange={handleChange}
                required placeholder="Ej: Cerro El Plomo, Santiago"
              />
            </div>

            <div className="form-group">
              <label>Cantidad de objetos *</label>
              <input type="number" name="cantidad" value={form.cantidad} onChange={handleChange} required min="1" />
            </div>

            <div className="form-group">
              <label>Forma</label>
              <select name="forma" value={form.forma} onChange={handleChange}>
                {FORMAS.map(f => <option key={f} value={f}>{f}</option>)}
              </select>
            </div>

            <div className="form-group">
              <label>Registrado por</label>
              <input type="text" name="registrado_por" value={form.registrado_por}
                onChange={handleChange} placeholder="Nombre del observador" />
            </div>

            <div className="form-group col-2">
              <label>Observaciones</label>
              <textarea name="observaciones" value={form.observaciones} onChange={handleChange}
                placeholder="Descripción: color, movimiento, sonido, duración..." />
            </div>

          </div>

          <div className="form-actions">
            <button type="button" className="btn btn-secondary" onClick={onCerrar}>Cancelar</button>
            <button type="submit" className="btn btn-primary">
              {avistamiento ? 'Guardar cambios' : 'Registrar avistamiento'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
