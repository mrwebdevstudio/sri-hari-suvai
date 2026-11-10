import { createServerSupabaseClient } from "@/lib/supabase/server";
import { noStoreJson } from "@/lib/http";
import { rateLimitRequest } from "@/lib/rate-limit";

export async function POST(request: Request) {
  const origin=request.headers.get("origin");
  if (request.headers.get("sec-fetch-site")==="cross-site" || (origin && URL.parse(origin)?.host!==request.headers.get("host"))) {
    return noStoreJson({error:"Invalid origin"},{status:403});
  }
  if (request.headers.get("content-type")?.split(";")[0]!=="application/json") return noStoreJson({error:"JSON required"},{status:415});
  if (!rateLimitRequest(request,"cart",180,60000).allowed) return noStoreJson({error:"Too many requests"},{status:429});
  const body=await request.json().catch(()=>null);
  if (!body || !["load","merge","add","set","remove","clear"].includes(body.action) ||
      !Array.isArray(body.items) || body.items.length>100) return noStoreJson({error:"Invalid cart"},{status:400});
  const client=await createServerSupabaseClient();
  const {data:{user}}=await client.auth.getUser();
  if (!user || body.owner!==user.id) return noStoreJson({error:"Session changed"},{status:401});
  const {data,error}=await client.rpc("my_cart",{p_action:body.action,p_items:body.items,p_import_id:body.importId??null});
  return error ? noStoreJson({error:"Cart update failed"},{status:409}) : noStoreJson({items:data});
}
