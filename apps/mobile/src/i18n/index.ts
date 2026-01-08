import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import * as Localization from 'expo-localization';
import { Platform } from 'react-native';
import fr from './locales/fr.json';

// Fallback to English if no translation is found
const en = {
    common: {
        loading: "Loading...",
        error: "An error occurred",
        back: "Back",
        save: "Save",
        cancel: "Cancel"
    },
    auth: {
        login_plex: "Login with Plex",
        login_server_manual: "Connect Manually",
        server_address: "Server Address",
        connect: "Connect"
    },
    nav: {
        home: "Home",
        movies: "Movies",
        shows: "TV Shows",
        kids: "Kids",
        live: "Live TV",
        browse: "Browse",
        search: "Search",
        settings: "Settings"
    }
};

const resources = {
    en: { translation: en },
    fr: { translation: fr },
};

const getLanguage = () => {
    try {
        const locale = Localization.getLocales()[0];
        return locale?.languageCode ?? 'en';
    } catch (e) {
        return 'en';
    }
};

i18n
    .use(initReactI18next)
    .init({
        resources,
        lng: getLanguage(),
        fallbackLng: 'fr', // Force French as requested by user or 'en' if preferred default
        interpolation: {
            escapeValue: false,
        },
        compatibilityJSON: 'v3',
        react: {
            useSuspense: false,
        }
    });

export default i18n;
