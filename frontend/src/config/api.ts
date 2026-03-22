import axios, { AxiosError, AxiosResponse } from 'axios'
import type { AccountInfo } from '../types/stellar'
import type { PathQuote, Payment, QRSession } from '../types/payment'

const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api'

export const apiClient = axios.create({
  baseURL: BASE_URL,
  timeout: 15000,
  headers: {
    'Content-Type': 'application/json',
    Accept: 'application/json'
  }
})

// Response interceptor for error normalization
apiClient.interceptors.response.use(
  (response: AxiosResponse) => response,
  (error: AxiosError) => {
    const message =
      (error.response?.data as { message?: string })?.message ||
      error.message ||
      'An unexpected error occurred'
    return Promise.reject(new Error(message))
  }
)

// Request interceptor: attach auth token if present
apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem('centurion_auth_token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

// ─── Typed API functions ────────────────────────────────────────────────────

export async function getAccount(address: string): Promise<AccountInfo> {
  const res = await apiClient.get<AccountInfo>(`/account/${address}`)
  return res.data
}

export interface QuoteRequest {
  sendAsset: string
  destAsset: string
  destAmount: string
  senderAddress: string
}

export async function getQuote(params: QuoteRequest): Promise<PathQuote> {
  const res = await apiClient.post<PathQuote>('/payments/quote', params)
  return res.data
}

export interface BuildPaymentRequest {
  quote: PathQuote
  senderAddress: string
  merchantAddress: string
}

export interface BuildPaymentResponse {
  paymentId: string
  unsignedXdr: string
}

export async function buildPayment(
  params: BuildPaymentRequest
): Promise<BuildPaymentResponse> {
  const res = await apiClient.post<BuildPaymentResponse>('/payments/build', params)
  return res.data
}

export interface SubmitPaymentRequest {
  paymentId: string
  signedXdr: string
}

export async function submitPayment(params: SubmitPaymentRequest): Promise<Payment> {
  const res = await apiClient.post<Payment>('/payments/submit', params)
  return res.data
}

export interface CreateQRRequest {
  merchantAddress: string
  amountMxn: string
}

export async function createQRSession(params: CreateQRRequest): Promise<QRSession> {
  const res = await apiClient.post<QRSession>('/payments/qr', params)
  return res.data
}

export async function getQRStatus(token: string): Promise<QRSession> {
  const res = await apiClient.get<QRSession>(`/payments/qr/${token}`)
  return res.data
}

export interface RateResponse {
  asset: string
  rateMxn: string
  change24h: string
  updatedAt: string
}

export async function getRates(): Promise<RateResponse[]> {
  const res = await apiClient.get<RateResponse[]>('/rates')
  return res.data
}

export async function getPayment(id: string): Promise<Payment> {
  const res = await apiClient.get<Payment>(`/payments/${id}`)
  return res.data
}

export async function getRecentPayments(
  address: string,
  limit = 10
): Promise<Payment[]> {
  const res = await apiClient.get<Payment[]>(`/payments/history/${address}`, {
    params: { limit }
  })
  return res.data
}
