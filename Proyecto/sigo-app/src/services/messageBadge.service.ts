import { useState, useEffect } from 'react';

type Listener = (hasUnread: boolean) => void;

let _hasUnread = false;
const _listeners = new Set<Listener>();

export const messageBadgeStore = {
  get hasUnread(): boolean {
    return _hasUnread;
  },
  setUnread(val: boolean): void {
    if (_hasUnread !== val) {
      _hasUnread = val;
      _listeners.forEach((cb) => cb(_hasUnread));
    }
  },
  subscribe(cb: Listener): () => void {
    _listeners.add(cb);
    cb(_hasUnread);
    return () => {
      _listeners.delete(cb);
    };
  },
};

export function useMessageBadge() {
  const [hasUnread, setHasUnread] = useState(messageBadgeStore.hasUnread);

  useEffect(() => {
    return messageBadgeStore.subscribe(setHasUnread);
  }, []);

  return {
    hasUnread,
    setUnread: messageBadgeStore.setUnread,
  };
}
