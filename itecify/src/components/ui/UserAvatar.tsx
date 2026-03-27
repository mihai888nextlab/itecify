import React from 'react';

interface UserAvatarProps {
  name: string;
  color: string;
  size?: 'sm' | 'md' | 'lg';
  showLabel?: boolean;
  isAI?: boolean;
}

export function UserAvatar({ name, color, size = 'md', showLabel = false, isAI = false }: UserAvatarProps) {
  const sizes = {
    sm: 'w-6 h-6 text-xs',
    md: 'w-8 h-8 text-sm',
    lg: 'w-10 h-10 text-base',
  };

  const initials = name
    .split(' ')
    .map(n => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  return (
    <div className="relative group">
      <div
        className={`${sizes[size]} rounded-full flex items-center justify-center font-semibold text-white border-2 border-[#020617]`}
        style={{ backgroundColor: color }}
      >
        {isAI ? (
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
            <path d="M12 2a2 2 0 012 2c0 .74-.4 1.39-1 1.73V7h1a7 7 0 017 7h1a1 1 0 011 1v3a1 1 0 01-1 1h-1v1a2 2 0 01-2 2H5a2 2 0 01-2-2v-1H2a1 1 0 01-1-1v-3a1 1 0 011-1h1a7 7 0 017-7h1V5.73c-.6-.34-1-.99-1-1.73a2 2 0 012-2M7.5 13a1.5 1.5 0 100 3 1.5 1.5 0 000-3m9 0a1.5 1.5 0 100 3 1.5 1.5 0 000-3m-4.5 6a4.5 4.5 0 100 9 4.5 4.5 0 000-9" />
          </svg>
        ) : (
          initials
        )}
      </div>
      {showLabel && (
        <div
          className="absolute top-full left-1/2 -translate-x-1/2 mt-1 px-2 py-0.5 rounded text-[10px] font-mono whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none"
          style={{ backgroundColor: color }}
        >
          {name}
        </div>
      )}
    </div>
  );
}

interface UserAvatarsGroupProps {
  users: Array<{ name: string; color: string; role: 'human' | 'ai' }>;
  maxVisible?: number;
}

export function UserAvatarsGroup({ users, maxVisible = 5 }: UserAvatarsGroupProps) {
  const visible = users.slice(0, maxVisible);
  const overflow = users.length - maxVisible;

  return (
    <div className="flex items-center -space-x-2">
      {visible.map((user, index) => (
        <UserAvatar
          key={index}
          name={user.name}
          color={user.color}
          size="sm"
          showLabel
          isAI={user.role === 'ai'}
        />
      ))}
      {overflow > 0 && (
        <div className="w-6 h-6 rounded-full bg-slate-700 flex items-center justify-center text-xs text-slate-300 border-2 border-[#020617]">
          +{overflow}
        </div>
      )}
    </div>
  );
}
