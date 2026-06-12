import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { Provider } from 'react-redux'
import './index.css'
import App from './App'
import { store } from './store'
import { AuthProvider } from './context/AuthContext'
import { initSentry, isSentryEnabled, SentryErrorBoundary } from './utils/sentry'
import SentryFallback from './components/SentryFallback'

initSentry()

const app = (
  <StrictMode>
    <BrowserRouter>
      <Provider store={store}>
        <AuthProvider>
          <App />
        </AuthProvider>
      </Provider>
    </BrowserRouter>
  </StrictMode>
)

createRoot(document.getElementById('root')).render(
  isSentryEnabled() ? (
    <SentryErrorBoundary fallback={<SentryFallback />}>{app}</SentryErrorBoundary>
  ) : (
    app
  ),
)
