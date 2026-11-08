'use client';

import { useClubAdmins } from '@/lib/data/queries';

/** "Admins: X, Y", so people know whom to ask for the club code. Works signed out. */
export function AdminsHint() {
  const admins = useClubAdmins();
  if (!admins.data?.length) return null;
  return (
    <span>
      {admins.data.length === 1 ? 'Admin koła' : 'Admini koła'}: <span className="text-zinc-200">{admins.data.join(', ')}</span>.
    </span>
  );
}
