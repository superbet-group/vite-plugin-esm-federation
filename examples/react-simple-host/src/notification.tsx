import { useSyncExternalStore } from "react";

export type NotificationProps = {
  message: string;
  type: "success" | "error";
  onDismiss: () => void;
};

type NotificationConfig = NotificationProps & {
  id: string;
};

const createNotificationManager = () => {
  const notificationStore = {
    notifications: [],
  };

  const subscribers = new Set<() => void>();

  const subscribe = (callback: () => void) => {
    subscribers.add(callback);
    return () => {
      subscribers.delete(callback);
    };
  };

  const add = (notification: NotificationProps) => {
    const id = Math.random().toString(36).substring(2, 9);
    notificationStore.notifications.push({
      ...notification,
      id,
    });

    return () => {
      removeNotification(id);
    };
  };

  const removeNotification = (id: string) => {
    notificationStore.notifications = notificationStore.notifications.filter(
      (notification) => notification.id !== id
    );
  };

  const NotificationManager = () => {
    const store = useSyncExternalStore(subscribe, () => notificationStore);

    return (
      <div>
        {store.notifications.map((notification) => (
          <div key={notification.id}>
            {notification.message}
            <button onClick={() => notification.onDismiss()}>Dismiss</button>
          </div>
        ))}
      </div>
    );
  };

  return [
    NotificationManager,
    {
      add,
    },
  ] as const;
};

const [NotificationManager, notificationManager] = createNotificationManager();

const Example = () => {
  return (
    <>
      <NotificationManager />
      <button
        onClick={() => {
          const remove = notificationManager.add({
            message: "Hello World",
            type: "success",
            onDismiss: () => {
              remove();
            },
          });
        }}
      >
        Add Notification
      </button>
    </>
  );
};
