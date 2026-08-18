import tailwindcss from '@tailwindcss/vite'
import { tanstackRouter } from '@tanstack/router-plugin/vite'
import react from '@vitejs/plugin-react'
import child_process from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { env } from 'node:process'
import { defineConfig } from 'vite'

const baseFolder =
  env.APPDATA !== undefined && env.APPDATA !== ''
    ? `${env.APPDATA}/ASP.NET/https`
    : `${env.HOME}/.aspnet/https`

const certificateName = 'sona.client'
const certFilePath = path.join(baseFolder, `${certificateName}.pem`)
const keyFilePath = path.join(baseFolder, `${certificateName}.key`)

if (!fs.existsSync(baseFolder)) {
  fs.mkdirSync(baseFolder, { recursive: true })
}

if (!fs.existsSync(certFilePath) || !fs.existsSync(keyFilePath)) {
  if (
    0 !==
    child_process.spawnSync(
      'dotnet',
      [
        'dev-certs',
        'https',
        '--export-path',
        certFilePath,
        '--format',
        'Pem',
        '--no-password',
      ],
      { stdio: 'inherit' },
    ).status
  ) {
    throw new Error('Could not create certificate.')
  }
}

const target = env.ASPNETCORE_HTTPS_PORT ? `https://localhost:${env.ASPNETCORE_HTTPS_PORT}` :
    env.ASPNETCORE_URLS ? env.ASPNETCORE_URLS.split(';')[0] : 'https://localhost:7296';

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    // tanstackRouter must come before react()
    tanstackRouter({
      target: 'react',
      routesDirectory: './src/routes',
      generatedRouteTree: './src/routeTree.gen.ts',
      autoCodeSplitting: true,
    }),
    react(),
    tailwindcss(),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
    server: {
    proxy: {
            '^/api': {
                target,
                changeOrigin: true,
                secure: false
            },
            '/auth': {
                target: target,
                changeOrigin: true,
                secure: false,
            },
            '/MicrosoftIdentity': {
                target,
                changeOrigin: true,
                secure: false
            },
            '/signin-oidc': {
                target,
                changeOrigin: true,
                secure: false
            }
    },
    port: 5173,
    https: {
      key: fs.readFileSync(keyFilePath),
      cert: fs.readFileSync(certFilePath),
    },
  },
  build: {
    outDir: '../sona.server/wwwroot',
    emptyOutDir: true,
  },
})
