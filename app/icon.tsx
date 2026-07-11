import { ImageResponse } from "next/og";

export const size = { width: 64, height: 64 };
export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          borderRadius: "50%",
          background: "#8f342b",
          color: "#fff8ed",
          fontSize: 23,
          fontWeight: 700,
          letterSpacing: "-0.04em",
        }}
      >
        SH
      </div>
    ),
    size,
  );
}
