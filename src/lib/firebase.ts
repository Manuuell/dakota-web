import { cert, getApps, initializeApp, type App } from "firebase-admin/app";
import { getFirestore, type Firestore } from "firebase-admin/firestore";
import { exigir, leer } from "./env";

let cache: Firestore | undefined;

export function db(): Firestore {
  if (!cache) {
    cache = getFirestore(getApps()[0] ?? crear());
    cache.settings({ ignoreUndefinedProperties: true });
  }
  return cache;
}

function crear(): App {
  // Con FIRESTORE_EMULATOR_HOST puesto el SDK habla con el emulador y las
  // credenciales sobran: así se trabaja en local sin la clave de servicio.
  // El SDK solo mira process.env, así que si el valor llegó por .env (que
  // Astro deja en import.meta.env) hay que pasárselo a mano.
  const emulador = leer("FIRESTORE_EMULATOR_HOST");
  if (emulador) {
    process.env.FIRESTORE_EMULATOR_HOST = emulador;
    return initializeApp({ projectId: leer("FIREBASE_PROJECT_ID") || "dakota" });
  }

  return initializeApp({
    credential: cert({
      projectId: exigir("FIREBASE_PROJECT_ID"),
      clientEmail: exigir("FIREBASE_CLIENT_EMAIL"),
      // Un .env no admite saltos de línea reales, así que la clave viaja con
      // "\n" escapados y hay que devolverlos antes de que el SDK la parsee.
      privateKey: exigir("FIREBASE_PRIVATE_KEY").replace(/\\n/g, "\n"),
    }),
  });
}
