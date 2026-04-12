'use strict'
/**
 * Computes the app version from `git describe` and writes it to
 * apps/backend/dist/VERSION, which the backend reads at startup.
 *
 * Called from the Docker builder stage after the backend is compiled.
 * Must be run from the repo root: node scripts/write-version.cjs
 */
const { execSync } = require('child_process')
const { writeFileSync } = require('fs')
const { join } = require('path')

function computeVersion(raw) {
  const m = raw.match(/^v(\d+)\.(\d+)\.(\d+)-(\d+)-g([0-9a-f]+)(-dirty)?$/)
  if (!m) return raw.replace(/^v/, '')
  const [, major, minor, patch, distance, hash, dirty] = m
  const base = distance === '0'
    ? `${major}.${minor}.${patch}`
    : `${major}.${minor}.${Number(patch) + 1}-dev+${hash.slice(0, 7)}`
  return dirty ? `${base}-dirty` : base
}

function getVersion() {
  // In Docker builds the CI runner passes APP_VERSION_RAW so we never run
  // git describe inside the container where the tree may appear dirty.
  const envRaw = (process.env.APP_VERSION_RAW || '').trim()
  if (envRaw) return computeVersion(envRaw)
  try {
    const raw = execSync('git describe --tags --long --dirty --match "v*"', {
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
    }).trim()
    return computeVersion(raw)
  } catch (_) {}
  return require(join(process.cwd(), 'apps/backend/package.json')).version
}

const version = getVersion()
writeFileSync(join(process.cwd(), 'apps/backend/dist/VERSION'), version)
console.log(`Backend version: ${version}`)
