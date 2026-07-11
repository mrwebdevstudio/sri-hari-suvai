import { ImageResponse } from "next/og";
import { readFile } from "node:fs/promises";
import path from "node:path";

export const alt = "Sri Hari Suvai — South Indian food products";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const runtime = "nodejs";

export default async function OpenGraphImage() {
  const heroBase64 = await readFile(
    path.join(process.cwd(), "public", "images", "generated", "home-og-background.jpg"),
    "base64",
  );

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          position: "relative",
          background: "#f6efe3",
          color: "#241b15",
        }}
      >
        {/* ImageResponse renders a server-generated raster image and requires a native image element. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={"data:image/jpeg;base64," + heroBase64}
          alt=""
          width="1200"
          height="768"
          style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }}
        />
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            background: "linear-gradient(90deg, rgba(246,239,227,0.98) 0%, rgba(246,239,227,0.92) 42%, rgba(246,239,227,0.1) 75%)",
          }}
        />
        <div style={{ display: "flex", position: "absolute", inset: 0, flexDirection: "column", justifyContent: "center", width: 650, padding: "72px 80px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 20, marginBottom: 34 }}>
            <div style={{ width: 74, height: 74, borderRadius: 37, display: "flex", alignItems: "center", justifyContent: "center", background: "#8f342b", color: "#fff8ed", fontSize: 26, fontWeight: 700 }}>SH</div>
            <span style={{ fontSize: 30, fontWeight: 700, letterSpacing: "0.02em" }}>Sri Hari Suvai</span>
          </div>
          <div style={{ fontFamily: "Georgia, serif", fontSize: 67, lineHeight: 1.02, letterSpacing: "-0.03em" }}>Flavour, presented with quiet confidence.</div>
          <div style={{ marginTop: 30, fontSize: 22, color: "#5d5148" }}>South Indian food products</div>
        </div>
      </div>
    ),
    size,
  );
}
