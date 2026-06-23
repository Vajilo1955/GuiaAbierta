# GuiaAbierta

Aplicacion web estatica para crear guias audiovisuales accesibles de localidades, monumentos, instituciones y servicios.

## Estructura

- `guia/`: aplicacion publica y panel de administracion.
- `supabase/sql/`: scripts completos para crear tablas, politicas RLS y datos de ejemplo.
- `.env.example`: variables previstas para despliegues con Vite o procesos de build futuros.

## Supabase

1. Crea un proyecto Supabase nuevo e independiente.
2. Ejecuta `supabase/sql/001_schema.sql` en el SQL Editor.
3. Ejecuta `supabase/sql/002_seed.sql` si quieres datos de prueba.
4. Crea los usuarios administradores en Supabase Auth.

La app usa solo clave publica anon/publishable en frontend. No incluyas `service_role` en ningun archivo publico.

## Desarrollo local

La aplicacion puede abrirse como sitio estatico, aunque para probar rutas limpias es recomendable servir el directorio:

```bash
npx serve .
```

Despues abre `http://localhost:3000/guia/`.

## Despliegue

Publica el repositorio en GitHub Pages desde la rama principal. La aplicacion queda disponible en `/guia/`.
