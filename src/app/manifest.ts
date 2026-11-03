import type { MetadataRoute } from "next";
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "CAPY COVE · 카피바라들의 노을 마을",
    short_name: "CAPY COVE",
    description: "카피바라가 되어 걷고, 친구의 작은 세계에 놀러 가요.",
    start_url: "/",
    display: "standalone",
    background_color: "#68c5d3",
    theme_color: "#68c5d3",
    lang: "ko",
    icons: [
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" },
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      {
        src: "/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
