const PRIORITY_WEIGHTS = {
    Placement: 3,
    Result: 2,
    Event: 1,
};

export function getPriorityWeight(category) {
    return PRIORITY_WEIGHTS[category] || 0;
}

export function processNotifications(notifications) {
    return notifications
        .filter(item => item.isRead === false)
        .sort((a, b) => {
            const weightDiff = getPriorityWeight(b.type) - getPriorityWeight(a.type);
            if (weightDiff !== 0) return weightDiff;
            return new Date(b.createdAt) - new Date(a.createdAt);
        })
        .slice(0, 10);
}
