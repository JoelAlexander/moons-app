
export const NEXT_PUBLIC_URL =
  process.env.NODE_ENV == 'development'
    ? `http://localhost:3000`
    : 'https://enough-manchester-limited.on-fleek.app';
export const NEXT_PUBLIC_CDP_API_KEY = process.env.NEXT_PUBLIC_CDP_API_KEY;
