/**
 * Aufruf der Claude API für die Befehlsleiste.
 * - Netzwerkzugriff nur hier und nur, wenn die Nutzerin aktiv einen Befehl ausführt
 * - Strukturierte Ausgabe (Zod-Schema) → garantiert gültige Änderungsliste
 * - Bei einer Ablehnung durch das gewählte Modell springt serverseitig ein Ersatzmodell ein
 * - Keine Inhalte in Logs
 */
import Anthropic from '@anthropic-ai/sdk'
import { betaZodOutputFormat } from '@anthropic-ai/sdk/helpers/beta/zod'
import { app } from 'electron'
import * as z from 'zod/v4'
import { claudeModels, contentForAi, defaultClaudeModel, isClaudeModel, type AiErrorCode, type AiResult, type AiRunInput } from '@shared/ai'
import type { DocContent } from '@shared/document'
import { getApiKey } from './keystore'
import { SYSTEM_PROMPT, buildUserMessage } from './prompt'

export class AiError extends Error {
  constructor(public readonly code: AiErrorCode) {
    super(code)
  }
}

const ResultSchema = z.object({
  summary: z.string(),
  changes: z.array(
    z.object({
      label: z.string(),
      path: z.string(),
      action: z.enum(['replace', 'insert', 'remove']),
      new_value_json: z.string()
    })
  ),
  matched_keywords: z.array(z.string()),
  missing_keywords: z.array(z.string())
})

/** Nur im Entwicklungsmodus: Test-Server statt echter API (für automatisierte Tests). */
const testBaseUrl = () => (!app.isPackaged ? process.env['DOCFORGE_AI_BASE_URL'] : undefined)

function client(key: string): Anthropic {
  return new Anthropic({ apiKey: key, baseURL: testBaseUrl(), timeout: 180_000, maxRetries: 2 })
}

/** Übersetzt SDK-Fehler in stabile Codes (spezifisch → allgemein). */
function mapError(e: unknown): AiError {
  if (e instanceof AiError) return e
  if (e instanceof Anthropic.APIUserAbortError) return new AiError('AI_CANCELLED')
  if (e instanceof Anthropic.AuthenticationError || e instanceof Anthropic.PermissionDeniedError) return new AiError('AI_AUTH')
  if (e instanceof Anthropic.RateLimitError) return new AiError('AI_RATE')
  if (e instanceof Anthropic.BadRequestError) return new AiError('AI_BAD_REQUEST')
  if (e instanceof Anthropic.APIConnectionError) return new AiError('AI_OFFLINE')
  if (e instanceof Anthropic.APIError && (e.status === 529 || (e.status ?? 0) >= 500)) return new AiError('AI_OVERLOADED')
  console.warn('[ai] Anfrage fehlgeschlagen:', e instanceof Anthropic.APIError ? `HTTP ${e.status}` : e instanceof Error ? e.name : 'unknown')
  return new AiError('AI_FAILED')
}

let inFlight: AbortController | null = null

export function cancelRun(): void {
  inFlight?.abort()
}

export async function testKey(model: string): Promise<boolean> {
  const key = getApiKey()
  if (!key) throw new AiError('AI_NO_KEY')
  try {
    await client(key).models.retrieve(isClaudeModel(model) ? model : defaultClaudeModel)
    return true
  } catch (e) {
    throw mapError(e)
  }
}

export async function runCommand(input: AiRunInput, content: DocContent, language: string, model: string): Promise<Omit<AiResult, 'changes'> & { changes: AiResult['changes'] }> {
  const key = getApiKey()
  if (!key) throw new AiError('AI_NO_KEY')
  const command = String(input.command ?? '').trim().slice(0, 4000)
  if (!command) throw new AiError('AI_BAD_REQUEST')
  const jobPosting = input.jobPosting ? String(input.jobPosting).slice(0, 30_000) : null
  const modelId = isClaudeModel(model) ? model : defaultClaudeModel
  const withFallback = claudeModels.find((m) => m.id === modelId)?.fallback ?? false

  inFlight?.abort()
  const controller = new AbortController()
  inFlight = controller
  try {
    const response = await client(key).beta.messages.parse(
      {
        model: modelId,
        max_tokens: 16000,
        output_config: { effort: 'medium', format: betaZodOutputFormat(ResultSchema) },
        // Bei einer Ablehnung übernimmt serverseitig ein passendes Ersatzmodell
        ...(withFallback ? { betas: ['server-side-fallback-2026-07-01'], fallbacks: 'default' as const } : {}),
        system: [{ type: 'text', text: SYSTEM_PROMPT, cache_control: { type: 'ephemeral' } }],
        messages: [
          {
            role: 'user',
            content: buildUserMessage(content.kind, language, JSON.stringify(contentForAi(content), null, 1), command, jobPosting)
          }
        ]
      },
      { signal: controller.signal }
    )
    if (response.stop_reason === 'refusal') throw new AiError('AI_REFUSED')
    if (response.stop_reason === 'max_tokens') throw new AiError('AI_TOO_LONG')
    const parsed = response.parsed_output
    if (!parsed) throw new AiError('AI_FAILED')
    const usedFallback = (response.content ?? []).some((b) => (b as { type: string }).type === 'fallback')
    return { ...parsed, model: response.model, usedFallback }
  } catch (e) {
    throw mapError(e)
  } finally {
    if (inFlight === controller) inFlight = null
  }
}
