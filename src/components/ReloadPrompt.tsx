import { useRegisterSW } from 'virtual:pwa-register/react'

export function ReloadPrompt() {
  const {
    needRefresh: [needRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(_swUrl, registration) {
      registration && setInterval(async () => {
        try {
          if (registration.installing || !navigator)
            return
          if ('connection' in navigator && !navigator.onLine)
            return

          const resp = await fetch(_swUrl, {
            cache: 'no-store',
            headers: {
              'cache': 'no-store',
              'cache-control': 'no-cache',
            },
          })

          if (resp?.status === 200)
            await registration.update()
        } catch {
          // Will retry on next interval
        }
      }, 15 * 60 * 1000)
    },
  })

  if (!needRefresh) return null

  return (
    <div className="fixed bottom-20 left-4 right-4 z-50 animate-slide-up">
      <div className="mx-auto max-w-md rounded-lg bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 shadow-lg p-4 flex items-center justify-between gap-3">
        <span className="text-sm text-gray-700 dark:text-gray-200">
          A new version is available
        </span>
        <button
          onClick={() => updateServiceWorker(true)}
          className="shrink-0 rounded-lg bg-green-600 dark:bg-green-700 px-4 py-2 text-sm font-medium text-white"
        >
          Update
        </button>
      </div>
    </div>
  )
}
