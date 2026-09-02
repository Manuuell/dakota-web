/**
 * Quita el fondo blanco de las fotos de estudio del menú.
 *
 *   node scripts/quitar-fondo.mjs
 *
 * No usa un umbral global —eso se comería los cuencos blancos del centro—.
 * Rellena por inundación desde los bordes: solo desaparece el blanco que está
 * conectado con el borde de la imagen. Lo blanco rodeado de producto se queda.
 */
import sharp from "sharp";
import { writeFile } from "node:fs/promises";

// luzBaja: desde dónde empieza a considerarse fondo (la sombra más oscura).
// luzAlta: a partir de aquí es fondo puro. Entre ambas se desvanece.
const TAREAS = [
  { src: "assets/raw/menu/papas.jpg",  out: "assets/raw/menu/papas.png",  luzBaja: 148, luzAlta: 238, neutro: 28 },
  { src: "assets/raw/menu/salsas.jpg", out: "assets/raw/menu/salsas.png", luzBaja: 200, luzAlta: 242, neutro: 18 },
];

for (const t of TAREAS) {
  const img = sharp(t.src, { limitInputPixels: false });
  const { width: w, height: h } = await img.metadata();
  const { data: px, info: infoPx } = await img
    .clone()
    .toColourspace("srgb")
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const pasoPx = infoPx.channels;

  const esFondo = (i) => {
    const r = px[i * pasoPx], g = px[i * pasoPx + 1], b = px[i * pasoPx + 2];
    const min = Math.min(r, g, b);
    const max = Math.max(r, g, b);
    return min >= t.luzBaja && max - min <= t.neutro;
  };

  // Inundación desde los cuatro bordes.
  const fondo = new Uint8Array(w * h);
  const pila = new Int32Array(w * h);
  let tope = 0;
  const empujar = (i) => {
    if (!fondo[i] && esFondo(i)) { fondo[i] = 1; pila[tope++] = i; }
  };
  for (let x = 0; x < w; x++) { empujar(x); empujar((h - 1) * w + x); }
  for (let y = 0; y < h; y++) { empujar(y * w); empujar(y * w + w - 1); }

  while (tope > 0) {
    const i = pila[--tope];
    const x = i % w, y = (i / w) | 0;
    if (x > 0) empujar(i - 1);
    if (x < w - 1) empujar(i + 1);
    if (y > 0) empujar(i - w);
    if (y < h - 1) empujar(i + w);
  }

  // Dentro de la zona inundada el alfa no es binario: se desvanece según el brillo,
  // así la sombra proyectada se apaga en vez de dejar un halo con borde.
  const rango = t.luzAlta - t.luzBaja;
  const alfa = Buffer.alloc(w * h);
  let quitados = 0;
  for (let i = 0; i < w * h; i++) {
    if (!fondo[i]) { alfa[i] = 255; continue; }
    const lum = (px[i * pasoPx] * 299 + px[i * pasoPx + 1] * 587 + px[i * pasoPx + 2] * 114) / 1000;
    const a = Math.round(255 * Math.min(1, Math.max(0, (t.luzAlta - lum) / rango)));
    alfa[i] = a;
    if (a < 128) quitados++;
  }

  // Un desenfoque mínimo evita el borde dentado del recorte binario.
  // Ojo: blur() sobre un canal devuelve tres, así que hay que leer con su paso real.
  const { data: alfaSuave, info: infoAlfa } = await sharp(alfa, {
    raw: { width: w, height: h, channels: 1 },
  })
    .blur(0.8)
    .raw()
    .toBuffer({ resolveWithObject: true });
  const pasoAlfa = infoAlfa.channels;

  // Se arma el RGBA a mano: más predecible que encadenar canales.
  const rgba = Buffer.alloc(w * h * 4);
  for (let i = 0; i < w * h; i++) {
    rgba[i * 4] = px[i * pasoPx];
    rgba[i * 4 + 1] = px[i * pasoPx + 1];
    rgba[i * 4 + 2] = px[i * pasoPx + 2];
    rgba[i * 4 + 3] = alfaSuave[i * pasoAlfa];
  }

  const salida = await sharp(rgba, { raw: { width: w, height: h, channels: 4 } })
    .png({ compressionLevel: 9 })
    .toBuffer();

  await writeFile(t.out, salida);
  console.log(
    `${t.out.split("/").pop().padEnd(12)} ${w}x${h}  fondo quitado ${((quitados / (w * h)) * 100).toFixed(1)}%  ${Math.round(salida.length / 1024)} KB`
  );
}
