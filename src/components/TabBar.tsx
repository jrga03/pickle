const tabs = ['Setup', 'Players', 'Matchups', 'Expenses'] as const
export type Tab = (typeof tabs)[number]

interface TabBarProps {
  activeTab: Tab
  onTabChange: (tab: Tab) => void
}

export function TabBar({ activeTab, onTabChange }: TabBarProps) {
  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 flex z-50">
      {tabs.map(tab => (
        <button
          key={tab}
          onClick={() => onTabChange(tab)}
          className={`flex-1 py-3 text-sm font-medium min-h-[48px] ${
            activeTab === tab
              ? 'text-green-600 border-t-2 border-green-600'
              : 'text-gray-500'
          }`}
        >
          {tab}
        </button>
      ))}
    </nav>
  )
}
