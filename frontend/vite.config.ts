import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    port: 3083,
    host: "0.0.0.0",
    proxy: {
      "/api": {
        target: "http://api-gateway:3084",
        changeOrigin: true,
        secure: false,
      },
      "/ws": {
        target: "ws://api-gateway:3084",
        ws: true,
        changeOrigin: true,
      },
    },
  },
  preview: {
    port: 3083,
    host: "0.0.0.0",
  },
});
