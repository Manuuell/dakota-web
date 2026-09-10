// En desarrollo las variables llegan por .env, que Astro expone en
// import.meta.env; en el VPS llegan del entorno de PM2, que es process.env.
export const leer = (nombre: string): string | undefined =>
  (import.meta.env as Record<string, string | undefined>)[nombre] ?? process.env[nombre];

export function exigir(nombre: string): string {
  const valor = leer(nombre);
  if (!valor) throw new Error(`Falta ${nombre} en el entorno. Ver .env.example.`);
  return valor;
}
