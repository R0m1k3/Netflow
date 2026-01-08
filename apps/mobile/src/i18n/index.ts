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
    },
    settings: {
        title: "Settings",
        account: "ACCOUNT",
        content_discovery: "CONTENT & DISCOVERY",
        appearance: "APPEARANCE",
        android_performance: "ANDROID PERFORMANCE",
        integrations: "INTEGRATIONS",
        playback: "PLAYBACK",
        about: "ABOUT",
        plex: "Plex",
        not_connected: "Not connected",
        connected: "Connected",
        catalogs: "Catalogs",
        catalogs_desc: "Choose which libraries appear",
        home_screen: "Home Screen",
        home_screen_desc: "Hero and row visibility",
        details_screen: "Details Screen",
        details_screen_desc: "Ratings and badges display",
        continue_watching: "Continue Watching",
        continue_watching_desc: "Playback and cache behavior",
        episode_layout: "Episode Layout",
        horizontal: "Horizontal",
        vertical: "Vertical",
        streams_backdrop: "Streams Backdrop",
        streams_backdrop_desc: "Show dimmed backdrop behind player settings",
        enable_blur: "Enable Blur Effects",
        enable_blur_desc: "Enable blur view effects. May impact performance on some devices.",
        tmdb_desc: "Metadata and language (always enabled)",
        mdblist: "MDBList (Multi-source)",
        enabled: "Enabled",
        disabled: "Disabled",
        trakt: "Trakt",
        trakt_desc: "Track your watch history",
        trakt_signin_desc: "Sign in to sync",
        overseerr: "Overseerr",
        video_player: "Video Player",
        coming_soon: "Coming soon",
        autoplay_best: "Auto-play Best Stream",
        always_resume: "Always Resume",
        privacy_policy: "Privacy Policy",
        privacy_desc: "Review how data is handled",
        report_issue: "Report Issue",
        report_issue_desc: "Open a GitHub issue",
        contributors: "Contributors",
        contributors_desc: "Project contributors",
        version: "Version",
        discord: "Discord",
        discord_desc: "Join the community",
        reddit: "Reddit",
        reddit_desc: "Follow updates"
    },
    trakt: {
        title: "Trakt",
        track_history: "Track your watch history",
        account: "ACCOUNT",
        connected_as: "Connected as",
        sign_out: "Sign out",
        not_connected: "Not connected",
        connect: "Connect Trakt",
        device_code: "DEVICE CODE",
        waiting_auth: "Waiting for authorization...",
        enter_code: "Enter this code on Trakt",
        copy_code: "Copy Code",
        copied: "Copied!",
        visit: "Visit:"
    },
    details: {
        no_metadata: 'No metadata available',
        view_show: 'View Show',
        play: 'PLAY',
        continue: 'CONTINUE',
        rewatch: 'REWATCH',
        no_source_msg: "You don't own this content\nNo local source found",
        trailer: 'TRAILER',
        no_trailer: 'NO TRAILER',
        in_list: 'IN LIST',
        watchlist: 'WATCHLIST',
        episodes: 'EPISODES',
        episodes_count: 'Episodes',
        episode: 'Episode',
        suggested: 'SUGGESTED',
        details: 'DETAILS',
        loading: 'Loading...',
        no_suggestions: 'No suggestions',
        recommended: 'Recommended',
        more_like_this: 'More Like This',
        created_by: 'Created By',
        directors: 'Directors',
        writers: 'Writers',
        technical: 'Technical',
        resolution: 'Resolution',
        video: 'Video',
        audio: 'Audio',
        container: 'Container',
        bitrate: 'Bitrate',
        hdr: 'HDR',
        collections: 'Collections',
        production: 'Production',
        network: 'Network',
        cast: 'Cast',
        crew: 'Crew',
        info: 'Info',
        runtime: 'Runtime',
        status: 'Status',
        release_date: 'Release Date',
        first_aired: 'First Aired',
        last_aired: 'Last Aired',
        seasons: 'Seasons',
        season: 'Season',
        original_language: 'Original Language',
        budget: 'Budget',
        revenue: 'Revenue',
        studio: 'Studio',
        year: 'Year',
        content_rating: 'Content Rating',
        ratings: 'Ratings',
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
