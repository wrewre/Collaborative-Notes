const API_BASE = import.meta.env.VITE_API_URL || '/api'

class ApiClient {
  private getHeaders(): Record<string, string> {
    const token = localStorage.getItem('access_token')
    return {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    }
  }

  private async request<T>(path: string, init?: RequestInit): Promise<T> {
    const res = await fetch(`${API_BASE}${path}`, {
      ...init,
      headers: { ...this.getHeaders(), ...(init?.headers || {}) },
      credentials: 'include',
    })

    if (res.status === 401) {
      // Try to refresh
      const refreshed = await this.refresh()
      if (refreshed) {
        // Retry original request
        return this.request<T>(path, init)
      }
      // Force logout
      localStorage.removeItem('access_token')
      window.location.href = '/login'
      throw new Error('Unauthorized')
    }

    if (!res.ok) {
      const error = await res.json().catch(() => ({ message: res.statusText }))
      throw new Error(error.message || 'Request failed')
    }

    if (res.status === 204) return undefined as T
    return res.json() as Promise<T>
  }

  private async refresh(): Promise<boolean> {
    try {
      const res = await fetch(`${API_BASE}/auth/refresh`, {
        method: 'POST',
        credentials: 'include',
      })
      if (!res.ok) return false
      const data = await res.json()
      localStorage.setItem('access_token', data.accessToken)
      return true
    } catch {
      return false
    }
  }

  get<T>(path: string) { return this.request<T>(path) }
  post<T>(path: string, body?: unknown) {
    return this.request<T>(path, { method: 'POST', body: body ? JSON.stringify(body) : undefined })
  }
  patch<T>(path: string, body?: unknown) {
    return this.request<T>(path, { method: 'PATCH', body: body ? JSON.stringify(body) : undefined })
  }
  delete<T>(path: string) { return this.request<T>(path, { method: 'DELETE' }) }
}

export const api = new ApiClient()
