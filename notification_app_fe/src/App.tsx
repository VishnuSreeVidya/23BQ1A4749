import { useState, useEffect, useCallback } from 'react';
import { Notification, processNotifications } from './utils/prioritySort';

const API_BASE = '/api/v1/notifications';

const FALLBACK_DATA: Notification[] = [
    { id: '1', type: 'Event', title: 'Annual Tech Fest 2026', message: 'Registrations open for hackathons.', isRead: false, createdAt: '2026-06-05T08:00:00Z' },
    { id: '2', type: 'Placement', title: 'Amazon Off-Campus Drive', message: 'SDE intern roles for third-year students.', isRead: false, createdAt: '2026-06-05T09:30:00Z' },
    { id: '3', type: 'Result', title: 'B.Tech III-I Results', message: 'Semester results live on the portal.', isRead: false, createdAt: '2026-06-04T14:00:00Z' },
    { id: '4', type: 'Placement', title: 'TCS Ninja Mass Hiring', message: 'Pre-placement talks scheduled.', isRead: false, createdAt: '2026-06-05T06:15:00Z' },
    { id: '5', type: 'Event', title: 'Guest Lecture Blockchain', message: 'Web3 architecture trends seminar.', isRead: true, createdAt: '2026-06-03T10:00:00Z' },
    { id: '6', type: 'Result', title: 'Revaluation Notice', message: 'Applications close this weekend.', isRead: false, createdAt: '2026-06-05T09:00:00Z' },
    { id: '7', type: 'Placement', title: 'Google Step Internship', message: 'Coding challenge shortlists out.', isRead: false, createdAt: '2026-06-05T09:45:00Z' },
];

const TYPE_COLORS: Record<string, string> = {
    placement: '#ef4444',
    result: '#3b82f6',
    event: '#10b981',
};

function LiveBeacon() {
    return (
        <span
            style={{
                display: 'inline-block',
                width: 8,
                height: 8,
                borderRadius: '50%',
                backgroundColor: '#22c55e',
                animation: 'pulse-beacon 2s ease-in-out infinite',
                flexShrink: 0,
            }}
        />
    );
}

function NotificationCard({
    notification,
    onMarkRead,
    isRemoving,
}: {
    notification: Notification;
    onMarkRead: (id: string) => void;
    isRemoving: boolean;
}) {
    const typeKey = notification.type.toLowerCase();

    return (
        <section
            className={`card ${typeKey}${isRemoving ? ' removing' : ''}`}
            style={{
                backgroundColor: '#1e293b',
                borderRadius: 12,
                padding: 24,
                borderLeft: `6px solid ${TYPE_COLORS[typeKey] || '#64748b'}`,
                boxShadow: '0 10px 15px -3px rgba(0,0,0,0.3)',
                display: 'flex',
                flexDirection: 'column',
                gap: 10,
                transition: 'transform 0.25s ease, box-shadow 0.25s ease, opacity 0.3s ease',
                opacity: isRemoving ? 0 : 1,
                transform: isRemoving ? 'scale(0.95)' : 'none',
            }}
        >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span
                    style={{
                        fontSize: '0.75rem',
                        fontWeight: 700,
                        letterSpacing: '0.05em',
                        textTransform: 'uppercase',
                        padding: '4px 12px',
                        borderRadius: 9999,
                        color: '#fff',
                        backgroundColor: TYPE_COLORS[typeKey],
                    }}
                >
                    {notification.type}
                </span>
                <span style={{ color: '#94a3b8', fontSize: '0.85rem' }}>
                    {new Date(notification.createdAt).toLocaleString()}
                </span>
            </div>
            <h2 style={{ fontSize: '1.3rem', fontWeight: 600, margin: 0 }}>{notification.title}</h2>
            <p style={{ color: '#cbd5e1', lineHeight: 1.6, margin: 0 }}>{notification.message}</p>
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 4 }}>
                <button
                    disabled={isRemoving}
                    onClick={() => onMarkRead(notification.id)}
                    style={{
                        background: 'none',
                        border: '1px solid #475569',
                        color: '#94a3b8',
                        fontSize: '0.8rem',
                        fontWeight: 600,
                        padding: '6px 16px',
                        borderRadius: 6,
                        cursor: 'pointer',
                        transition: 'all 0.2s ease',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 6,
                    }}
                >
                    ✓ Mark as Read
                </button>
            </div>
        </section>
    );
}

export default function App() {
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [loading, setLoading] = useState(true);
    const [removingIds, setRemovingIds] = useState<Set<string>>(new Set());

    const visible = processNotifications(notifications);

    useEffect(() => {
        (async () => {
            try {
                const res = await fetch(API_BASE);
                if (!res.ok) throw new Error('Network error');
                const json = await res.json();
                setNotifications(Array.isArray(json) ? json : json.data ?? []);
            } catch {
                console.warn('API unavailable, using fallback data');
                setNotifications(FALLBACK_DATA);
            } finally {
                setLoading(false);
            }
        })();
    }, []);

    const handleMarkRead = useCallback(async (id: string) => {
        setRemovingIds(prev => new Set(prev).add(id));

        try {
            await fetch(`${API_BASE}/${id}/read`, { method: 'PATCH' });
        } catch {
            console.warn('PATCH failed, applying optimistically');
        }

        setTimeout(() => {
            setNotifications(prev => prev.map(n => (n.id === id ? { ...n, isRead: true } : n)));
            setRemovingIds(prev => {
                const next = new Set(prev);
                next.delete(id);
                return next;
            });
        }, 300);
    }, []);

    if (loading) {
        return (
            <div style={{ textAlign: 'center', fontSize: '1.15rem', color: '#94a3b8', padding: '50px 0' }}>
                Connecting to real-time notification node...
            </div>
        );
    }

    return (
        <div style={{ maxWidth: 750, width: '100%', margin: '0 auto' }}>
            <header style={{ textAlign: 'center', marginBottom: 35 }}>
                <h1 style={{ fontSize: '2.25rem', fontWeight: 700, letterSpacing: '-0.025em', marginBottom: 8 }}>
                    Student Priority Inbox
                </h1>
                <p style={{ color: '#94a3b8', fontSize: '1.05rem', margin: 0, display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                    <LiveBeacon />
                    Live updates filtered to show top 10 relevant unread notices.
                </p>
            </header>
            <main style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                {visible.length === 0 ? (
                    <div style={{ textAlign: 'center', fontSize: '1.15rem', color: '#94a3b8', padding: '50px 0' }}>
                        Your priority inbox is completely clear!
                    </div>
                ) : (
                    visible.map(n => (
                        <NotificationCard
                            key={n.id}
                            notification={n}
                            onMarkRead={handleMarkRead}
                            isRemoving={removingIds.has(n.id)}
                        />
                    ))
                )}
            </main>
        </div>
    );
}
