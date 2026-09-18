import { defineConfig, type Plugin } from 'vite'
import { devtools } from '@tanstack/devtools-vite'

import { tanstackStart } from '@tanstack/react-start/plugin/vite'

import viteReact from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { nitro } from 'nitro/vite'

function counterPushBootstrap(): Plugin {
  return {
    name: 'counter-push-bootstrap',
    configureServer(server) {
      void import('./src/lib/counter-mqtt.server.ts')
        .then(({ ensureCounterStatePushListener }) => {
          ensureCounterStatePushListener()
        })
        .catch((error) => {
          server.config.logger.error(`Counter FCM bootstrap failed: ${error instanceof Error ? error.stack ?? error.message : String(error)}`)
        })
    },
  }
}

const config = defineConfig({
  server: {
    allowedHosts: [
      'counter.niteowl.dev',
      'counter.mccarthysirishpub.com',
    ],
  },
  resolve: { tsconfigPaths: true },
  plugins: [
    counterPushBootstrap(),
    devtools(),
    nitro({ rollupConfig: { external: [/^@sentry\//] } }),
    tailwindcss(),
    tanstackStart(),
    viteReact(),
  ],
})

export default config
