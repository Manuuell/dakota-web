import { FieldValue } from "firebase-admin/firestore";
import { auth, db } from "./firebase";

export type Rol = "dueno" | "staff";

export interface Miembro {
  uid: string;
  correo: string;
  nombre: string | null;
  rol: Rol;
  desde: string | null;
}

export class EquipoError extends Error {
  constructor(mensaje: string, readonly status = 400) {
    super(mensaje);
  }
}

/**
 * Quién está llamando, comprobado contra Firebase.
 *
 * El token va en la cabecera y no en una cookie a propósito: una cabecera no
 * la manda el navegador sola, así que otro sitio no puede provocar una acción
 * de administración desde la sesión abierta de un dueño.
 */
export async function quienLlama(request: Request): Promise<Miembro> {
  const cabecera = request.headers.get("authorization") ?? "";
  const token = cabecera.startsWith("Bearer ") ? cabecera.slice(7) : null;
  if (!token) throw new EquipoError("Falta la sesión.", 401);

  let uid: string;
  try {
    ({ uid } = await auth().verifyIdToken(token));
  } catch {
    throw new EquipoError("Sesión no válida o caducada.", 401);
  }

  const doc = await db().collection("staff").doc(uid).get();
  if (!doc.exists) throw new EquipoError("Tu cuenta no tiene acceso.", 403);

  const d = doc.data()!;
  return {
    uid,
    correo: d.correo ?? "",
    nombre: d.nombre ?? null,
    rol: (d.rol as Rol) ?? "staff",
    desde: null,
  };
}

export function exigirDueno(quien: Miembro): void {
  if (quien.rol !== "dueno") {
    throw new EquipoError("Solo el dueño puede gestionar el equipo.", 403);
  }
}

export async function listar(): Promise<Miembro[]> {
  const snap = await db().collection("staff").get();
  return snap.docs
    .map((d) => {
      const x = d.data();
      return {
        uid: d.id,
        correo: x.correo ?? "",
        nombre: x.nombre ?? null,
        rol: (x.rol as Rol) ?? "staff",
        desde: x.desde?.toDate?.().toISOString() ?? null,
      };
    })
    .sort((a, b) => a.correo.localeCompare(b.correo, "es"));
}

export async function agregar(correo: string, rol: Rol): Promise<Miembro> {
  const limpio = correo.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(limpio)) {
    throw new EquipoError("Ese correo no tiene buena pinta.");
  }

  let usuario;
  try {
    usuario = await auth().getUserByEmail(limpio);
  } catch {
    throw new EquipoError(
      `Todavía no existe una cuenta con ${limpio}. Pídele que entre una vez en el panel —aunque le rechace— y vuelve a intentarlo.`,
      404
    );
  }

  await db().collection("staff").doc(usuario.uid).set(
    {
      correo: limpio,
      nombre: usuario.displayName ?? null,
      rol,
      desde: FieldValue.serverTimestamp(),
    },
    { merge: true }
  );

  return { uid: usuario.uid, correo: limpio, nombre: usuario.displayName ?? null, rol, desde: null };
}

export async function quitar(uid: string, quien: Miembro): Promise<void> {
  if (uid === quien.uid) {
    throw new EquipoError("No puedes quitarte a ti mismo; que lo haga otro dueño.");
  }

  const equipo = await listar();
  const objetivo = equipo.find((m) => m.uid === uid);
  if (!objetivo) throw new EquipoError("Esa persona ya no está en el equipo.", 404);

  // Quedarse sin ningún dueño dejaría el panel de equipo inaccesible para
  // todos, y recuperarlo obligaría a volver a la línea de comandos.
  if (objetivo.rol === "dueno" && equipo.filter((m) => m.rol === "dueno").length <= 1) {
    throw new EquipoError("Es el único dueño: nombra a otro antes de quitarlo.");
  }

  await db().collection("staff").doc(uid).delete();
}

// Límite por IP para las acciones de administración. En memoria: el servidor es
// un solo proceso y se reinicia poco, y aquí lo que se frena es el aporreo, no
// un atacante con recursos —contra eso están el token y el rol.
const intentos = new Map<string, number[]>();
const VENTANA = 60_000;
const MAX = 12;

export function limitar(ip: string): void {
  const ahora = Date.now();
  const recientes = (intentos.get(ip) ?? []).filter((t) => ahora - t < VENTANA);
  if (recientes.length >= MAX) {
    throw new EquipoError("Demasiados intentos seguidos. Espera un minuto.", 429);
  }
  recientes.push(ahora);
  intentos.set(ip, recientes);
}
