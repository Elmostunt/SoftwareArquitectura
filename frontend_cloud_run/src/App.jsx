import { useState } from 'react'
import './App.css'

const INFO_CARDS = [
  {
    icon: '☁️',
    title: 'Google Cloud Run',
    description: 'Servicio serverless que ejecuta contenedores Docker sin gestionar infraestructura. Escala automáticamente de 0 a N instancias según la demanda.',
  },
  {
    icon: '🐳',
    title: 'Docker',
    description: 'Empaqueta la aplicación y sus dependencias en una imagen portable. Garantiza que el entorno de ejecución sea idéntico en desarrollo y producción.',
  },
  {
    icon: '⚛️',
    title: 'React + Vite',
    description: 'Frontend moderno construido con React 18 y Vite. El build genera archivos estáticos optimizados servidos con Nginx.',
  },
]

function InfoCard({ icon, title, description }) {
  return (
    <div className="card">
      <div className="card-icon">{icon}</div>
      <h3 className="card-title">{title}</h3>
      <p className="card-description">{description}</p>
    </div>
  )
}

function App() {
  const [count, setCount] = useState(0)

  return (
    <div className="container">
      <header className="header">
        <div className="badge">Arquitectura Multicloud · INACAP</div>
        <h1 className="title">Frontend en Cloud Run</h1>
        <p className="subtitle">
          Aplicación React desplegada como contenedor Docker en Google Cloud Run.
          Este ejemplo muestra el flujo completo de contenedorización y despliegue serverless.
        </p>
      </header>

      <section className="counter-section">
        <p className="counter-label">Contador de prueba</p>
        <div className="counter-display">{count}</div>
        <div className="counter-buttons">
          <button className="btn btn-secondary" onClick={() => setCount(c => c - 1)}>
            − Decrementar
          </button>
          <button className="btn btn-primary" onClick={() => setCount(c => c + 1)}>
            + Incrementar
          </button>
        </div>
        <button className="btn btn-ghost" onClick={() => setCount(0)}>
          Reiniciar
        </button>
      </section>

      <section className="cards-section">
        <h2 className="section-title">Tecnologías utilizadas</h2>
        <div className="cards-grid">
          {INFO_CARDS.map(card => (
            <InfoCard key={card.title} {...card} />
          ))}
        </div>
      </section>

      <footer className="footer">
        <p>
          Desplegado con Docker · Google Cloud Run · Región <strong>us-central1</strong>
        </p>
      </footer>
    </div>
  )
}

export default App
