import type { APIRoute } from "astro";
import { mesaActual } from "../../../lib/mesa";
import { crearPedido } from "../../../lib/pedidos";
import { CartaError } from "../../../lib/carta";

export const prerender = false;

const json = (cuerpo: unknown, status = 200) =>
  new Response(JSON.stringify(cuerpo), {
    status,
    headers: { "content-type": "application/json" },
  });

export const POST: APIRoute = async ({ request, cookies }) => {
  // Sin cookie de mesa no hay pedido: es lo que ata el plato a una mesa real
  // y lo que impide que alguien de fuera del local mande comida a la cocina.
  const mesa = await mesaActual(cookies);
  if (!mesa) return json({ error: "Escanea el QR de tu mesa para pedir." }, 403);

  let cuerpo: { items?: unknown; nota?: string };
  try {
    cuerpo = await request.json();
  } catch {
    return json({ error: "No se entendió el pedido." }, 400);
  }

  try {
    const { id, numero } = await crearPedido(mesa, cuerpo.items, cuerpo.nota);
    return json({ id, numero });
  } catch (e) {
    if (e instanceof CartaError) return json({ error: e.message }, 400);
    throw e;
  }
};
