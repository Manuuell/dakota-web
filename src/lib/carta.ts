import menu from "../data/menu.json";

export interface Producto {
  id: string;
  nombre: string;
  precio: number;
  precioPapa?: number;
}

// El menú sigue viviendo en menu.json: cambiar un precio es editar una línea,
// igual que antes. Lo único que se guarda en Firestore es el pedido, con el
// nombre y el precio copiados en el momento de pedirlo, para que subir un
// precio mañana no reescriba la cuenta de ayer.
const catalogo = new Map<string, Producto>(
  menu.categorias.flatMap((c) =>
    c.productos.map((p): [string, Producto] => [p.id, p as Producto])
  )
);

export interface Adicion {
  id: string;
  nombre: string;
  precio: number;
}

// Las adiciones se declaran por categoría, así que un plato solo puede llevar
// las de la suya: pedir "quesudo" con una hamburguesa no es un precio raro, es
// un plato que no existe.
const adicionesPorProducto = new Map<string, Map<string, Adicion>>(
  menu.categorias.flatMap((c) => {
    const disponibles = new Map((c.adiciones ?? []).map((a) => [a.id, a as Adicion]));
    return c.productos.map((p): [string, Map<string, Adicion>] => [p.id, disponibles]);
  })
);

export function adicionesDe(productoId: string): Adicion[] {
  return [...(adicionesPorProducto.get(productoId)?.values() ?? [])];
}

export interface LineaPedida {
  id: string;
  cantidad: number;
  conPapa?: boolean;
  adiciones?: string[];
  nota?: string;
}

export interface LineaResuelta {
  productoId: string;
  nombre: string;
  precioCop: number;
  conPapa: boolean;
  adiciones: Adicion[];
  cantidad: number;
  nota?: string;
}

/** Lo que cuesta una unidad con todo lo que lleva encima. */
export const precioUnidad = (l: LineaResuelta) =>
  l.precioCop + l.adiciones.reduce((s, a) => s + a.precio, 0);

export const precioLinea = (l: LineaResuelta) => precioUnidad(l) * l.cantidad;

export class CartaError extends Error {}

const MAX_LINEAS = 40;
const MAX_CANTIDAD = 20;
const MAX_NOTA = 140;

/**
 * Traduce lo que manda el navegador a líneas con precio.
 *
 * El cliente solo puede decir *qué* pide, nunca cuánto cuesta: el precio se
 * busca aquí. Si llegara desde el navegador, cualquiera podría pedirse una
 * Big Dakota por mil pesos editando el JSON del fetch.
 */
export function resolverLineas(lineas: unknown): { items: LineaResuelta[]; totalCop: number } {
  if (!Array.isArray(lineas) || lineas.length === 0) {
    throw new CartaError("El pedido llegó vacío.");
  }
  if (lineas.length > MAX_LINEAS) {
    throw new CartaError("Demasiadas líneas en un mismo pedido.");
  }

  const items = lineas.map((linea): LineaResuelta => {
    const { id, cantidad, conPapa, adiciones, nota } = (linea ?? {}) as LineaPedida;

    const producto = catalogo.get(String(id));
    if (!producto) throw new CartaError(`No existe el producto "${id}".`);

    if (!Number.isInteger(cantidad) || cantidad < 1 || cantidad > MAX_CANTIDAD) {
      throw new CartaError(`Cantidad no válida para ${producto.nombre}.`);
    }

    const quierePapa = conPapa === true;
    if (quierePapa && producto.precioPapa === undefined) {
      throw new CartaError(`${producto.nombre} no se sirve con papa.`);
    }

    return {
      productoId: producto.id,
      nombre: producto.nombre,
      precioCop: quierePapa ? producto.precioPapa! : producto.precio,
      conPapa: quierePapa,
      adiciones: resolverAdiciones(producto, adiciones),
      cantidad,
      nota: nota?.trim().slice(0, MAX_NOTA) || undefined,
    };
  });

  const totalCop = items.reduce((suma, i) => suma + precioLinea(i), 0);
  return { items, totalCop };
}

function resolverAdiciones(producto: Producto, pedidas: unknown): Adicion[] {
  if (pedidas === undefined || pedidas === null) return [];
  if (!Array.isArray(pedidas)) throw new CartaError("Adiciones mal formadas.");

  const disponibles = adicionesPorProducto.get(producto.id) ?? new Map();
  const vistas = new Set<string>();

  return pedidas.map((id) => {
    const adicion = disponibles.get(String(id));
    if (!adicion) {
      throw new CartaError(`${producto.nombre} no admite la adición "${id}".`);
    }
    // Sin esto, mandar el mismo id diez veces cobraría diez quesudos por un
    // plato que solo lleva uno.
    if (vistas.has(adicion.id)) {
      throw new CartaError(`"${adicion.nombre}" viene repetida.`);
    }
    vistas.add(adicion.id);
    return adicion;
  });
}

export const cop = (n: number) => "$" + new Intl.NumberFormat("es-CO").format(n);
