import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { lucideIcons } from 'frappe-ui/vite'
import { fileURLToPath, URL } from 'node:url'

export default defineConfig({
  plugins: [...lucideIcons(), vue()],
  resolve: {
    alias: {
      '@frappe/Button': fileURLToPath(new URL('./node_modules/frappe-ui/src/components/Button/Button.vue', import.meta.url)),
      '@frappe/Badge': fileURLToPath(new URL('./node_modules/frappe-ui/src/components/Badge/Badge.vue', import.meta.url)),
      '@frappe/FormControl': fileURLToPath(new URL('./node_modules/frappe-ui/src/components/FormControl/FormControl.vue', import.meta.url)),
      '@frappe/ErrorMessage': fileURLToPath(new URL('./node_modules/frappe-ui/src/components/ErrorMessage/ErrorMessage.vue', import.meta.url)),
    },
  },
  build: { outDir: '../dist-frappe', emptyOutDir: true },
})
