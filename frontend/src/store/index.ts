import { create } from 'zustand'
import { devtools, persist } from 'zustand/middleware'
import type { AccountBalance } from '../types/stellar'
import type { PathQuote, QRSession, PaymentStatus } from '../types/payment'
import { getAccount } from '../config/api'

// ─── Account slice ──────────────────────────────────────────────────────────

interface AccountSlice {
  address: string | null
  balances: AccountBalance[]
  isLoading: boolean
  error: string | null
  setAddress: (address: string | null) => void
  setBalances: (balances: AccountBalance[]) => void
  fetchAccount: (address: string) => Promise<void>
  clearAccount: () => void
}

// ─── Payment slice ──────────────────────────────────────────────────────────

interface PaymentSlice {
  currentQuote: PathQuote | null
  currentSession: QRSession | null
  paymentStatus: PaymentStatus
  lastTxHash: string | null
  error: string | null
  setQuote: (quote: PathQuote | null) => void
  setSession: (session: QRSession | null) => void
  setStatus: (status: PaymentStatus) => void
  setLastTxHash: (hash: string | null) => void
  setError: (error: string | null) => void
  reset: () => void
}

// ─── Settings slice ─────────────────────────────────────────────────────────

interface SettingsSlice {
  network: 'testnet' | 'mainnet'
  secretKey: string | null
  setNetwork: (network: 'testnet' | 'mainnet') => void
  setSecretKey: (key: string | null) => void
}

// ─── Combined store ─────────────────────────────────────────────────────────

type StoreState = AccountSlice & PaymentSlice & SettingsSlice

export const useStore = create<StoreState>()(
  devtools(
    persist(
      (set, _get) => ({
        // ── Account slice ──
        address: null,
        balances: [],
        isLoading: false,
        error: null,

        setAddress: (address) => set({ address }, false, 'account/setAddress'),

        setBalances: (balances) => set({ balances }, false, 'account/setBalances'),

        fetchAccount: async (address: string) => {
          set({ isLoading: true, error: null }, false, 'account/fetchStart')
          try {
            const info = await getAccount(address)
            set(
              { balances: info.balances, isLoading: false },
              false,
              'account/fetchSuccess'
            )
          } catch (err) {
            const message = err instanceof Error ? err.message : 'Failed to fetch account'
            set({ error: message, isLoading: false }, false, 'account/fetchError')
          }
        },

        clearAccount: () =>
          set(
            { address: null, balances: [], error: null },
            false,
            'account/clear'
          ),

        // ── Payment slice ──
        currentQuote: null,
        currentSession: null,
        paymentStatus: 'idle',
        lastTxHash: null,

        setQuote: (quote) => set({ currentQuote: quote }, false, 'payment/setQuote'),

        setSession: (session) =>
          set({ currentSession: session }, false, 'payment/setSession'),

        setStatus: (status) =>
          set({ paymentStatus: status }, false, 'payment/setStatus'),

        setLastTxHash: (hash) =>
          set({ lastTxHash: hash }, false, 'payment/setTxHash'),

        setError: (error) => set({ error }, false, 'payment/setError'),

        reset: () =>
          set(
            {
              currentQuote: null,
              currentSession: null,
              paymentStatus: 'idle',
              lastTxHash: null,
              error: null
            },
            false,
            'payment/reset'
          ),

        // ── Settings slice ──
        network: 'testnet',
        secretKey: null,

        setNetwork: (network) => set({ network }, false, 'settings/setNetwork'),

        setSecretKey: (secretKey) =>
          set({ secretKey }, false, 'settings/setSecretKey')
      }),
      {
        name: 'centurion-store',
        partialize: (state) => ({
          address: state.address,
          network: state.network,
          // Never persist secret key to localStorage in production
          secretKey: state.secretKey
        })
      }
    ),
    { name: 'CenturionStore' }
  )
)

// ─── Typed selectors ────────────────────────────────────────────────────────

export const selectAddress = (s: StoreState) => s.address
export const selectBalances = (s: StoreState) => s.balances
export const selectIsLoading = (s: StoreState) => s.isLoading
export const selectCurrentQuote = (s: StoreState) => s.currentQuote
export const selectCurrentSession = (s: StoreState) => s.currentSession
export const selectPaymentStatus = (s: StoreState) => s.paymentStatus
export const selectNetwork = (s: StoreState) => s.network
export const selectError = (s: StoreState) => s.error
