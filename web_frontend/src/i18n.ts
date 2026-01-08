import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import fr from './locales/fr.json';

// Fallback resources
const resources = {
    en: {
        translation: {
            nav: {
                home: "Home",
                movies: "Movies",
                shows: "TV Shows",
                kids: "Kids",
                live: "Live TV",
                browse: "Browse",
                search: "Search",
                settings: "Settings"
            },
            auth: {
                login_plex: "Login with Plex",
                login_server_manual: "Connect Manually",
                subtitle: "Connect your Plex account to access your media libraries"
            }
        }
    },
    fr: {
        translation: fr
    }
};

i18n
    .use(LanguageDetector)
    .use(initReactI18next)
    .init({
        resources,
        fallbackLng: 'en', // Default to English if detection fails
        supportedLngs: ['en', 'fr'],

        interpolation: {
            escapeValue: false // not needed for react as it escapes by default
        },

        detection: {
            order: ['querystring', 'cookie', 'localStorage', 'navigator', 'htmlTag'],
            caches: ['localStorage', 'cookie']
        }
    });

export default i18n;
