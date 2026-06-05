import Head from 'next/head';
import PriorityInbox from '../components/PriorityInbox';

export default function Home() {
    return (
        <>
            <Head>
                <title>Campus Priority Inbox</title>
                <meta name="viewport" content="width=device-width, initial-scale=1.0" />
            </Head>
            <div style={{
                fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
                backgroundColor: '#0f172a',
                color: '#f8fafc',
                minHeight: '100vh',
                padding: '40px 20px',
            }}>
                <PriorityInbox />
            </div>
        </>
    );
}
