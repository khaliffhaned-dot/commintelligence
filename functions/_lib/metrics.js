// Cloudflare Analytics Engine: custom time-series metrics. Never allowed to break a request.
// Each data point: blobs = [event, ...labels], doubles = [numbers...], indexes = [organisation or 'system'].
export function track(env, event, labels = [], numbers = [], index = 'system') {
    try {
        if (env.METRICS) env.METRICS.writeDataPoint({ blobs: [event, ...labels.map(String)], doubles: numbers.map(Number), indexes: [String(index).slice(0, 96)] });
    } catch (e) {
        console.warn('metrics skipped', e && e.message);
    }
}
