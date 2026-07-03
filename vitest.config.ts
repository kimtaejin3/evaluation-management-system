import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import { dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

// `@/` → 프로젝트 루트 (tsconfig paths와 동일). 컴포넌트가 `@/app/**/actions` 등을 import함.
const rootDir = dirname(fileURLToPath(import.meta.url))
const alias = { '@': rootDir }

// 두 프로젝트로 분리:
// - unit: lib/의 순수 함수(node 환경)
// - components: 컴포넌트 렌더/상호작용(jsdom + @testing-library/react)
export default defineConfig({
  test: {
    projects: [
      {
        resolve: { alias },
        test: {
          name: 'unit',
          environment: 'node',
          include: ['lib/**/*.test.ts'],
        },
      },
      {
        plugins: [react()],
        resolve: { alias },
        test: {
          name: 'components',
          environment: 'jsdom',
          include: ['components/**/*.test.tsx', 'app/**/*.test.tsx'],
          setupFiles: ['./vitest.setup.ts'],
        },
      },
    ],
  },
})
