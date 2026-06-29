export interface SpotifyTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  expiresAt: number; // timestamp in ms
}

export interface SpotifyTrack {
  id: string;
  name: string;
  artists: string[];
  albumName: string;
  albumCoverUrl: string;
  durationMs: number;
  progressMs: number;
  isPlaying: boolean;
  volumePercent: number;
  deviceActive: boolean;
  deviceName: string;
}

const TOKEN_KEY = 'spotify_tokens';
const CLIENT_ID_KEY = 'spotify_client_id';

// Default Client ID fallback if user does not enter one.
// Users can configure their own Client ID in the Spotify settings panel.
export const DEFAULT_SPOTIFY_CLIENT_ID = 'd942e12e12814b7bb055c56890f84578';

export function getStoredClientId(): string {
  if (typeof window === 'undefined') return DEFAULT_SPOTIFY_CLIENT_ID;
  return localStorage.getItem(CLIENT_ID_KEY) || DEFAULT_SPOTIFY_CLIENT_ID;
}

export function saveStoredClientId(clientId: string): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(CLIENT_ID_KEY, clientId);
}

export function getStoredTokens(): SpotifyTokens | null {
  if (typeof window === 'undefined') return null;
  const data = localStorage.getItem(TOKEN_KEY);
  if (!data) return null;
  try {
    return JSON.parse(data);
  } catch {
    return null;
  }
}

export function saveTokens(tokens: SpotifyTokens): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(TOKEN_KEY, JSON.stringify(tokens));
}

export function clearStoredTokens(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(TOKEN_KEY);
}

// PKCE Cryptographic Helpers
export function generateRandomString(length: number): string {
  const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  const values = crypto.getRandomValues(new Uint8Array(length));
  return Array.from(values).map((x) => possible[x % possible.length]).join('');
}

export async function sha256(plain: string): Promise<ArrayBuffer> {
  const encoder = new TextEncoder();
  const data = encoder.encode(plain);
  return crypto.subtle.digest('SHA-256', data);
}

export function base64urlencode(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

export async function generateCodeChallenge(v: string): Promise<string> {
  const hashed = await sha256(v);
  return base64urlencode(hashed);
}

export async function initiateSpotifyLogin(clientId: string, redirectUri: string) {
  const codeVerifier = generateRandomString(64);
  localStorage.setItem('spotify_code_verifier', codeVerifier);
  
  const codeChallenge = await generateCodeChallenge(codeVerifier);
  
  const scopes = [
    'user-read-playback-state',
    'user-modify-playback-state',
    'user-read-currently-playing'
  ].join(' ');

  const params = new URLSearchParams({
    response_type: 'code',
    client_id: clientId,
    scope: scopes,
    redirect_uri: redirectUri,
    code_challenge_method: 'S256',
    code_challenge: codeChallenge,
  });

  return `https://accounts.spotify.com/authorize?${params.toString()}`;
}

export async function exchangeCodeForTokens(
  clientId: string,
  redirectUri: string,
  code: string,
  codeVerifier: string
): Promise<SpotifyTokens> {
  const body = new URLSearchParams({
    client_id: clientId,
    grant_type: 'authorization_code',
    code,
    redirect_uri: redirectUri,
    code_verifier: codeVerifier,
  });

  const response = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: body.toString(),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Failed to exchange code: ${errText}`);
  }

  const data = await response.json();
  const tokens: SpotifyTokens = {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresIn: data.expires_in,
    expiresAt: Date.now() + data.expires_in * 1000,
  };

  saveTokens(tokens);
  return tokens;
}

export async function refreshSpotifyToken(clientId: string, refreshToken: string): Promise<SpotifyTokens> {
  const body = new URLSearchParams({
    client_id: clientId,
    grant_type: 'refresh_token',
    refresh_token: refreshToken,
  });

  const response = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: body.toString(),
  });

  if (!response.ok) {
    clearStoredTokens();
    throw new Error('Failed to refresh access token');
  }

  const data = await response.json();
  const tokens: SpotifyTokens = {
    accessToken: data.access_token,
    refreshToken: data.refresh_token || refreshToken, // Spotify might not return a new refresh token if it hasn't changed
    expiresIn: data.expires_in,
    expiresAt: Date.now() + data.expires_in * 1000,
  };

  saveTokens(tokens);
  return tokens;
}

export async function getValidAccessToken(): Promise<string | null> {
  const tokens = getStoredTokens();
  if (!tokens) return null;

  // If token is expired or expiring in less than 60 seconds, refresh it
  if (Date.now() + 60 * 1000 >= tokens.expiresAt) {
    try {
      const clientId = getStoredClientId();
      const newTokens = await refreshSpotifyToken(clientId, tokens.refreshToken);
      return newTokens.accessToken;
    } catch (e) {
      console.error('Failed to refresh token automatically:', e);
      return null;
    }
  }

  return tokens.accessToken;
}

// Spotify playback API helpers
async function spotifyFetch(endpoint: string, method: string = 'GET', bodyObj?: any) {
  const token = await getValidAccessToken();
  if (!token) throw new Error('Not authenticated with Spotify');

  const headers: HeadersInit = {
    'Authorization': `Bearer ${token}`,
  };

  if (bodyObj) {
    headers['Content-Type'] = 'application/json';
  }

  const res = await fetch(`https://api.spotify.com/v1/${endpoint}`, {
    method,
    headers,
    body: bodyObj ? JSON.stringify(bodyObj) : undefined,
  });

  if (res.status === 204) {
    return null;
  }

  if (!res.ok) {
    // If rate limited or error, safely ignore or throw
    const errorText = await res.text();
    throw new Error(`Spotify API Error: ${res.status} - ${errorText}`);
  }

  return res.json();
}

export async function getPlaybackState(): Promise<SpotifyTrack | null> {
  try {
    const data = await spotifyFetch('me/player');
    if (!data || !data.item) return null;

    const track: SpotifyTrack = {
      id: data.item.id,
      name: data.item.name,
      artists: data.item.artists.map((a: any) => a.name),
      albumName: data.item.album.name,
      albumCoverUrl: data.item.album.images?.[0]?.url || 'https://picsum.photos/seed/spotify/300/300',
      durationMs: data.item.duration_ms,
      progressMs: data.progress_ms || 0,
      isPlaying: data.is_playing,
      volumePercent: data.device?.volume_percent ?? 50,
      deviceActive: data.device?.is_active ?? false,
      deviceName: data.device?.name || 'Unknown Device',
    };
    return track;
  } catch (error) {
    console.warn('Could not load Spotify playback state:', error);
    return null;
  }
}

export async function togglePlayPause(isPlaying: boolean): Promise<void> {
  try {
    if (isPlaying) {
      await spotifyFetch('me/player/pause', 'PUT');
    } else {
      await spotifyFetch('me/player/play', 'PUT');
    }
  } catch (e) {
    console.error('Play/Pause toggle failed:', e);
  }
}

export async function playTrack(): Promise<void> {
  try {
    await spotifyFetch('me/player/play', 'PUT');
  } catch (e) {
    console.error('Play failed:', e);
  }
}

export async function pauseTrack(): Promise<void> {
  try {
    await spotifyFetch('me/player/pause', 'PUT');
  } catch (e) {
    console.error('Pause failed:', e);
  }
}

export async function skipToNext(): Promise<void> {
  try {
    await spotifyFetch('me/player/next', 'POST');
  } catch (e) {
    console.error('Skip next failed:', e);
  }
}

export async function skipToPrevious(): Promise<void> {
  try {
    await spotifyFetch('me/player/previous', 'POST');
  } catch (e) {
    console.error('Skip previous failed:', e);
  }
}

export async function setPlaybackVolume(volumePercent: number): Promise<void> {
  try {
    // Spotify API volume endpoint requires volume_percent in query string
    await spotifyFetch(`me/player/volume?volume_percent=${Math.min(100, Math.max(0, volumePercent))}`, 'PUT');
  } catch (e) {
    console.error('Volume setting failed:', e);
  }
}
