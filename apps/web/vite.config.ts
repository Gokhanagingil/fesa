import { execSync } from 'node:child_process';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';
import { defineConfig, type Plugin } from 'vite';

type BuildInfo = {
  commit: string;
  builtAt: string;
};

function safeExec(command: string): string | null {
  try {
    return execSync(command, { cwd: __dirname, stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim();
  } catch {
    return null;
  }
}

function resolveBuildInfo(): BuildInfo {
  return {
    commit: process.env.FESA_GIT_SHA ?? safeExec('git rev-parse HEAD') ?? 'unknown',
    builtAt: process.env.FESA_BUILD_TIME_UTC ?? new Date().toISOString(),
  };
}

function emitBuildInfo(buildInfo: BuildInfo): Plugin {
  return {
    name: 'emit-build-info',
    generateBundle() {
      this.emitFile({
        type: 'asset',
        fileName: 'build-info.json',
        source: `${JSON.stringify(buildInfo, null, 2)}\n`,
      });
    },
  };
}

const buildInfo = resolveBuildInfo();

export default defineConfig({
  plugins: [react(), tailwindcss(), emitBuildInfo(buildInfo)],
  define: {
    __FESA_WEB_BUILD__: JSON.stringify(buildInfo),
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@amateur/shared-types': path.resolve(__dirname, '../../packages/shared-types/src/index.ts'),
    },
  },
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
    },
  },
});
