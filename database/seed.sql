-- =============================================================
--  DATOS DE PRUEBA - Avistamiento de OVNIs
-- =============================================================

USE ovnis_db;

INSERT INTO avistamientos (fecha, hora, ubicacion, cantidad, forma, observaciones, registrado_por) VALUES
('2024-03-15', '22:15', 'Cerro El Plomo, Santiago',          1, 'Disco',         'Objeto luminoso que se desplazaba en silencio a baja altura', 'Juan Pérez'),
('2024-03-16', '03:40', 'Desierto de Atacama, sector norte', 3, 'Triangular',     'Tres luces en formación triangular perfecta, inmóviles por 10 min', 'María González'),
('2024-03-17', '20:05', 'Caleta Tortel, Aysén',              1, 'Esfera',         'Esfera naranja que descendió hacia el mar y desapareció',      'Carlos Silva'),
('2024-03-18', '01:30', 'Cajón del Maipo',                   2, 'Cigarro',        'Dos objetos alargados que aceleraron hacia el norte',          'Ana Martínez'),
('2024-03-19', '23:55', 'Carretera Austral km 340',          1, 'Circular',       'Luz intensa que iluminó el camino por varios segundos',        'Roberto Díaz'),
('2024-03-20', '18:20', 'Valle del Elqui, Vicuña',           4, 'No identificada','Cuatro puntos luminosos que se movían erráticamente',          'Juan Pérez'),
('2024-03-21', '00:10', 'Isla de Pascua, costa este',        1, 'Disco',          'Objeto con luces de colores que emergió del océano',           'María González');
