/**
 * @license
 * Copyright 2025 BrowserOS
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

import {
  UIMessageStreamEventSchema,
  type UIMessageStreamEvent,
} from '@browseros/shared/schemas/ui-stream'
import { createParser, type EventSourceMessage } from 'eventsource-parser'
import { logger } from '../../lib/logger'

async function observeUIMessageStream(
  stream: ReadableStream<Uint8Array>,
  onEvent: (event: UIMessageStreamEvent) => Promise<void>,
): Promise<void> {
  const reader = stream.getReader()
  const decoder = new TextDecoder()
  const pendingEvents: UIMessageStreamEvent[] = []

  const parser = createParser({
    onEvent: (msg: EventSourceMessage) => {
      if (msg.data === '[DONE]') return

      try {
        const json = JSON.parse(msg.data) as unknown
        const result = UIMessageStreamEventSchema.safeParse(json)
        if (!result.success) return
        pendingEvents.push(result.data)
      } catch {
        // Ignore malformed event payloads while preserving the client stream.
      }
    },
  })

  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      parser.feed(decoder.decode(value, { stream: true }))

      let event = pendingEvents.shift()
      while (event) {
        await onEvent(event)
        event = pendingEvents.shift()
      }
    }

    parser.feed(decoder.decode())

    let event = pendingEvents.shift()
    while (event) {
      await onEvent(event)
      event = pendingEvents.shift()
    }
  } finally {
    reader.releaseLock()
  }
}

export function tapUIMessageStreamResponse(
  response: Response,
  onEvent: (event: UIMessageStreamEvent) => Promise<void>,
): Response {
  if (!response.body) return response

  const [clientStream, observerStream] = response.body.tee()
  void observeUIMessageStream(observerStream, onEvent).catch((error) => {
    logger.warn('Failed to observe UI message stream', {
      error: error instanceof Error ? error.message : String(error),
    })
  })

  return new Response(clientStream, {
    status: response.status,
    statusText: response.statusText,
    headers: new Headers(response.headers),
  })
}
