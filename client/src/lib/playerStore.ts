import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface PlayerProfile {
  playerId: string;
  username: string;
  firstName: string;
  lastName: string;
  country: string;
}

interface PlayerState extends PlayerProfile {
  setProfile: (profile: Partial<PlayerProfile>) => void;
  isProfileComplete: () => boolean;
  getDisplayName: () => string;
  getCountryFlag: () => string;
}

function generatePlayerId(): string {
  return 'player_' + Math.random().toString(36).substring(2, 15) + Date.now().toString(36);
}

export const COUNTRY_FLAGS: Record<string, string> = {
  'IN': '\u{1F1EE}\\u{1F1F3}',
  'US': '\\u{1F1FA}\\u{1F1F8}',
  'GB': '\u{1F1EC}\u{1F1E7}',
  'CA': '\u{1F1E8}\u{1F1E6}',
  'AU': '\\u{1F1E6}\\u{1F1FA}',
  'DE': '\u{1F1E9}\\u{1F1EA}',
  'FR': '\\u{1F1EB}\u{1F1F7}',
  'JP': '\u{1F1EF}\\u{1F1F5}',
  'CN': '\u{1F1E8}\\u{1F1F3}',
  'BR': '\\u{1F1E7}\u{1F1F7}',
  'RU': '\u{1F1F7}\u{1F1FA}',
  'KR': '\\u{1F1F0}\u{1F1F7}',
  'IT': '\\u{1F1EE}\\u{1F1F9}',
  'ES': '\u{1F1EA}\u{1F1F8}',
  'MX': '\\u{1F1F2}\u{1F1FD}',
  'NL': '\u{1F1F3}\u{1F1F1}',
  'PL': '\\u{1F1F5}\\u{1F1F1}',
  'SE': '\\u{1F1F8}\u{1F1EA}',
  'NO': '\\u{1F1F3}\u{1F1F4}',
  'DK': '\u{1F1E9}\\u{1F1F0}',
  'FI': '\\u{1F1EB}\\u{1F1EE}',
  'CH': '\\u{1F1E8}\\u{1F1ED}',
  'AT': '\\u{1F1E6}\\u{1F1F9}',
  'BE': '\u{1F1E7}\\u{1F1EA}',
  'PT': '\\u{1F1F5}\u{1F1F9}',
  'GR': '\\u{1F1EC}\u{1F1F7}',
  'TR': '\\u{1F1F9}\\u{1F1F7}',
  'ZA': '\\u{1F1FF}\u{1F1E6}',
  'NZ': '\\u{1F1F3}\\u{1F1FF}',
  'SG': '\u{1F1F8}\u{1F1EC}',
  'AE': '\\u{1F1E6}\\u{1F1EA}',
  'SA': '\\u{1F1F8}\u{1F1E6}',
  'PH': '\\u{1F1F5}\u{1F1ED}',
  'MY': '\u{1F1F2}\\u{1F1FE}',
  'ID': '\u{1F1EE}\u{1F1E9}',
  'TH': '\u{1F1F9}\u{1F1ED}',
  'VN': '\\u{1F1FB}\\u{1F1F3}',
  'PK': '\u{1F1F5}\u{1F1F0}',
  'BD': '\u{1F1E7}\u{1F1E9}',
  'NG': '\\u{1F1F3}\\u{1F1EC}',
  'EG': '\\u{1F1EA}\\u{1F1EC}',
  'AR': '\u{1F1E6}\\u{1F1F7}',
  'CL': '\\u{1F1E8}\\u{1F1F1}',
  'CO': '\u{1F1E8}\\u{1F1F4}',
  'PE': '\u{1F1F5}\\u{1F1EA}',
  'VE': '\u{1F1FB}\\u{1F1EA}',
  'IE': '\u{1F1EE}\u{1F1EA}',
  'IL': '\\u{1F1EE}\u{1F1F1}',
  'HK': '\\u{1F1ED}\u{1F1F0}',
  'TW': '\\u{1F1F9}\u{1F1FC}',
  '': '\u{1F5FA}',
};

export const COUNTRIES = [
  { code: '', name: 'Not Set' },
  { code: 'IN', name: 'India' },
  { code: 'US', name: 'United States' },
  { code: 'GB', name: 'United Kingdom' },
  { code: 'CA', name: 'Canada' },
  { code: 'AU', name: 'Australia' },
  { code: 'DE', name: 'Germany' },
  { code: 'FR', name: 'France' },
  { code: 'JP', name: 'Japan' },
  { code: 'CN', name: 'China' },
  { code: 'BR', name: 'Brazil' },
  { code: 'RU', name: 'Russia' },
  { code: 'KR', name: 'South Korea' },
  { code: 'IT', name: 'Italy' },
  { code: 'ES', name: 'Spain' },
  { code: 'MX', name: 'Mexico' },
  { code: 'NL', name: 'Netherlands' },
  { code: 'PL', name: 'Poland' },
  { code: 'SE', name: 'Sweden' },
  { code: 'NO', name: 'Norway' },
  { code: 'DK', name: 'Denmark' },
  { code: 'FI', name: 'Finland' },
  { code: 'CH', name: 'Switzerland' },
  { code: 'AT', name: 'Austria' },
  { code: 'BE', name: 'Belgium' },
  { code: 'PT', name: 'Portugal' },
  { code: 'GR', name: 'Greece' },
  { code: 'TR', name: 'Turkey' },
  { code: 'ZA', name: 'South Africa' },
  { code: 'NZ', name: 'New Zealand' },
  { code: 'SG', name: 'Singapore' },
  { code: 'AE', name: 'UAE' },
  { code: 'SA', name: 'Saudi Arabia' },
  { code: 'PH', name: 'Philippines' },
  { code: 'MY', name: 'Malaysia' },
  { code: 'ID', name: 'Indonesia' },
  { code: 'TH', name: 'Thailand' },
  { code: 'VN', name: 'Vietnam' },
  { code: 'PK', name: 'Pakistan' },
  { code: 'BD', name: 'Bangladesh' },
  { code: 'NG', name: 'Nigeria' },
  { code: 'EG', name: 'Egypt' },
  { code: 'AR', name: 'Argentina' },
  { code: 'CL', name: 'Chile' },
  { code: 'CO', name: 'Colombia' },
  { code: 'PE', name: 'Peru' },
  { code: 'VE', name: 'Venezuela' },
  { code: 'IE', name: 'Ireland' },
  { code: 'IL', name: 'Israel' },
  { code: 'HK', name: 'Hong Kong' },
  { code: 'TW', name: 'Taiwan' },
];

export const usePlayerStore = create<PlayerState>()(
  persist(
    (set, get) => ({
      playerId: generatePlayerId(),
      username: '',
      firstName: '',
      lastName: '',
      country: '',
      setProfile: (profile: Partial<PlayerProfile>) => set(profile),
      isProfileComplete: () => {
        const state = get();
        return state.username.trim().length > 0 && state.firstName.trim().length > 0;
      },
      getDisplayName: () => {
        const state = get();
        const name = state.lastName 
          ? `${state.firstName} ${state.lastName}` 
          : state.firstName;
        return name || 'Player';
      },
      getCountryFlag: () => {
        const state = get();
        return COUNTRY_FLAGS[state.country] || COUNTRY_FLAGS[''];
      },
    }),
    {
      name: 'unfair-chess-player',
    }
  )
);
