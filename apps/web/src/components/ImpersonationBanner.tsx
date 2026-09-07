import { useAuthStore } from '../stores/auth.store';
import { ArrowLeft } from 'lucide-react';

export default function ImpersonationBanner() {
  const { isImpersonating, user, stopImpersonation } = useAuthStore();

  if (!isImpersonating) return null;

  return (
    <div className="bg-amber-500 text-black px-4 py-2 flex items-center justify-between text-sm font-medium">
      <span>
        Viewing as <strong>{user?.name}</strong> ({user?.email}) &mdash; Organization: {user?.org_name || user?.org_id}
      </span>
      <button
        onClick={stopImpersonation}
        className="flex items-center gap-1.5 px-3 py-1 bg-black/20 hover:bg-black/30 rounded text-sm transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        Return to Admin
      </button>
    </div>
  );
}
