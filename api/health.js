export default function handler(req, res) {
  res.status(200).json({ ok: true, service: 'Biroba Sheets Sync API', timestamp: new Date().toISOString() });
}
