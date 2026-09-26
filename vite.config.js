import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

// 로컬 개발(npm run dev)에서도 /api/* 서버 함수가 동작하도록 연결 (배포 시에는 Vercel이 처리)
function localApi() {
  return {
    name: 'local-api',
    configureServer(server) {
      Object.assign(process.env, loadEnv(server.config.mode, process.cwd(), ''))
      server.middlewares.use(async (req, res, next) => {
        const path = req.url.split('?')[0]
        if (!path.startsWith('/api/')) return next()
        try {
          const mod = await server.ssrLoadModule(`/api/${path.slice(5)}.js`)
          await mod.default(req, res)
        } catch (err) {
          console.error(err)
          res.statusCode = 404
          res.end(JSON.stringify({ message: 'API를 찾을 수 없어요.' }))
        }
      })
    },
  }
}

export default defineConfig({
  plugins: [react(), localApi()],
})
