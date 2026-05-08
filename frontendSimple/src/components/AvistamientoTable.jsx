export default function AvistamientoTable({ avistamientos, onEditar, onEliminar }) {
  if (avistamientos.length === 0) {
    return <div className="state-msg">No hay avistamientos registrados. Crea el primero.</div>
  }

  return (
    <div className="table-wrapper">
      <table className="table">
        <thead>
          <tr>
            <th>#</th>
            <th>Fecha</th>
            <th>Hora</th>
            <th>Ubicación</th>
            <th>Cantidad</th>
            <th>Forma</th>
            <th>Registrado por</th>
            <th>Observaciones</th>
            <th>Acciones</th>
          </tr>
        </thead>
        <tbody>
          {avistamientos.map(av => (
            <tr key={av.id}>
              <td>{av.id}</td>
              <td>{av.fecha}</td>
              <td>{av.hora}</td>
              <td>{av.ubicacion}</td>
              <td><span className="badge">{av.cantidad}</span></td>
              <td>{av.forma || '—'}</td>
              <td>{av.registrado_por || '—'}</td>
              <td style={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {av.observaciones || '—'}
              </td>
              <td>
                <button className="btn btn-sm btn-edit"   onClick={() => onEditar(av)}>Editar</button>
                <button className="btn btn-sm btn-delete" onClick={() => onEliminar(av.id)}>Eliminar</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
