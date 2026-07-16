type UnauthorizedListener = () => void;

const unauthorizedListeners = new Set<UnauthorizedListener>();

export const authSessionEvents = {
  subscribeUnauthorized(listener: UnauthorizedListener) {
    unauthorizedListeners.add(listener);
    return () => {
      unauthorizedListeners.delete(listener);
    };
  },
  notifyUnauthorized() {
    for (const listener of unauthorizedListeners) {
      listener();
    }
  },
};
