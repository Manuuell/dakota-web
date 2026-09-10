import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { db } from "./firebase";
import { resolverLineas, type LineaResuelta } from "./carta";
import type { Mesa } from "./mesa";

export type Estado = "recibido" | "preparando" | "listo" | "entregado" | "cancelado";

/** Lo que la cocina tiene pendiente. Un pedido entregado sale de la cola pero sigue en la cuenta. */
export const EN_COCINA: Estado[] = ["recibido", "preparando", "listo"];

export interface Pedido {
  id: string;
  numero: number;
  mesaId: string;
  mesaEtiqueta: string;
  estado: Estado;
  items: LineaResuelta[];
  totalCop: number;
  nota?: string;
  pagado: boolean;
  creadoEn: string;
  cerradoEn: string | null;
}

export async function crearPedido(
  mesa: Mesa,
  lineas: unknown,
  nota?: string
): Promise<{ id: string; numero: number }> {
  const { items, totalCop } = resolverLineas(lineas);
  const numero = await siguienteNumero();

  const doc = await db()
    .collection("pedidos")
    .add({
      numero,
      mesaId: mesa.id,
      // Copia de la etiqueta para que un pedido viejo conserve el nombre que
      // tenía la mesa aunque después se renombre o se borre.
      mesaEtiqueta: mesa.etiqueta,
      estado: "recibido" satisfies Estado,
      items,
      totalCop,
      nota: nota?.trim().slice(0, 200) || undefined,
      pagado: false,
      creadoEn: FieldValue.serverTimestamp(),
      cerradoEn: null,
    });

  return { id: doc.id, numero };
}

/**
 * Consecutivo del día, con reinicio natural cada jornada.
 *
 * Va en una transacción porque dos mesas que confirman a la vez leerían el
 * mismo número: la cocina vería dos "#7" y ningún "#8".
 */
async function siguienteNumero(): Promise<number> {
  const ref = db().collection("contadores").doc(diaBogota());

  return db().runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const numero = ((snap.data()?.ultimo as number | undefined) ?? 0) + 1;
    tx.set(ref, { ultimo: numero }, { merge: true });
    return numero;
  });
}

// El corte del consecutivo es el día de Cartagena, no el UTC: si no, todo lo
// que se pide después de las 7 de la tarde caería en el contador de mañana.
// "en-CA" es el atajo estándar para obtener AAAA-MM-DD.
function diaBogota(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Bogota" }).format(new Date());
}

export async function pedidoPorId(id: string): Promise<Pedido | null> {
  const doc = await db().collection("pedidos").doc(id).get();
  return doc.exists ? aPedido(doc.id, doc.data()!) : null;
}

/** Los pedidos que forman la cuenta de una mesa: todo lo pedido y aún no cobrado. */
export async function cuentaDeMesa(mesaId: string): Promise<Pedido[]> {
  const snap = await db()
    .collection("pedidos")
    .where("mesaId", "==", mesaId)
    .where("cerradoEn", "==", null)
    .get();

  return snap.docs
    .map((d) => aPedido(d.id, d.data()))
    .filter((p) => p.estado !== "cancelado")
    .sort((a, b) => a.numero - b.numero);
}

function aPedido(id: string, d: Record<string, unknown>): Pedido {
  return {
    id,
    numero: d.numero as number,
    mesaId: d.mesaId as string,
    mesaEtiqueta: d.mesaEtiqueta as string,
    estado: d.estado as Estado,
    // Los pedidos anteriores a las adiciones no traen el campo; se normaliza
    // aquí para que nadie más abajo tenga que comprobarlo.
    items: ((d.items as LineaResuelta[]) ?? []).map((i) => ({ ...i, adiciones: i.adiciones ?? [] })),
    totalCop: d.totalCop as number,
    nota: (d.nota as string) || undefined,
    pagado: Boolean(d.pagado),
    creadoEn: aIso(d.creadoEn),
    cerradoEn: d.cerradoEn ? aIso(d.cerradoEn) : null,
  };
}

// serverTimestamp() no está resuelto en el instante del add(), así que un
// pedido leído justo después de crearse puede traer creadoEn en null.
function aIso(valor: unknown): string {
  return valor instanceof Timestamp ? valor.toDate().toISOString() : new Date().toISOString();
}
