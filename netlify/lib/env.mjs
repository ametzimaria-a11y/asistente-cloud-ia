// Lee variables de entorno tanto en Netlify Functions (Node) como en Edge Functions (Deno).
export const env = (nombre) => globalThis.Netlify?.env?.get?.(nombre) ?? globalThis.process?.env?.[nombre];