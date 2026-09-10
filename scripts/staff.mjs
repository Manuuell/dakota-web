/**
 * Autoriza (o revoca) a alguien para entrar al panel de cocina.
 *
 *   node scripts/staff.mjs correo@gmail.com            # autoriza
 *   node scripts/staff.mjs correo@gmail.com --quitar   # revoca
 *   node scripts/staff.mjs --lista                     # quién tiene acceso
 *
 * La persona tiene que haber entrado al menos una vez en /pedir/cocina con Google
 * (aunque le dijera "sin autorizar"): eso es lo que crea su usuario y le da
 * el uid que estas reglas necesitan.
 */
import { cert, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";

const args = process.argv.slice(2);
const quitar = args.includes("--quitar");
const listar = args.includes("--lista");
const correo = args.find((a) => !a.startsWith("--"));

if (!correo && !listar) {
  console.error("Uso: node scripts/staff.mjs <correo> [--quitar] | --lista");
  process.exit(1);
}

initializeApp(
  process.env.FIRESTORE_EMULATOR_HOST
    ? { projectId: process.env.FIREBASE_PROJECT_ID }
    : {
        credential: cert({
          projectId: process.env.FIREBASE_PROJECT_ID,
          clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
          privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
        }),
      }
);

const db = getFirestore();

if (listar) {
  const todos = await db.collection("staff").get();
  if (todos.empty) console.log("Nadie autorizado todavía.");
  todos.forEach((d) => console.log(`${d.data().correo ?? "(sin correo)"}  uid=${d.id}`));
  process.exit(0);
}

let usuario;
try {
  usuario = await getAuth().getUserByEmail(correo);
} catch {
  console.error(
    `No existe ningún usuario con ${correo}.\n` +
      `Que entre primero en /pedir/cocina y pulse "Entrar con Google" una vez, aunque le rechace.`
  );
  process.exit(1);
}

if (quitar) {
  await db.collection("staff").doc(usuario.uid).delete();
  console.log(`Revocado: ${correo}`);
} else {
  await db.collection("staff").doc(usuario.uid).set({
    correo,
    nombre: usuario.displayName ?? null,
    desde: new Date(),
  });
  console.log(`Autorizado: ${correo} (uid ${usuario.uid})`);
}

process.exit(0);
