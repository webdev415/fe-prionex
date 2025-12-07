/**
 * ImpersonationBanner Component
 *
 * Sticky banner displayed at the top of the page when an admin
 * is impersonating another user.
 */

export interface ImpersonationBannerProps {
  isImpersonating: boolean
  impersonatedUser: {
    id: string
    username: string
    email?: string
    firstName?: string
    lastName?: string
  } | null
  onExitImpersonation: () => void
  isLoading: boolean
}

export function ImpersonationBanner({
  isImpersonating,
  impersonatedUser,
  onExitImpersonation,
  isLoading,
}: ImpersonationBannerProps) {
  if (!isImpersonating || !impersonatedUser) {
    return null
  }

  const displayName =
    impersonatedUser.firstName && impersonatedUser.lastName
      ? `${impersonatedUser.firstName} ${impersonatedUser.lastName}`
      : impersonatedUser.username

  return (
    <div role="banner" className="sticky top-0 z-50 bg-blue-600 px-4 py-3 text-white shadow-lg">
      <div className="container mx-auto flex items-center justify-between">
        <div className="flex items-center gap-3">
          {/* Info icon */}
          <svg
            className="h-5 w-5"
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 20 20"
            fill="currentColor"
          >
            <path
              fillRule="evenodd"
              d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a.75.75 0 000 1.5h.253a.25.25 0 01.244.304l-.459 2.066A1.75 1.75 0 0010.747 15H11a.75.75 0 000-1.5h-.253a.25.25 0 01-.244-.304l.459-2.066A1.75 1.75 0 009.253 9H9z"
              clipRule="evenodd"
            />
          </svg>

          {/* Message */}
          <div className="flex items-center gap-2">
            <span className="font-medium">Viewing as</span>
            <span className="font-bold">{impersonatedUser.username}</span>
            {impersonatedUser.firstName && impersonatedUser.lastName && (
              <span className="text-blue-100">({displayName})</span>
            )}
          </div>
        </div>

        {/* Exit button */}
        <button
          onClick={onExitImpersonation}
          disabled={isLoading}
          className="inline-flex items-center gap-2 rounded-md bg-white px-4 py-2 font-medium text-blue-600 transition-colors hover:bg-blue-50 focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-blue-600 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50"
          aria-label="Exit view and return to admin account"
        >
          {isLoading ? (
            <>
              <svg
                className="h-4 w-4 animate-spin"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                />
              </svg>
              <span>Exiting...</span>
            </>
          ) : (
            <>
              {/* Exit icon */}
              <svg
                className="h-4 w-4"
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 20 20"
                fill="currentColor"
              >
                <path
                  fillRule="evenodd"
                  d="M3 4.25A2.25 2.25 0 015.25 2h5.5A2.25 2.25 0 0113 4.25v2a.75.75 0 01-1.5 0v-2a.75.75 0 00-.75-.75h-5.5a.75.75 0 00-.75.75v11.5c0 .414.336.75.75.75h5.5a.75.75 0 00.75-.75v-2a.75.75 0 011.5 0v2A2.25 2.25 0 0110.75 18h-5.5A2.25 2.25 0 013 15.75V4.25z"
                  clipRule="evenodd"
                />
                <path
                  fillRule="evenodd"
                  d="M19 10a.75.75 0 00-.75-.75H8.704l1.048-.943a.75.75 0 10-1.004-1.114l-2.5 2.25a.75.75 0 000 1.114l2.5 2.25a.75.75 0 101.004-1.114l-1.048-.943h9.546A.75.75 0 0019 10z"
                  clipRule="evenodd"
                />
              </svg>
              <span>Exit View</span>
            </>
          )}
        </button>
      </div>
    </div>
  )
}
