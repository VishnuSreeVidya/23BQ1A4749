const TYPE_COLORS = {
    placement: '#ef4444',
    result: '#3b82f6',
    event: '#10b981',
};

export default function NotificationCard({ notification, onMarkRead, removing }) {
    const typeKey = notification.type.toLowerCase();

    return (
        <section
            className={`card ${typeKey}${removing ? ' removing' : ''}`}
            data-id={notification.id}
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
                opacity: removing ? 0 : 1,
                transform: removing ? 'scale(0.95)' : 'none',
            }}
            onMouseEnter={e => {
                const shadowColor = TYPE_COLORS[typeKey] || '#64748b';
                e.currentTarget.style.boxShadow = `0 12px 24px -6px ${shadowColor}55`;
                e.currentTarget.style.transform = 'translateY(-3px)';
            }}
            onMouseLeave={e => {
                e.currentTarget.style.boxShadow = '0 10px 15px -3px rgba(0,0,0,0.3)';
                e.currentTarget.style.transform = 'none';
            }}
        >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span
                    className={`badge ${typeKey}`}
                    style={{
                        fontSize: '0.75rem',
                        fontWeight: 700,
                        letterSpacing: '0.05em',
                        textTransform: 'uppercase',
                        padding: '4px 12px',
                        borderRadius: 9999,
                        color: '#ffffff',
                        backgroundColor: TYPE_COLORS[typeKey],
                    }}
                >
                    {notification.type}
                </span>
                <span style={{ color: '#94a3b8', fontSize: '0.85rem' }}>
                    {new Date(notification.createdAt).toLocaleString()}
                </span>
            </div>

            <h2 style={{ fontSize: '1.3rem', fontWeight: 600, margin: 0 }}>
                {notification.title}
            </h2>

            <p style={{ color: '#cbd5e1', lineHeight: 1.6, margin: 0 }}>
                {notification.message}
            </p>

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 4 }}>
                <button
                    className="mark-read-btn"
                    data-id={notification.id}
                    disabled={removing}
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
                    onMouseEnter={e => {
                        e.currentTarget.style.borderColor = '#22c55e';
                        e.currentTarget.style.color = '#22c55e';
                        e.currentTarget.style.backgroundColor = 'rgba(34,197,94,0.1)';
                        e.currentTarget.style.filter = 'brightness(1.2)';
                    }}
                    onMouseLeave={e => {
                        e.currentTarget.style.borderColor = '#475569';
                        e.currentTarget.style.color = '#94a3b8';
                        e.currentTarget.style.backgroundColor = 'transparent';
                        e.currentTarget.style.filter = 'none';
                    }}
                    onMouseDown={e => {
                        e.currentTarget.style.transform = 'scale(0.96)';
                    }}
                    onMouseUp={e => {
                        e.currentTarget.style.transform = 'none';
                    }}
                >
                    ✓ Mark as Read
                </button>
            </div>
        </section>
    );
}
