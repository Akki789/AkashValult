let cachedApp = null;

export default async function handler(req, res) {
  try {
    const [{ connectDB }, { createApp }] = await Promise.all([
      import('../src/config/db.js'),
      import('../src/app.js'),
    ]);

    if (!cachedApp) {
      cachedApp = createApp();
    }

    const pathname = (req.url || '/').split('?')[0];
    if (pathname === '/' || pathname === '/api/health') {
      return cachedApp(req, res);
    }

    await connectDB();
    return cachedApp(req, res);
  } catch (error) {
    console.error('Vercel function error:', error);
    const safeMessage = String(error?.message || 'Server initialization failed.').replace(
      /\/\/[^@]+@/g,
      '//***:***@'
    );
    return res.status(500).json({
      success: false,
      error: {
        code: 'SERVER_INIT_ERROR',
        message: safeMessage,
      },
    });
  }
}
