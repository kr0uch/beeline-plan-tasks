import { API_BASE_URL } from '@/shared/config'

export class HttpError extends Error {
  readonly status: number

  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

const STATUS_MESSAGES: Record<number, string> = {
  400: 'некорректный запрос',
  500: 'внутренняя ошибка сервера',
  502: 'сервис планирования недоступен',
  503: 'сервис временно недоступен',
  504: 'сервис не ответил вовремя',
}

export async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE_URL}${path}`, init)
  if (!res.ok) {
    let message = STATUS_MESSAGES[res.status] ?? `HTTP ${res.status}`
    const body = (await res.json().catch(() => null)) as { error?: string } | null
    if (body?.error) message = body.error
    throw new HttpError(res.status, message)
  }
  return (await res.json()) as T
}
