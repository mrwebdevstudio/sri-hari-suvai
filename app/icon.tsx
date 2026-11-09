import { readFile } from "node:fs/promises";
import path from "node:path";
import { ImageResponse } from "next/og";

export const size = { width: 64, height: 64 };
export const contentType = "image/png";

export default async function Icon() {
  const mark = await readFile(path.join(process.cwd(), "public", "brand", "spice-mark.png"), "base64");
  return new ImageResponse(
    <div style={{ display: "flex", width: "100%", height: "100%", alignItems: "center", justifyContent: "center", background: "#fbf1df", borderRadius: 12 }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img alt="" src={"data:image/png;base64," + mark} width={45} height={55} />
    </div>,
    size,
  );
}
