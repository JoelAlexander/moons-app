
export const NEXT_PUBLIC_URL =
  process.env.NODE_ENV == 'development'
    ? `http://localhost:3000`
    : 'https://puny-kilobyte-purring.on-fleek.app';
export const NEXT_PUBLIC_CDP_API_KEY = process.env.NEXT_PUBLIC_CDP_API_KEY;
