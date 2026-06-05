'use client';

import { useState, useEffect, useCallback } from 'react';
import NotificationCard from './NotificationCard';
import LiveBeacon from './LiveBeacon';
import { processNotifications } from '../lib/priorityEngine';
import LoggingMiddleware from '../../logging-middleware.js';

const PATCH_BASE = '/api/v1/notifications';
const TARGET_ENDPOINT = process.env.NEXT_PUBLIC_API_URL || '/api/v1/notifications';

const BACKUP_DATA = [
    { id: "1", type: "Event", title: "Annual Tech Fest 2026", message: "Registrations are open for hackathons and coding tournaments.", isRead: false, createdAt: "2026-06-05T08:00:00Z" },
    { id: "2", type: "Placement", title: "Amazon Off-Campus Drive", message: "SDE intern roles for third-year students.", isRead: false, createdAt: "2026-06-05T09:30:00Z" },
    { id: "3", type: "Result", title: "B.Tech III-I Regular Results", message: "Semester results are live on the evaluation server portal.", isRead: false, createdAt: "2026-06-04T14:00:00Z" },
    { id: "4", type: "Placement", title: "TCS Ninja Mass Hiring", message: "Pre-placement talks schedule dispatched.", isRead: false, createdAt: "2026-06-05T06:15:00Z" },
    { id: "5", type: "Event", title: "Guest Lecture on Blockchain", message: "Join us at the seminar hall.", isRead: true, createdAt: "2026-06-03T10:00:00Z" },
    { id: "6", type: "Result", title: "Revaluation Notification", message: "Applications close this weekend.", isRead: false, createdAt: "2026-06-05T09:00:00Z" },
    { id: "7", type: "Placement", title: "Google Step Internship", message: "Coding challenge shortlists are out.", isRead: false, createdAt: "2026-06-05T09:45:00Z" },
];

const logMiddleware = new LoggingMiddleware();

async function fetchWithLogging(url, options = {}) {
    const wrapped = logMiddleware.wrap(
        async () => {
            const res = await fetch(url, options);
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            return res.json();
        },
        { method: options.method || 'GET', url }
    );
    return wrapped();
}

export default function PriorityInbox() {
    const [notifications, setNotifications] = useState([]);
    const [loading, setLoading] = useState(true);
    const [removingIds, setRemovingIds] = useState(new Set());

    const visibleNotifications = processNotifications(notifications);

    useEffect(() => {
        async function load() {
            try {
                const data = await fetchWithLogging(TARGET_ENDPOINT);
                setNotifications(Array.isArray(data) ? data : data.data || []);
            } catch {
                console.warn('API unavailable, using backup data');
                setNotifications(BACKUP_DATA);
            } finally {
                setLoading(false);
            }
        }
        load();
    }, []);

    const handleMarkRead = useCallback(async (notificationId) => {
        setRemovingIds(prev => new Set(prev).add(notificationId));

        try {
            await fetchWithLogging(`${PATCH_BASE}/${notificationId}/read`, {
                method: 'PATCH',
                headers: {
                    'Authorization': 'Bearer <JWT_ACCESS_TOKEN>',
                    'Content-Type': 'application/json',
                },
            });
        } catch (err) {
            console.error('PATCH failed, applying optimistically.');
        }

        setTimeout(() => {
            setNotifications(prev =>
                prev.map(n => n.id === notificationId ? { ...n, isRead: true } : n)
            );
            setRemovingIds(prev => {
                const next = new Set(prev);
                next.delete(notificationId);
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
                <p style={{
                    color: '#94a3b8', fontSize: '1.05rem', margin: 0,
                    display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                }}>
                    <LiveBeacon />
                    Live updates filtered to show top 10 relevant unread notices.
                </p>
            </header>

            <main style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                {visibleNotifications.length === 0 ? (
                    <div style={{ textAlign: 'center', fontSize: '1.15rem', color: '#94a3b8', padding: '50px 0' }}>
                        Your priority inbox is completely clear!
                    </div>
                ) : (
                    visibleNotifications.map(n => (
                        <NotificationCard
                            key={n.id}
                            notification={n}
                            onMarkRead={handleMarkRead}
                            removing={removingIds.has(n.id)}
                        />
                    ))
                )}
            </main>
        </div>
    );
}
