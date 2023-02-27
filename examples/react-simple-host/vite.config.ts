import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { esmFederation } from "@happening/vite-plugin-esm-federation";

export default defineConfig({
  plugins: [
    react(),
    esmFederation({
      app: {
        name: "react-simple-host",
        remotes: {
          "react-simple-remote":
            "http://localhost:3000/react-simple-remote/custom-federation.json",
        },
        shared: ["react", "react-dom"],
      },
    }),
  ],
});
