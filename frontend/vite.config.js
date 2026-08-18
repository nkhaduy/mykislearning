import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { viteStaticCopy } from 'vite-plugin-static-copy'
import frappeui from 'frappe-ui/vite'

const root = path.dirname(fileURLToPath(import.meta.url))

export default defineConfig({
	define: { __VUE_PROD_HYDRATION_MISMATCH_DETAILS__: 'false' },
	plugins: [
		frappeui({ frappeProxy: false, lucideIcons: true, jinjaBootData: false }),
		vue(),
		viteStaticCopy({ targets: [
			{ src: 'node_modules/pdfjs-dist/cmaps/*', dest: 'pdfjs/cmaps' },
			{ src: 'node_modules/pdfjs-dist/standard_fonts/*', dest: 'pdfjs/standard_fonts' },
		] }),
	],
	resolve: {
		alias: [
			{ find: /^frappe-ui$/, replacement: path.resolve(root, 'src/backend/frappe-ui.js') },
			{ find: 'frappe-ui-original', replacement: path.resolve(root, 'node_modules/frappe-ui/src/index.ts') },
			{ find: '@', replacement: path.resolve(root, 'src') },
		],
		dedupe: ['vue', 'frappe-ui', 'prosemirror-model', 'prosemirror-state', 'prosemirror-view', 'prosemirror-transform'],
	},
	build: { outDir: '../dist-frappe', emptyOutDir: true },
	server: { host: '0.0.0.0', allowedHosts: true },
})
