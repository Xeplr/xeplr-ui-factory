import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// The standalone dev app only (dev/). Not part of what is published.
export default defineConfig({
  plugins: [react()],
  // @xeplr/ui-canvas is linked from a sibling folder with its own node_modules;
  // React must still be ONE copy, or its hooks throw "invalid hook call".
  resolve: { dedupe: ['react', 'react-dom', '@xeplr/ui-canvas'] },
  server: { port: 19006 }
})
