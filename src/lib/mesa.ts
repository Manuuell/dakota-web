import type { AstroCookies } from "astro";
import { db } from "./firebase";

// El QR impreso codifica /mesa/<token>, no /mesa/4. El token es aleatorio e
// inmutable: renombrar la mesa 4 a "Terraza 2" no invalida la calcomanía, y
// la etiqueta se resuelve contra Firestore en cada petición.
export const MESA_COOKIE = "dkt_mesa";
const OCHO_HORAS = 60 * 60 * 8;

export interface Mesa {
  id: string;
  etiqueta: string;
}

export async function mesaPorToken(token: string | undefined): Promise<Mesa | null> {
  if (!token) return null;

  const encontradas = await db()
    .collection("mesas")
    .where("token", "==", token)
    .where("activa", "==", true)
    .limit(1)
    .get();

  if (encontradas.empty) return null;
  const doc = encontradas.docs[0];
  return { id: doc.id, etiqueta: doc.data().etiqueta };
}

/**
 * La mesa de quien está navegando, o null si entró sin escanear.
 *
 * La cookie guarda el token, nunca la etiqueta: así no hay nada que falsificar
 * —quien edite la cookie a mano solo consigue un token que no existe— y el
 * servidor siempre lee la etiqueta vigente.
 */
export function mesaActual(cookies: AstroCookies): Promise<Mesa | null> {
  return mesaPorToken(cookies.get(MESA_COOKIE)?.value);
}

export function recordarMesa(cookies: AstroCookies, token: string): void {
  cookies.set(MESA_COOKIE, token, {
    path: "/",
    httpOnly: true,
    sameSite: "lax",
    secure: import.meta.env.PROD,
    maxAge: OCHO_HORAS,
  });
}

export function olvidarMesa(cookies: AstroCookies): void {
  cookies.delete(MESA_COOKIE, { path: "/" });
}
