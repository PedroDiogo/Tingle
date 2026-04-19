import { defineConfig } from "vite";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  base: "/Tingle/",
  plugins: [
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["apple-touch-icon.png", "icon-192.png", "icon-512.png"],
      manifest: {
        name: "Tingle",
        short_name: "Tingle",
        description: "A little collection of toys.",
        start_url: ".",
        display: "standalone",
        orientation: "landscape",
        background_color: "#0b1a2b",
        theme_color: "#0b1a2b",
        icons: [
          { src: "icon-192.png", sizes: "192x192", type: "image/png" },
          { src: "icon-512.png", sizes: "512x512", type: "image/png" },
          { src: "icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" }
        ]
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,png,svg,ico,webmanifest}"]
      }
    })
  ]
});
