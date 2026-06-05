import { Router } from 'express';
import { wrapWithLogging } from '../middleware/logging.js';
import cache from '../services/cache.js';

const router = Router();

const MOCK_NOTIFICATIONS = [
    { id: "1", type: "Event", title: "Annual Tech Fest 2026", message: "Registrations open.", isRead: false, createdAt: "2026-06-05T08:00:00Z" },
    { id: "2", type: "Placement", title: "Amazon Off-Campus Drive", message: "SDE intern roles open.", isRead: false, createdAt: "2026-06-05T09:30:00Z" },
    { id: "3", type: "Result", title: "B.Tech III-I Results", message: "Semester results live.", isRead: false, createdAt: "2026-06-04T14:00:00Z" },
    { id: "4", type: "Placement", title: "TCS Ninja Hiring", message: "Pre-placement talks scheduled.", isRead: false, createdAt: "2026-06-05T06:15:00Z" },
    { id: "5", type: "Event", title: "Guest Lecture Blockchain", message: "Web3 architecture talk.", isRead: true, createdAt: "2026-06-03T10:00:00Z" },
    { id: "6", type: "Result", title: "Revaluation Notice", message: "Applications close weekend.", isRead: false, createdAt: "2026-06-05T09:00:00Z" },
    { id: "7", type: "Placement", title: "Google Step Internship", message: "Shortlists out.", isRead: false, createdAt: "2026-06-05T09:45:00Z" },
];

let notificationsStore = [...MOCK_NOTIFICATIONS];

router.get('/', wrapWithLogging(async (req, res) => {
    const { page = 1, limit = 20, notification_type, student_id = 'stu_123' } = req.query;
    const cacheKey = `notifications:${student_id}:${page}:${limit}:${notification_type || 'all'}`;

    const cached = await cache.get(cacheKey);
    if (cached) {
        return res.json({ success: true, data: cached.data, pagination: cached.pagination });
    }

    let filtered = [...notificationsStore];

    if (notification_type && notification_type !== 'all') {
        filtered = filtered.filter(n => n.type === notification_type);
    }

    const pageNum = parseInt(page, 10);
    const limitNum = parseInt(limit, 10);
    const totalItems = filtered.length;
    const totalPages = Math.ceil(totalItems / limitNum);
    const start = (pageNum - 1) * limitNum;
    const paginatedData = filtered.slice(start, start + limitNum);

    const response = {
        success: true,
        data: paginatedData.map(n => ({ ...n, student_id })),
        pagination: { page: pageNum, limit: limitNum, total_items: totalItems, total_pages: totalPages },
    };

    await cache.set(cacheKey, response);

    res.json(response);
}));

router.patch('/:id/read', wrapWithLogging(async (req, res) => {
    const { id } = req.params;
    const notification = notificationsStore.find(n => n.id === id);

    if (!notification) {
        return res.status(404).json({ success: false, error: 'Notification not found.' });
    }

    notification.isRead = true;

    await cache.invalidatePattern('notifications:*');

    res.json({ success: true, message: 'Notification marked as read.' });
}));

export default router;
