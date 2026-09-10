import type { APIRoute } from "astro";
import { mesaActual } from "../../../../lib/mesa";
import { cuentaDeMesa, pedidoPorId } from "../../../../lib/pedidos";

export const prerender = false;

// Lo que sondea /pedido/[id] cada pocos segundos: el estado de este pedido y
// el total vivo de la mesa (que sube si alguien más pide otra ronda).
export const GET: APIRoute = async ({ params, cookies }) => {
  const mesa = await mesaActual(cookies);
  const pedido = await pedidoPorId(params.id!);

  if (!mesa || !pedido || pedido.mesaId !== mesa.id) {
    return new Response(null, { status: 404 });
  }

  const cuenta = await cuentaDeMesa(mesa.id);

  return new Response(
    JSON.stringify({
      estado: pedido.estado,
      pagado: pedido.pagado,
      totalMesa: cuenta.reduce((s, p) => s + p.totalCop, 0),
      pedidos: cuenta.length,
    }),
    { headers: { "content-type": "application/json", "cache-control": "no-store" } }
  );
};
