import type { Config } from 'jest'
import nextJest from 'next/jest.js'

const createJestConfig = nextJest({ dir: './' })

const config: Config = {
  testEnvironment: 'node',
  testMatch: ['**/tests/**/*.test.ts'],
  testPathIgnorePatterns: ['/node_modules/', '/.claude/', '/.next/'],
  modulePathIgnorePatterns: ['<rootDir>/.claude/'],
}

export default createJestConfig(config)
