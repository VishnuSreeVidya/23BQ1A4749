export interface Notification {
    id: string;
    type: 'Placement' | 'Result' | 'Event';
    title: string;
    message: string;
    isRead: boolean;
    createdAt: string;
}

const PRIORITY_WEIGHTS: Record<Notification['type'], number> = {
    Placement: 3,
    Result: 2,
    Event: 1,
};

export function getPriorityWeight(type: Notification['type']): number {
    return PRIORITY_WEIGHTS[type] ?? 0;
}

export function processNotifications(notifications: Notification[]): Notification[] {
    return notifications
        .filter(n => !n.isRead)
        .sort((a, b) => {
            const weightDiff = getPriorityWeight(b.type) - getPriorityWeight(a.type);
            if (weightDiff !== 0) return weightDiff;
            return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        })
        .slice(0, 10);
}
