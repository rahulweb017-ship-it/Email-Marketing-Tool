import PlatformIcon from './PlatformIcon';

interface Account {
  id: string;
  platform: string;
  account_name: string;
  account_avatar_url?: string;
  is_active: boolean;
}

interface AccountSelectorProps {
  accounts: Account[];
  selectedIds: string[];
  onChange: (ids: string[]) => void;
}

export default function AccountSelector({ accounts, selectedIds, onChange }: AccountSelectorProps) {
  const toggle = (id: string) => {
    if (selectedIds.includes(id)) {
      onChange(selectedIds.filter(i => i !== id));
    } else {
      onChange([...selectedIds, id]);
    }
  };

  const activeAccounts = accounts.filter(a => a.is_active);

  if (activeAccounts.length === 0) {
    return (
      <div className="text-sm text-gray-500 dark:text-gray-400 py-3">
        No connected accounts. Connect an account first.
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
        Post to accounts
      </label>
      <div className="space-y-1.5">
        {activeAccounts.map(account => (
          <label
            key={account.id}
            className={`flex items-center gap-3 p-2.5 rounded-lg border cursor-pointer transition-all ${
              selectedIds.includes(account.id)
                ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20 dark:border-primary-600'
                : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
            }`}
          >
            <input
              type="checkbox"
              checked={selectedIds.includes(account.id)}
              onChange={() => toggle(account.id)}
              className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
            />
            {account.account_avatar_url ? (
              <img src={account.account_avatar_url} alt="" className="w-8 h-8 rounded-full" />
            ) : (
              <div className="w-8 h-8 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center">
                <PlatformIcon platform={account.platform} size={16} />
              </div>
            )}
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                {account.account_name}
              </div>
            </div>
            <PlatformIcon platform={account.platform} size={16} />
          </label>
        ))}
      </div>
    </div>
  );
}
