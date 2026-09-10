import type { APIRoute } from "astro";
import { EquipoError, agregar, exigirDueno, limitar, listar, quienLlama, quitar } from "../../../lib/equipo";

export const prerender = false;

const json = (cuerpo: unknown, status = 200) =>
  new Response(JSON.stringify(cuerpo), {
    status,
    headers: { "content-type": "application/json", "cache-control": "no-store" },
  });

// Detrás de Nginx, request.headers manda: la IP del socket siempre sería la
// del proxy y todo el mundo compartiría el mismo cubo del límite.
const deQuien = (request: Request, clientAddress: string) =>
  request.headers.get("x-forwarded-for")?.split(",")[0].trim() || clientAddress;

async function responder(fn: () => Promise<unknown>) {
  try {
    return json(await fn());
  } catch (e) {
    if (e instanceof EquipoError) return json({ error: e.message }, e.status);
    console.error("[equipo]", e);
    return json({ error: "Algo falló en el servidor." }, 500);
  }
}

export const GET: APIRoute = ({ request, clientAddress }) =>
  responder(async () => {
    limitar(deQuien(request, clientAddress));
    const quien = await quienLlama(request);
    exigirDueno(quien);
    return { equipo: await listar(), yo: quien.uid };
  });

export const POST: APIRoute = ({ request, clientAddress }) =>
  responder(async () => {
    limitar(deQuien(request, clientAddress));
    const quien = await quienLlama(request);
    exigirDueno(quien);

    const cuerpo = (await request.json().catch(() => ({}))) as {
      accion?: string;
      correo?: string;
      rol?: string;
      uid?: string;
    };

    if (cuerpo.accion === "agregar") {
      const rol = cuerpo.rol === "dueno" ? "dueno" : "staff";
      await agregar(String(cuerpo.correo ?? ""), rol);
    } else if (cuerpo.accion === "quitar") {
      await quitar(String(cuerpo.uid ?? ""), quien);
    } else {
      throw new EquipoError("Acción desconocida.");
    }

    return { equipo: await listar(), yo: quien.uid };
  });
