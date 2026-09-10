import type { APIRoute } from "astro";
import { mesaPorToken, olvidarMesa, recordarMesa } from "../../../lib/mesa";

export const prerender = false;

// Destino del QR de la mesa. No renderiza nada: deja la cookie y manda a la
// carta. Un token que ya no existe (mesa borrada, calcomanía vieja) no es un
// error de cara al comensal — se le deja ver la carta y pedir por WhatsApp.
export const GET: APIRoute = async ({ params, cookies, redirect }) => {
  const mesa = await mesaPorToken(params.token);

  if (!mesa) {
    olvidarMesa(cookies);
    return redirect("/pedir/?qr=invalido", 302);
  }

  recordarMesa(cookies, params.token!);
  return redirect("/pedir/", 302);
};
