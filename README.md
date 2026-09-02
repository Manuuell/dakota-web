# Dakota Smokehouse — sitio web

Sitio del restaurante **DAKOTA | Smokehouse**, Alto Bosque, Cartagena de Indias.
Carta de 35 platos, promociones y pedidos por WhatsApp.

- Instagram: [@dakota.ctg](https://instagram.com/dakota.ctg)
- Pedidos: [+57 318 958 5000](https://wa.me/573189585000)
- Dominio previsto: `dakotactg.co` — **todavía sin registrar** (no resuelve DNS)

## Stack

| Capa | Herramienta | Por qué |
|---|---|---|
| Framework | **Astro 5** | Genera HTML estático. Sin JS de framework en el cliente: la página carga en 4G sin esperar hidratación. |
| Estilos | **CSS propio con custom properties** | No hay Tailwind ni librería de UI. Los tokens de marca viven en `src/styles/global.css` y cada componente lleva su `<style>` con alcance local. |
| Datos | **JSON plano** | `menu.json`, `fotos.json` e `imagenes.json`. Sin CMS ni base de datos: cambiar un precio es editar una línea. |
| Imágenes | **sharp** | Recorte, redimensión y AVIF/WebP en un script propio, no en tiempo de build. |
| Animación | **Canvas 2D + CSS** | El campo de brasas es canvas; el resto son keyframes. Cero dependencias. |
| Tipografía | **Google Fonts** | Archivo Black, Montserrat, Caveat Brush y Space Mono. |

Sin dependencias de runtime más allá de Astro. `sharp` es solo de desarrollo.

## Marca

Colores muestreados píxel a píxel del arte original (`MENU DAKOTAcc 2026.pdf`):

| Token | Hex | Uso |
|---|---|---|
| `--dkt-red` | `#EC1738` | Color primario, bandas, precios |
| `--dkt-red-deep` | `#9F0B1C` | Hover y degradados de brasa |
| `--dkt-char` | `#151516` | Fondo dominante |
| `--dkt-cream` | `#FBF6DE` | Texto sobre oscuro y rojo |

**Tipografías originales:** Clickbait (display), Gotham en cinco pesos y DonJos Trayecto
(script). Las tres son comerciales. En web se sustituyen por Archivo Black, Montserrat
y Caveat Brush; el logotipo y el wordmark van en SVG vectorizado desde el PDF, así que
las letras de marca son las reales.

`public/brand/dkt.svg` y `dakota-wordmark.svg` llevan **la llama como path
independiente**, separada de la D, para poder animarla aparte.

## Puesta en marcha

```bash
npm install
npm run dev      # http://localhost:4321
npm run build    # dist/
```

## Pipeline de imágenes

Tres pasos, en este orden. Solo hace falta repetirlos al añadir fotos nuevas.

**1. Extraer del PDF del menú** (una sola vez, ya hecho). La fotografía de estudio
viene incrustada en el arte:

```bash
pdfimages -all -p "MENU DAKOTAcc 2026.pdf" ./m
```

Las páginas 2 y 3 traen `smask`, es decir el producto ya recortado. El resto son CMYK
y hay que pasarlos a sRGB.

**2. Quitar el fondo blanco** de las fotos de estudio que no traen máscara:

```bash
node scripts/quitar-fondo.mjs
```

No usa un umbral global —eso se comería los cuencos blancos de las salsas—. Rellena por
inundación desde los bordes: solo desaparece el blanco conectado con el borde. Dentro de
esa zona el alfa se desvanece según el brillo, para que la sombra proyectada se apague en
vez de dejar un halo con borde duro. Los umbrales están arriba del script.

**3. Generar los formatos web:**

```bash
node scripts/images.mjs
```

Recorta según lo declarado en `RECORTES`, redimensiona a 400/800/1200/1600 px y escribe
AVIF + WebP en `public/img/`. Avisa de cualquier archivo por encima de 150 KB.

Al terminar escribe **`src/data/imagenes.json`**, el manifiesto con los anchos que
existen de verdad. `Picture.astro` lo valida: si pides un ancho que no se generó, avisa
en consola y usa el real; si la imagen no está declarada, el build falla. Así un
`srcset` no puede quedar roto en silencio.

### Añadir una foto

1. Ponla en `assets/raw/`.
2. Declárala en `RECORTES` o `COMPLETAS` dentro de `scripts/images.mjs`.
3. `node scripts/images.mjs`.
4. Refiérela desde `menu.json` o `fotos.json`.

## Estructura

```
assets/raw/          material original (Instagram + PDF del menú)
scripts/             quitar-fondo.mjs · images.mjs
public/brand/        logotipo DKT y wordmark en SVG
public/img/          derivados AVIF/WebP — los genera el pipeline
src/data/            menu.json · fotos.json · imagenes.json
src/components/      Picture · Embers · Galeria · Wordmark · Mark
src/layouts/         Base.astro
src/pages/           index.astro
```

`assets/raw/` y `public/img/` se versionan a propósito: así se puede clonar y construir
sin necesitar el PDF original de 48 MB ni volver a bajar nada de Instagram.

## Estado

Hecho: home completa, carta de 35 platos, promociones, galería, ubicación, datos
estructurados pendientes de conectar, imagen de compartir.

Pendiente:

- **Registrar `dakotactg.co`.** El menú impreso ya anuncia esa dirección y no existe.
- **Sesión de fotos de producto.** Hay fotografía para 4 de 35 platos; el resto de la
  carta va sin imagen.
- **Precios de las salsas artesanales.** La carta impresa anuncia la sección pero no
  lista ni productos ni precios.
- **Verificar The Big Dakota.** Marca `$37.500 / $42.500`: sube $5.000 con papa cuando
  todas las demás suben $8.000.
- **Horarios y zonas de domicilio**, sin confirmar.
- Las promociones de `fotos.json` tienen fecha de vencimiento y hay que actualizarlas.
