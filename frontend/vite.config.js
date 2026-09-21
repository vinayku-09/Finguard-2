import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
export default defineConfig({ base: process.env.PAGES_BASE || '/', plugins: [react()], server: { proxy: { '/api': 'http://localhost:8000' } } })
