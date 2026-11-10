// Run from the repository root with node --env-file=.env.local scripts/import-dev-product-images.mjs
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { createClient } from "@supabase/supabase-js";
import { products } from "../lib/products.ts";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const stageOnly=process.argv.includes("--stage");
const key=stageOnly ? process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY : process.env.SUPABASE_SERVICE_ROLE_KEY;
if (url !== "https://uqgnxezgpqacfyaijojk.supabase.co" || !key || (stageOnly && !process.env.SHS_ADMIN_SESSION)) {
  throw new Error("Provide the dedicated development credentials. Staging requires a signed-in administrator.");
}
const db = createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false},global:{headers:stageOnly?{Authorization:"Bearer "+process.env.SHS_ADMIN_SESSION}:{}}});
const media = db.storage.from("product-images");
const {data:rows,error} = await db.from("products").select("id,slug,product_images(object_name)");
if (error) throw new Error("Cannot read the development catalogue.");
let imported=0;
const staged=[];
for (const product of products) {
  const row=rows.find(item=>item.slug===product.slug);
  if (!row) throw new Error("Missing database product: "+product.slug);
  if (row.product_images) continue; // Preserve an administrator's replacement.
  const bytes=await readFile(new URL("../public/images/products/"+product.slug+".png",import.meta.url));
  const hash=createHash("sha256").update(bytes).digest("hex");
  const objectName=row.id+"/00000000-0000-8000-8000-"+hash.slice(0,12)+".png";
  const uploaded=await media.upload(objectName,bytes,{contentType:"image/png",cacheControl:"60",upsert:false});
  if (uploaded.error && !/exist|duplicate/i.test(uploaded.error.message)) throw new Error("Upload failed for "+product.slug);
  const {data:blob}=await media.download(objectName);
  if (!blob || createHash("sha256").update(Buffer.from(await blob.arrayBuffer())).digest("hex")!==hash) throw new Error("Asset checksum mismatch: "+product.slug);
  if (stageOnly) { staged.push({product_id:row.id,object_name:objectName}); continue; }
  const linked=await db.from("product_images").upsert({product_id:row.id,object_name:objectName},{onConflict:"product_id",ignoreDuplicates:true});
  if (linked.error) throw new Error("Could not publish "+product.slug);
  imported++;
}
console.log(stageOnly?JSON.stringify(staged):"Imported and verified "+imported+" original catalogue images.");
