interface TabBarProps<T extends string> {
  tabs: readonly T[]
  activeTab: T
  onTabChange: (tab: T) => void
}

export function TabBar<T extends string>({ tabs, activeTab, onTabChange }: TabBarProps<T>) {
  return (
    <nav
      className="fixed bottom-0 left-0 right-0 bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-gray-700 flex z-50"
      style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
    >
      {tabs.map(tab => (
        <button
          key={tab}
          onClick={() => onTabChange(tab)}
          className={`flex-1 py-3 text-sm font-medium min-h-[48px] ${
            activeTab === tab
              ? 'text-green-600 dark:text-green-400 border-t-2 border-green-600 dark:border-green-700'
              : 'text-gray-500 dark:text-gray-400'
          }`}
        >
          {tab}
        </button>
      ))}
    </nav>
  )
}
