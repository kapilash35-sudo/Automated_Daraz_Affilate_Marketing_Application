import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(req: NextRequest) {
  const basicAuth = req.headers.get('authorization');

  if (basicAuth) {
    try {
      const authValue = basicAuth.split(' ')[1];
      if (authValue) {
        const decoded = typeof atob === 'function' 
          ? atob(authValue) 
          : Buffer.from(authValue, 'base64').toString('utf-8');
        const [user, ...pwdParts] = decoded.split(':');
        const pwd = pwdParts.join(':');

        const expectedUser = process.env.DASHBOARD_USERNAME || 'admin';
        const expectedPassword = process.env.DASHBOARD_PASSWORD || 'admin123';

        if (user === expectedUser && pwd === expectedPassword) {
          return NextResponse.next();
        }
      }
    } catch {}
  }

  return new NextResponse('Authentication Required', {
    status: 401,
    headers: {
      'WWW-Authenticate': 'Basic realm="Daraz Dashboard Secure Access"',
    },
  });
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};

