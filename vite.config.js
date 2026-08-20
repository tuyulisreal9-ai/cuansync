import { defineConfig } from "vite";

export default defineConfig({
  build: {
    rolldownOptions: {
      output: {
        codeSplitting: {
          minSize: 20_000,
          groups: [
            {
              name: "supabase",
              test: /node_modules[\\/]\.pnpm[\\/]@supabase/,
            },
            {
              name: "ui-vendor",
              test: /node_modules[\\/].*(react|scheduler|lucide-react|htm)/,
            },
          ],
        },
      },
    },
  },
});
