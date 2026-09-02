/**
 * Pipeline de imágenes — fase 03 del plan.
 *
 * Requisito previo: los recortes con alfa los produce scripts/quitar-fondo.mjs.
 *
 *   node scripts/images.mjs
 *
 * Lee assets/raw/, aplica el recorte declarado en RECORTES y escribe
 * AVIF + WebP en public/img/ a 400/800/1200/1600 px de ancho.
 * Para añadir una foto nueva: ponerla en assets/raw/ y declararla abajo.
 */
import sharp from "sharp";
import { mkdir, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";

const RAW = "assets/raw";
const OUT = "public/img";
const ANCHOS = [400, 800, 1200, 1600];
const CALIDAD = { avif: 62, webp: 74 };

// origen, destino y región a recortar {left, top, width, height} en px del original.
// Las promos de Instagram traen la foto de producto embebida: recortamos el plato.
const RECORTES = [
  { src: "ig-05.jpg", out: "burgers/getsemani",  crop: { left: 120,  top: 1425, width: 730, height: 760 } },
  { src: "ig-05.jpg", out: "burgers/the-chief",  crop: { left: 905,  top: 1432, width: 745, height: 650 } },
  { src: "ig-03.jpg", out: "burgers/getsemani-b", crop: { left: 470, top: 700,  width: 970, height: 1090 } },
  { src: "ig-04.jpg", out: "burgers/the-chief-b", crop: { left: 560, top: 730,  width: 880, height: 1060 } },
  { src: "ig-02.jpg", out: "burgers/promo-lunes", crop: { left: 330, top: 520,  width: 830, height: 930 } },
  { src: "ig-01.jpg", out: "hotdogs/hot-dog-urban", crop: { left: 150, top: 905, width: 1140, height: 545 } },
];

// Piezas completas que sirven como grafica de promo, sin recortar.
const COMPLETAS = [
  { src: "ig-05.jpg", out: "promos/lunes-martes-burguer", anchos: [400, 800, 1200] },
  { src: "ig-01.jpg", out: "promos/hot-dog-urban" },

  // Fotografía de estudio extraída del arte original del menú 2026.
  // Las .png llevan canal alfa: el producto va recortado sobre el fondo.
  { src: "menu/burgers-grupo.png", out: "cat/burgers", alfa: true, anchos: [400, 800, 1200] },
  { src: "menu/hotdog.png",        out: "cat/hot-dogs", alfa: true },
  { src: "menu/papas.png",         out: "cat/papas", alfa: true },
  { src: "menu/salsas.png",        out: "cat/salsas", alfa: true, anchos: [400, 800, 1200] },
  { src: "menu/portada-burger.jpg", out: "cat/entradas", crop: { left: 380, top: 1500, width: 1900, height: 1900 }, anchos: [400, 800, 1200] },
  { src: "menu/portada-burger.jpg", out: "og/portada",   crop: { left: 120, top: 1750, width: 2360, height: 1239 }, anchos: [1200] },

  // Fotografía de @dakota.ctg: producto, parrilla, local y clientes.
  { src: "ig/DaCO1f1Mgf2.jpg", out: "producto/cheddar-macro", anchos: [400, 800, 1200] },
  { src: "ig/DXPQFELEb4A.jpg", out: "producto/pulled-pork",   anchos: [400, 800, 1200] },
  { src: "ig/DbYSdq_Roo7.jpg", out: "producto/burger-mano",   anchos: [400, 800] },
  { src: "ig/DZ0mz2lRYuj.jpg", out: "producto/jugosa",        anchos: [400, 800] },
  { src: "ig/Db80m9ERZGw.jpg", out: "local/parrilla",         anchos: [400, 800, 1200] },
  { src: "ig/DZtQRV8sqhU.jpg", out: "local/neon",             anchos: [400, 800] },
  { src: "ig/DatnWKaMl81.jpg", out: "local/fachada",          anchos: [400, 800] },
  { src: "ig/DZqC8WvxX5L.jpg", out: "clientes/c1",            anchos: [400, 800] },
  { src: "ig/DZxxKwPxAnG.jpg", out: "clientes/c2",            anchos: [400, 800] },
  { src: "ig/DaO9os3lIox.jpg", out: "clientes/c3",            anchos: [400, 800] },
  { src: "ig/Db1o1YiRbfA.jpg", out: "clientes/c4",            anchos: [400, 800] },
];

async function procesar({ src, out, crop, alfa, anchos }) {
  const entrada = path.join(RAW, src);
  if (!existsSync(entrada)) {
    console.warn(`  ! falta ${entrada} — se omite ${out}`);
    return null;
  }
  const destino = path.join(OUT, path.dirname(out));
  await mkdir(destino, { recursive: true });

  let base = sharp(entrada, { failOn: "none", limitInputPixels: false }).rotate();
  const meta = await base.metadata();

  if (crop) {
    // Recorte seguro: nunca se sale del original.
    const left = Math.max(0, Math.min(crop.left, meta.width - 1));
    const top = Math.max(0, Math.min(crop.top, meta.height - 1));
    const width = Math.min(crop.width, meta.width - left);
    const height = Math.min(crop.height, meta.height - top);
    base = base.extract({ left, top, width, height });
  }

  // El recorte con alfa trae margen transparente: se elimina para que el
  // producto llene su caja en lugar de flotar en el centro.
  if (alfa) base = base.trim({ threshold: 1 });
  const buffer = await (alfa ? base.png() : base).toBuffer();
  const ancho = (await sharp(buffer).metadata()).width;
  const generados = [];

  for (const w of anchos ?? ANCHOS) {
    if (w > ancho * 1.05) continue; // no ampliar
    for (const [fmt, opts] of [
      ["avif", { quality: CALIDAD.avif, effort: 6 }],
      ["webp", { quality: CALIDAD.webp, alphaQuality: 90 }],
    ]) {
      const archivo = path.join(OUT, `${out}-${w}.${fmt}`);
      const info = await sharp(buffer).resize({ width: w })[fmt](opts).toFile(archivo);
      generados.push({ archivo, w, kb: Math.round(info.size / 102.4) / 10 });
    }
  }
  return { out, ancho, generados, anchosReales: [...new Set(generados.map((g) => g.w))] };
}

const tareas = [...RECORTES, ...COMPLETAS];
console.log(`Procesando ${tareas.length} imágenes desde ${RAW}/\n`);

let totalKb = 0;
let pesada = 0;
const manifiesto = {};
for (const t of tareas) {
  const r = await procesar(t);
  if (!r) continue;
  const kb = r.generados.reduce((a, g) => a + g.kb, 0);
  totalKb += kb;
  manifiesto[`/img/${r.out}`] = r.anchosReales;
  const max = Math.max(...r.generados.map((g) => g.kb));
  if (max > 150) pesada++;
  console.log(
    `  ${r.out.padEnd(30)} origen ${String(r.ancho).padStart(4)}px  ` +
      `${r.generados.length} archivos  mayor ${max} KB`
  );
}
await writeFile(
  "src/data/imagenes.json",
  JSON.stringify(manifiesto, null, 2) + "\n"
);
console.log(`\nManifiesto: src/data/imagenes.json (${Object.keys(manifiesto).length} imágenes).`);
console.log(`Total ${Math.round(totalKb)} KB.` + (pesada ? ` ${pesada} sobre el límite de 150 KB.` : " Todas bajo 150 KB."));
