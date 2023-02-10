import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { esmFederation } from "@happening/vite-plugin-esm-federation";

export default defineConfig({
  base: "/react-simple-remote/",
  plugins: [
    react(),
    esmFederation({
      fileName: "custom-federation.json",
      app: {
        name: "react-simple-remote",
        exposes: {
          federated: "./src/Federated.tsx",
          button: "./src/Button.tsx",
        },
        shared: ["react", "react-dom"],
      },
    }),
  ],
});
