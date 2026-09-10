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

export interface LineaPedida {
  id: string;
  cantidad: number;
  conPapa?: boolean;
  nota?: string;
}

export interface LineaResuelta {
  productoId: string;
  nombre: string;
  precioCop: number;
  conPapa: boolean;
  cantidad: number;
  nota?: string;
}

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
    const { id, cantidad, conPapa, nota } = (linea ?? {}) as LineaPedida;

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
      cantidad,
      nota: nota?.trim().slice(0, MAX_NOTA) || undefined,
    };
  });

  const totalCop = items.reduce((suma, i) => suma + i.precioCop * i.cantidad, 0);
  return { items, totalCop };
}

export const cop = (n: number) => "$" + new Intl.NumberFormat("es-CO").format(n);
