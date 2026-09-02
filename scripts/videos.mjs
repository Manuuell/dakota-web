/**
 * Pipeline de video — recorta, silencia y comprime los reels para web.
 *
 *   node scripts/videos.mjs
 *
 * Requiere ffmpeg. Los reels de Instagram vienen a 720x1280 y hasta 65 s:
 * demasiado para reproducir en bucle en una página. Se corta un fragmento
 * corto, se quita el audio (un video que suena solo espanta) y se genera
 * un poster para que no haya hueco mientras carga.
 */
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { mkdir, writeFile, stat } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";

const run = promisify(execFile);
const RAW = "assets/raw/video";
const OUT = "public/video";
const MAX_KB = 2200;

const CLIPS = [
  {
    src: "DatDB3ORU8i.mp4",
    out: "local-servicio",
    desde: 6,
    duracion: 8,
    ancho: 640,
    alt: "El equipo de Dakota sirviendo un pedido en una mesa del local",
  },
  {
    src: "DZtQRV8sqhU.mp4",
    out: "local-ambiente",
    desde: 2,
    duracion: 8,
    ancho: 640,
    alt: "Interior de Dakota con el letrero de neón y clientes en las mesas",
  },
  {
    // 8 s enteros de la burger ante las llamas del Josper: el mejor plano
    // de producto que hay en toda la cuenta.
    src: "DW35STykeW4.mp4",
    out: "josper-fuego",
    desde: 0.3,
    duracion: 7,
    ancho: 720,
    alt: "Una burger de Dakota ante las llamas del horno Josper mientras cae el queso fundido",
  },
  {
    // Plano general del salon, del reel de la apertura. Dos problemas del
    // material: subtitulos quemados a media altura y un corte de plano a los
    // 10,8 s. El recorte deja el texto fuera del cuadro y la camara lenta
    // estira los 1,9 s utiles a casi cuatro, para que el bucle no salte.
    src: "DZqC8WvxX5L.mp4",
    out: "salon",
    desde: 9.0,
    // Ojo: duracion es la de SALIDA. Con lento:2 consume la mitad de origen.
    duracion: 3.3,
    recorte: "720:370:0:355",
    lento: 2,
    ancho: 900,
    alt: "Plano general del salón de Dakota con las mesas ocupadas y las luminarias del techo encendidas",
  },
  {
    src: "DaCO1f1Mgf2.mp4",
    out: "mesa-noche",
    desde: 4,
    duracion: 7,
    ancho: 640,
    alt: "Clientes cenando en la terraza de Dakota",
  },
];

await mkdir(OUT, { recursive: true });
const manifiesto = {};

for (const c of CLIPS) {
  const entrada = path.join(RAW, c.src);
  if (!existsSync(entrada)) {
    console.warn(`  ! falta ${entrada} — se omite ${c.out}`);
    continue;
  }
  const mp4 = path.join(OUT, `${c.out}.mp4`);
  const poster = path.join(OUT, `${c.out}-poster.jpg`);

  await run("ffmpeg", [
    "-v", "error", "-y",
    "-ss", String(c.desde),
    "-i", entrada,
    "-t", String(c.duracion),
    "-an",                                   // sin audio
    "-vf", `${c.recorte ? `crop=${c.recorte},` : ""}${c.lento ? `setpts=${c.lento}*PTS,` : ""}scale=${c.ancho}:-2`,
    "-c:v", "libx264", "-profile:v", "main", "-pix_fmt", "yuv420p",
    "-crf", "28", "-preset", "slow",
    "-movflags", "+faststart",               // empieza a reproducir sin bajar todo
    mp4,
  ]);

  await run("ffmpeg", [
    "-v", "error", "-y",
    "-ss", String(c.desde + 1),
    "-i", entrada,
    "-frames:v", "1",
    "-vf", `${c.recorte ? `crop=${c.recorte},` : ""}scale=${c.ancho}:-2`,
    "-q:v", "4",
    poster,
  ]);

  const kb = Math.round((await stat(mp4)).size / 1024);
  const { stdout } = await run("ffprobe", [
    "-v", "error", "-select_streams", "v:0",
    "-show_entries", "stream=width,height", "-of", "csv=p=0", mp4,
  ]);
  const [w, h] = stdout.trim().split(",").map(Number);

  manifiesto[`/video/${c.out}`] = { w, h, duracion: c.duracion, alt: c.alt };
  console.log(
    `  ${c.out.padEnd(18)} ${w}x${h}  ${c.duracion}s  ${kb} KB` +
      (kb > MAX_KB ? `  ← pasa de ${MAX_KB} KB` : "")
  );
}

await writeFile("src/data/videos.json", JSON.stringify(manifiesto, null, 2) + "\n");
console.log(`\nManifiesto: src/data/videos.json (${Object.keys(manifiesto).length} clips).`);
