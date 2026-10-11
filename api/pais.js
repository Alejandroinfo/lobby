/**
 * Devuelve solo el código de país (2 letras) de quien abre el lobby, según Vercel.
 * No se guarda ni se devuelve la IP, la ciudad ni nada más.
 */
export function GET(request) {
  const pais = request.headers.get("x-vercel-ip-country");
  return Response.json(
    { pais: pais && /^[A-Z]{2}$/.test(pais) ? pais : null },
    { headers: { "Cache-Control": "no-store" } },
  );
}
