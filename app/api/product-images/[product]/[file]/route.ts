import { createPublicSupabaseClient } from "@/lib/supabase/public";

export async function GET(_request: Request, { params }: { params: Promise<{product: string; file: string}> }) {
  const { product, file } = await params;
  if (!/^[a-f0-9-]{36}$/.test(product) || !/^[a-f0-9-]{36}\.(png|jpg|webp)$/.test(file)) return new Response(null, { status: 404 });
  // Storage RLS makes only the active product's currently published object readable.
  const {data,error} = await createPublicSupabaseClient().storage.from("product-images").download(product + "/" + file);
  if (!data || error) return new Response(null, {status:404,headers:{"Cache-Control":"no-store"}});
  return new Response(data,{headers:{"Content-Type":data.type,"Cache-Control":"public, max-age=60, must-revalidate","X-Content-Type-Options":"nosniff"}});
}
