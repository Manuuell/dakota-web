import { defineConfig } from 'astro/config';
import node from '@astrojs/node';

export default defineConfig({
  // Híbrido: con `output: 'static'` (el de por defecto) todo se prerenderiza y
  // solo lo que declara `prerender = false` se renderiza por petición. Así la
  // home sigue siendo el HTML estático de siempre y el flujo de pedido en mesa,
  // que necesita cookie y base de datos, se resuelve en el servidor.
  adapter: node({ mode: 'standalone' }),

  // Dominio definitivo, pendiente de registrar. El menú impreso ya lo anuncia,
  // así que en cuanto exista se descomenta esta línea y se comenta la de abajo.
  // site: 'https://www.dakotactg.co',

  // Hogar temporal mientras dakotactg.co no exista. Importa que sea el dominio
  // real: de aquí salen las URL canónicas y el sitemap, y apuntarlos a un
  // dominio que no resuelve los deja inservibles.
  site: 'https://dakota.sentralabs.co',

  server: { port: 4321 },
});
