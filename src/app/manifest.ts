import type { MetadataRoute } from "next";
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "ISOLA · 우리의 작은 낙원",
    short_name: "ISOLA",
    description: "좋아하는 것들로 채우는 우리의 섬",
    start_url: "/",
    display: "standalone",
    background_color: "#f7f6ef",
    theme_color: "#f7f6ef",
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
