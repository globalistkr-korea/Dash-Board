import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// 빌드마다 고유 ID — 앱에 주입되고 dist/version.json에도 기록됨.
const BUILD_ID = String(Date.now())

// 배포 후 "새 버전 알림 + [업데이트]"용 version.json 생성 플러그인
function emitVersionJson() {
  return {
    name: 'emit-version-json',
    apply: 'build',
    generateBundle() {
      this.emitFile({
        type: 'asset',
        fileName: 'version.json',
        source: JSON.stringify({ buildId: BUILD_ID }),
      })
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), emitVersionJson()],
  define: {
    __BUILD_ID__: JSON.stringify(BUILD_ID),
  },
})
