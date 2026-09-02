import type { UserNotification } from "@moveall/contracts";

export interface PushSender {
  send(tokens: string[], notification: UserNotification): Promise<void>;
}

export class DisabledPushSender implements PushSender {
  async send(): Promise<void> {}
}

type ExpoPushMessage = {
  to: string;
  title: string;
  body: string;
  sound: "default";
  data: Record<string, string>;
};

export class ExpoPushSender implements PushSender {
  constructor(private readonly accessToken?: string) {}

  async send(tokens: string[], notification: UserNotification): Promise<void> {
    const uniqueTokens = [...new Set(tokens)];
    for (let offset = 0; offset < uniqueTokens.length; offset += 100) {
      const messages = uniqueTokens.slice(offset, offset + 100).map((token): ExpoPushMessage => ({
        to: token,
        title: notification.title,
        body: notification.body,
        sound: "default",
        data: {
          notificationId: notification.id,
          kind: notification.kind,
          ...(notification.resourceType ? { resourceType: notification.resourceType } : {}),
          ...(notification.resourceId ? { resourceId: notification.resourceId } : {}),
        },
      }));
      const response = await fetch("https://exp.host/--/api/v2/push/send", {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
          ...(this.accessToken ? { Authorization: `Bearer ${this.accessToken}` } : {}),
        },
        body: JSON.stringify(messages),
        signal: AbortSignal.timeout(10_000),
      });
      if (!response.ok) {
        throw new Error(`Expo push request failed with status ${response.status}`);
      }
    }
  }
}
