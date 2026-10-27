/**
 * API-Key-Ablage: verschlüsselt über Electron safeStorage (Windows DPAPI, macOS Keychain,
 * Linux Secret Service). Ist keine Verschlüsselung verfügbar, wird der Key NICHT gespeichert –
 * niemals im Klartext. Der Key verlässt den Main-Process nie.
 */
import { app, safeStorage } from 'electron'
import { existsSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import type { AiStatus } from '@shared/ai'

const file = () => join(app.getPath('userData'), 'claude-key.bin')

export class KeyStoreError extends Error {
  constructor(public readonly code: 'AI_NO_ENCRYPTION' | 'AI_BAD_REQUEST') {
    super(code)
  }
}

export function getApiKey(): string | null {
  if (!existsSync(file()) || !safeStorage.isEncryptionAvailable()) return null
  try {
    return safeStorage.decryptString(readFileSync(file()))
  } catch {
    // z. B. Datei von einem anderen Benutzerkonto → unbrauchbar
    return null
  }
}

export function keyStatus(): AiStatus {
  const key = getApiKey()
  return { hasKey: !!key, encryptionAvailable: safeStorage.isEncryptionAvailable(), keyHint: key ? key.slice(-4) : null }
}

export function saveApiKey(raw: unknown): AiStatus {
  const key = typeof raw === 'string' ? raw.trim() : ''
  if (!/^sk-ant-[A-Za-z0-9_-]{20,}$/.test(key)) throw new KeyStoreError('AI_BAD_REQUEST')
  if (!safeStorage.isEncryptionAvailable()) throw new KeyStoreError('AI_NO_ENCRYPTION')
  writeFileSync(file(), safeStorage.encryptString(key))
  return keyStatus()
}

export function removeApiKey(): AiStatus {
  rmSync(file(), { force: true })
  return keyStatus()
}
