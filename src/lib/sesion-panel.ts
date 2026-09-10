/**
 * Sesión de staff para las pantallas internas. SOLO cliente: lo importan los
 * <script> de /pedir/cocina y /pedir/ventas, nunca el servidor.
 *
 * Vive aparte porque las dos pantallas necesitan exactamente lo mismo —conectar,
 * autenticar y comprobar el permiso— y tenerlo dos veces garantizaba que
 * arreglar un fallo en una dejara la otra atrás.
 */
import { initializeApp, type FirebaseApp } from "firebase/app";
import {
  GoogleAuthProvider,
  connectAuthEmulator,
  getAuth,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  type Auth,
  type User,
} from "firebase/auth";
import { connectFirestoreEmulator, doc, getDoc, getFirestore, type Firestore } from "firebase/firestore";

export interface Config {
  apiKey: string;
  authDomain: string;
  projectId: string;
  emuladorFirestore: string;
  emuladorAuth: string;
}

export type Estado = "fuera" | "sin-permiso" | "dentro";

export function conectar(cfg: Config): { app: FirebaseApp; auth: Auth; db: Firestore } {
  const app = initializeApp({
    apiKey: cfg.apiKey || "emulador",
    authDomain: cfg.authDomain,
    projectId: cfg.projectId,
  });
  const auth = getAuth(app);
  const db = getFirestore(app);

  if (cfg.emuladorAuth) {
    connectAuthEmulator(auth, `http://${cfg.emuladorAuth}`, { disableWarnings: true });
  }
  if (cfg.emuladorFirestore) {
    const [host, puerto] = cfg.emuladorFirestore.split(":");
    connectFirestoreEmulator(db, host, Number(puerto));
  }

  return { app, auth, db };
}

/**
 * Avisa de en cuál de los tres estados está la sesión.
 *
 * Autenticado no es autorizado: con el acceso por Google entra cualquiera con
 * cuenta, así que el permiso real es tener documento en /staff. Las reglas de
 * Firestore lo exigen igual; esto solo decide qué pantalla mostrar.
 */
export function vigilarSesion(
  auth: Auth,
  db: Firestore,
  alCambiar: (estado: Estado, usuario: User | null) => void
): void {
  onAuthStateChanged(auth, async (usuario) => {
    if (!usuario) return alCambiar("fuera", null);

    const permitido = await getDoc(doc(db, "staff", usuario.uid))
      .then((d) => d.exists())
      .catch(() => false);

    alCambiar(permitido ? "dentro" : "sin-permiso", usuario);
  });
}

// El fallo típico al estrenar dominio es de configuración, no de red, y decir
// "revisa la conexión" manda a mirar donde no es.
const MOTIVOS: Record<string, string> = {
  "auth/unauthorized-domain":
    "Este dominio no está autorizado en Firebase Auth. Añádelo en Authentication → Configuración → Dominios autorizados.",
  "auth/popup-blocked": "El navegador bloqueó la ventana de Google. Permite las ventanas emergentes en este sitio.",
  "auth/network-request-failed": "Sin conexión con Firebase. Revisa la red.",
  "auth/operation-not-allowed": "Ese método de acceso no está activado en este proyecto de Firebase.",
  "auth/invalid-credential": "Correo o contraseña incorrectos.",
  "auth/wrong-password": "Correo o contraseña incorrectos.",
  "auth/user-not-found": "Correo o contraseña incorrectos.",
};

/** Devuelve el mensaje a mostrar, o null si el usuario simplemente cerró el popup. */
export function motivo(e: { code?: string }): string | null {
  if (e.code === "auth/popup-closed-by-user" || e.code === "auth/cancelled-popup-request") return null;
  return MOTIVOS[e.code ?? ""] ?? `No se pudo entrar (${e.code ?? "error desconocido"}).`;
}

export const entrarConGoogle = (auth: Auth) => signInWithPopup(auth, new GoogleAuthProvider());
export const entrarConCorreo = (auth: Auth, correo: string, clave: string) =>
  signInWithEmailAndPassword(auth, correo, clave);
export const salir = (auth: Auth) => signOut(auth);
