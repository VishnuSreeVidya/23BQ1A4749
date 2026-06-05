export default function LiveBeacon() {
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
            aria-label="Live connection active"
        />
    );
}
