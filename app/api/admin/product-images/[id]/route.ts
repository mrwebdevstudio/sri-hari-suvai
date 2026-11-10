import { getAdminUser } from "@/lib/auth";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export async function GET(_request: Request,{params}:{params:Promise<{id:string}>}) {
  if (!await getAdminUser()) return new Response(null,{status:403});
  const admin=await createServerSupabaseClient();
  const {id}=await params;
  const {data:row}=await admin.from("product_images").select("object_name").eq("product_id",id).maybeSingle();
  if (!row) return new Response(null,{status:404});
  const {data}=await admin.storage.from("product-images").download(row.object_name);
  return data ? new Response(data,{headers:{"Content-Type":data.type,"Cache-Control":"private, no-store","X-Content-Type-Options":"nosniff"}}) : new Response(null,{status:404});
}
