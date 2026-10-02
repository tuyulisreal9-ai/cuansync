import { defineConfig } from "vite";
import { fileURLToPath } from "node:url";

/* Halaman pengantar berdiri sendiri dan tidak ikut dalam build aplikasi.

   Folder ini sengaja lengkap sendiri: logonya disalin ke landing/branding,
   bukan dipinjam dari public/ milik aplikasi. Dengan begitu folder ini bisa
   diterbitkan apa adanya sebagai berkas statis, termasuk oleh Vercel yang
   memakai folder ini sebagai Root Directory, tanpa perlu membangun apa pun.

   publicDir dimatikan karena semua berkasnya memang sudah berada di dalam
   root ini; kalau dibiarkan, Vite mencari folder public yang tidak ada.
   Porta 5174 dipakai agar aplikasi di 5173 tetap bisa berjalan berdampingan. */
export default defineConfig({
  root: fileURLToPath(new URL(".", import.meta.url)),
  publicDir: false,
  server: {
    port: 5174,
    strictPort: true,
  },
});
