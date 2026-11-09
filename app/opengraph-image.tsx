import { ImageResponse } from "next/og";
import { readFile } from "node:fs/promises";
import path from "node:path";

export const alt = "Sri Hari Suvai — South Indian mixes from our home kitchen";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const runtime = "nodejs";

export default async function OpenGraphImage() {
  const [backdrop, mark] = await Promise.all([
    readFile(path.join(process.cwd(), "public/images/generated/home-og-background.jpg"), "base64"),
    readFile(path.join(process.cwd(), "public/brand/spice-mark.png"), "base64"),
  ]);
  return new ImageResponse(
    <div style={{ display: "flex", position: "relative", width: "100%", height: "100%", color: "#ffefd0", background: "#391d11" }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img width={1200} height={630} alt="" src={"data:image/jpeg;base64," + backdrop} style={{ position: "absolute", inset: 0 }} />
      <div style={{ display: "flex", position: "absolute", inset: 0, background: "linear-gradient(90deg, #2e160bf0, #2e160b00)" }} />
      <div style={{ display: "flex", width: 645, padding: "68px 62px", flexDirection: "column", justifyContent: "center" }}>
        <div style={{ display: "flex", alignItems: "center", fontFamily: "serif", fontSize: 36, marginBottom: 32 }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img width={52} height={64} alt="" src={"data:image/png;base64," + mark} style={{ background: "#fbefd4", borderRadius: 6, marginRight: 16 }} />Sri Hari Suvai
        </div>
        <div style={{ display: "flex", fontFamily: "serif", fontSize: 61, lineHeight: 1.08 }}>Authentic South Indian Mixes from Our Home Kitchen</div>
      </div>
    </div>,
    size,
  );
}
