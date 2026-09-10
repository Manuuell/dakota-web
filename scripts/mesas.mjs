/**
 * Crea o repara las mesas del local y escribe los QR listos para imprimir.
 *
 *   node scripts/mesas.mjs 12          # mesas 1..12
 *   node scripts/mesas.mjs 1 2 3 Terraza-1
 *
 * Es idempotente: una mesa que ya existe conserva su token, así que volver a
 * correrlo no invalida ninguna calcomanía ya pegada. Los PNG salen en
 * qr/mesa-<etiqueta>.png apuntando a <SITIO>/mesa/<token>.
 */
import { mkdir, writeFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { cert, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import QRCode from "qrcode";

const SITIO = process.env.SITIO_URL || "https://dakota.sentralabs.co";

const etiquetas = process.argv.slice(2);
if (etiquetas.length === 0) {
  console.error("Uso: node scripts/mesas.mjs <n.º de mesas | etiqueta...>");
  process.exit(1);
}

// Un solo número significa "de la 1 a la N".
const lista =
  etiquetas.length === 1 && /^\d+$/.test(etiquetas[0])
    ? Array.from({ length: Number(etiquetas[0]) }, (_, i) => String(i + 1))
    : etiquetas;

initializeApp(
  process.env.FIRESTORE_EMULATOR_HOST
    ? { projectId: process.env.FIREBASE_PROJECT_ID || "dakota" }
    : {
        credential: cert({
          projectId: process.env.FIREBASE_PROJECT_ID,
          clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
          privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
        }),
      }
);

const db = getFirestore();
await mkdir("qr", { recursive: true });

for (const [i, etiqueta] of lista.entries()) {
  const existentes = await db.collection("mesas").where("etiqueta", "==", etiqueta).limit(1).get();

  let token;
  if (existentes.empty) {
    token = randomUUID();
    await db.collection("mesas").add({ etiqueta, token, activa: true, orden: i });
  } else {
    token = existentes.docs[0].data().token;
    await existentes.docs[0].ref.update({ activa: true, orden: i });
  }

  const url = `${SITIO}/pedir/mesa/${token}`;
  await QRCode.toFile(`qr/mesa-${etiqueta}.png`, url, {
    width: 900,
    margin: 2,
    color: { dark: "#151516", light: "#FBF6DE" },
  });

  console.log(`mesa ${etiqueta.padEnd(12)} ${existentes.empty ? "creada " : "ya existía"}  qr/mesa-${etiqueta}.png`);
}

console.log(`\n${lista.length} mesa(s). Los QR apuntan a ${SITIO}/pedir/mesa/<token>.`);
process.exit(0);
