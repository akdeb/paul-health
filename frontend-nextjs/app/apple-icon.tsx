import { ImageResponse } from "next/og";

export const size = {
  width: 180,
  height: 180,
};

export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          alignItems: "center",
          background: "#111111",
          borderRadius: 32,
          color: "#f6f1e8",
          display: "flex",
          fontSize: 112,
          fontStyle: "normal",
          fontWeight: 700,
          height: "100%",
          justifyContent: "center",
          width: "100%",
        }}
      >
        P
      </div>
    ),
    size,
  );
}
