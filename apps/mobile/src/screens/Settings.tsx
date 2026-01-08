import React, { useRef, useCallback, useMemo, useState } from 'react';
import { View, Text, ScrollView, Animated, Linking, Switch, StyleSheet, Platform, Pressable, Dimensions } from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useNetflow } from '../core/NetflowContext';
import { getTraktProfile, getPlexUser, getConnectedServerInfo, getAppVersion } from '../core/SettingsData';
import { useAppSettings } from '../hooks/useAppSettings';
import SettingsCard from '../components/settings/SettingsCard';
import SettingItem from '../components/settings/SettingItem';
import SettingsHeader from '../components/settings/SettingsHeader';
import PlexIcon from '../components/icons/PlexIcon';
import TMDBIcon from '../components/icons/TMDBIcon';
import MDBListIcon from '../components/icons/MDBListIcon';
import TraktIcon from '../components/icons/TraktIcon';
import OverseerrIcon from '../components/icons/OverseerrIcon';

const { width } = Dimensions.get('window');
const isTablet = Platform.OS === 'ios' ? Platform.isPad : width >= 768;

const ABOUT_LINKS = {
  privacy: 'https://netflow.xyz/privacy',
  reportIssue: 'https://github.com/Netflow/netflow/issues',
  contributors: 'https://github.com/Netflow/netflow',
  discord: 'https://discord.gg/netflow',
  reddit: 'https://www.reddit.com/r/netflow/',
};

type CategoryId =
  | 'account'
  | 'content'
  | 'appearance'
  | 'androidPerformance'
  | 'integrations'
  | 'playback'
  | 'about';

// Keep icons mapping, titles will be resolved via i18n
const CATEGORY_ICONS: Record<CategoryId, keyof typeof Ionicons.glyphMap> = {
  account: 'person-circle-outline',
  content: 'compass-outline',
  appearance: 'color-palette-outline',
  androidPerformance: 'speedometer-outline',
  integrations: 'layers-outline',
  playback: 'play-circle-outline',
  about: 'information-circle-outline',
};

const CATEGORIES: Array<{ id: CategoryId; androidOnly?: boolean }> = [
  { id: 'account' },
  { id: 'content' },
  { id: 'appearance' },
  { id: 'androidPerformance', androidOnly: true },
  { id: 'integrations' },
  { id: 'playback' },
  { id: 'about' },
];

interface SettingsProps {
  onLogout?: () => Promise<void>;
  onBack?: () => void;
}

export default function Settings({ onBack }: SettingsProps) {
  const { t } = useTranslation();
  const nav: any = useNavigation();
  const insets = useSafeAreaInsets();
  const headerHeight = insets.top + 52;
  const scrollY = useRef(new Animated.Value(0)).current;
  const { isLoading: netflowLoading, isConnected } = useNetflow();

  // Resolve Category Titles
  const getCategoryTitle = (id: CategoryId) => {
    switch (id) {
      case 'account': return t('settings.account');
      case 'content': return t('settings.content_discovery');
      case 'appearance': return t('settings.appearance');
      case 'androidPerformance': return t('settings.android_performance');
      case 'integrations': return t('settings.integrations');
      case 'playback': return t('settings.playback');
      case 'about': return t('settings.about');
      default: return '';
    }
  };

  const { settings, updateSetting } = useAppSettings();
  const [traktProfile, setTraktProfile] = useState<any | null>(null);
  const [plexUser, setPlexUser] = useState<any | null>(null);
  const [serverInfo, setServerInfo] = useState<{ name: string; url: string } | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<CategoryId>('account');

  useFocusEffect(
    useCallback(() => {
      if (netflowLoading || !isConnected) return;

      (async () => {
        setTraktProfile(await getTraktProfile());
        setPlexUser(await getPlexUser());
        setServerInfo(getConnectedServerInfo());
      })();
    }, [netflowLoading, isConnected])
  );

  // Only create goBack if onBack was provided (from sub-screen navigation)
  const goBack = onBack ? onBack : undefined;

  const renderRightChevron = useCallback(
    () => <Ionicons name="chevron-forward" size={18} color="#9ca3af" />,
    []
  );

  const plexDescription = useMemo(() => {
    if (!plexUser) return t('settings.not_connected');
    const connectedText = t('settings.connected');
    if (serverInfo) return `${plexUser?.username || plexUser?.title || connectedText} · ${serverInfo.name}`;
    return plexUser?.username || plexUser?.title || connectedText;
  }, [plexUser, serverInfo, t]);

  const renderAccount = () => (
    <SettingsCard title={t('settings.account')}>
      <SettingItem
        title={t('settings.plex')}
        description={plexDescription}
        renderIcon={() => <PlexIcon size={18} color="#e5e7eb" />}
        renderRight={renderRightChevron}
        onPress={() => nav.navigate('PlexSettings')}
        isLast={true}
      />
    </SettingsCard>
  );

  const renderContent = () => (
    <SettingsCard title={t('settings.content_discovery')}>
      <SettingItem
        title={t('settings.catalogs')}
        description={t('settings.catalogs_desc')}
        icon="albums-outline"
        renderRight={renderRightChevron}
        onPress={() => nav.navigate('CatalogSettings')}
        isLast={false}
      />
      <SettingItem
        title={t('settings.home_screen')}
        description={t('settings.home_screen_desc')}
        icon="home-outline"
        renderRight={renderRightChevron}
        onPress={() => nav.navigate('HomeScreenSettings')}
        isLast={false}
      />
      <SettingItem
        title={t('settings.details_screen')}
        description={t('settings.details_screen_desc')}
        icon="information-circle-outline"
        renderRight={renderRightChevron}
        onPress={() => nav.navigate('DetailsScreenSettings')}
        isLast={false}
      />
      <SettingItem
        title={t('settings.continue_watching')}
        description={t('settings.continue_watching_desc')}
        icon="play-outline"
        renderRight={renderRightChevron}
        onPress={() => nav.navigate('ContinueWatchingSettings')}
        isLast={true}
      />
    </SettingsCard>
  );

  const renderAppearance = () => (
    <SettingsCard title={t('settings.appearance')}>
      <SettingItem
        title={t('settings.episode_layout')}
        description={settings.episodeLayoutStyle === 'horizontal' ? t('settings.horizontal') : t('settings.vertical')}
        icon="grid-outline"
        renderRight={() => (
          <Switch
            value={settings.episodeLayoutStyle === 'horizontal'}
            onValueChange={(value) =>
              updateSetting('episodeLayoutStyle', value ? 'horizontal' : 'vertical')
            }
          />
        )}
        isLast={false}
      />
      <SettingItem
        title={t('settings.streams_backdrop')}
        description={t('settings.streams_backdrop_desc')}
        icon="image-outline"
        renderRight={() => (
          <Switch
            value={settings.enableStreamsBackdrop}
            onValueChange={(value) => updateSetting('enableStreamsBackdrop', value)}
          />
        )}
        isLast={true}
      />
    </SettingsCard>
  );

  const renderAndroidPerformance = () => (
    <SettingsCard title={t('settings.android_performance')}>
      <SettingItem
        title={t('settings.enable_blur')}
        description={t('settings.enable_blur_desc')}
        icon="sparkles-outline"
        renderRight={() => (
          <Switch
            value={settings.enableAndroidBlurView}
            onValueChange={(value) => updateSetting('enableAndroidBlurView', value)}
          />
        )}
        isLast={true}
      />
    </SettingsCard>
  );

  const renderIntegrations = () => (
    <SettingsCard title={t('settings.integrations')}>
      <SettingItem
        title="TMDB"
        description={t('settings.tmdb_desc')}
        renderIcon={() => <TMDBIcon size={18} color="#e5e7eb" />}
        renderRight={renderRightChevron}
        onPress={() => nav.navigate('TMDBSettings')}
        isLast={false}
      />
      <SettingItem
        title={t('settings.mdblist')}
        description={settings.mdblistEnabled ? t('settings.enabled') : t('settings.disabled')}
        renderIcon={() => <MDBListIcon size={18} color="#e5e7eb" />}
        renderRight={renderRightChevron}
        onPress={() => nav.navigate('MDBListSettings')}
        isLast={false}
      />
      <SettingItem
        title={t('settings.trakt')}
        description={traktProfile ? `@${traktProfile?.username || traktProfile?.ids?.slug}` : t('settings.trakt_signin_desc')}
        renderIcon={() => <TraktIcon size={18} color="#e5e7eb" />}
        renderRight={renderRightChevron}
        onPress={() => nav.navigate('TraktSettings')}
        isLast={false}
      />
      <SettingItem
        title={t('settings.overseerr')}
        description={settings.overseerrEnabled ? t('settings.enabled') : t('settings.disabled')}
        renderIcon={() => <OverseerrIcon size={18} color="#e5e7eb" />}
        renderRight={renderRightChevron}
        onPress={() => nav.navigate('OverseerrSettings')}
        isLast={true}
      />
    </SettingsCard>
  );

  const renderPlayback = () => (
    <SettingsCard title={t('settings.playback')}>
      <SettingItem
        title={t('settings.video_player')}
        description={t('settings.coming_soon')}
        icon="play-circle-outline"
        renderRight={() => <Text style={styles.comingSoon}>{t('settings.coming_soon')}</Text>}
        disabled
        isLast={false}
      />
      <SettingItem
        title={t('settings.autoplay_best')}
        description={t('settings.coming_soon')}
        icon="flash-outline"
        renderRight={() => <Switch value={false} onValueChange={() => { }} disabled />}
        disabled
        isLast={false}
      />
      <SettingItem
        title={t('settings.always_resume')}
        description={t('settings.coming_soon')}
        icon="refresh-outline"
        renderRight={() => <Switch value={false} onValueChange={() => { }} disabled />}
        disabled
        isLast={true}
      />
    </SettingsCard>
  );

  const renderAbout = () => (
    <SettingsCard title={t('settings.about')}>
      <SettingItem
        title={t('settings.privacy_policy')}
        description={t('settings.privacy_desc')}
        icon="shield-outline"
        renderRight={renderRightChevron}
        onPress={() => Linking.openURL(ABOUT_LINKS.privacy)}
        isLast={false}
      />
      <SettingItem
        title={t('settings.report_issue')}
        description={t('settings.report_issue_desc')}
        icon="bug-outline"
        renderRight={renderRightChevron}
        onPress={() => Linking.openURL(ABOUT_LINKS.reportIssue)}
        isLast={false}
      />
      <SettingItem
        title={t('settings.contributors')}
        description={t('settings.contributors_desc')}
        icon="people-outline"
        renderRight={renderRightChevron}
        onPress={() => Linking.openURL(ABOUT_LINKS.contributors)}
        isLast={false}
      />
      <SettingItem
        title={t('settings.version')}
        description={`v${getAppVersion()}`}
        icon="information-circle-outline"
        isLast={false}
      />
      <SettingItem
        title={t('settings.discord')}
        description={t('settings.discord_desc')}
        icon="chatbubbles-outline"
        renderRight={renderRightChevron}
        onPress={() => Linking.openURL(ABOUT_LINKS.discord)}
        isLast={false}
      />
      <SettingItem
        title={t('settings.reddit')}
        description={t('settings.reddit_desc')}
        icon="chatbox-ellipses-outline"
        renderRight={renderRightChevron}
        onPress={() => Linking.openURL(ABOUT_LINKS.reddit)}
        isLast={true}
      />
    </SettingsCard>
  );

  const renderCategory = (category: CategoryId) => {
    switch (category) {
      case 'account':
        return renderAccount();
      case 'content':
        return renderContent();
      case 'appearance':
        return renderAppearance();
      case 'androidPerformance':
        return renderAndroidPerformance();
      case 'integrations':
        return renderIntegrations();
      case 'playback':
        return renderPlayback();
      case 'about':
        return renderAbout();
      default:
        return null;
    }
  };

  // Filter categories based on platform
  const visibleCategories = useMemo(() =>
    CATEGORIES.filter(cat => !cat.androidOnly || Platform.OS === 'android'),
    []
  );

  if (isTablet) {
    return (
      <View style={styles.container}>
        <SettingsHeader title={t('settings.title')} onBack={goBack} scrollY={scrollY} />
        <View style={[styles.tabletLayout, { paddingTop: headerHeight }]}>
          <View style={styles.sidebar}>
            {visibleCategories.map((cat) => (
              <Pressable
                key={cat.id}
                onPress={() => setSelectedCategory(cat.id)}
                style={[
                  styles.sidebarItem,
                  selectedCategory === cat.id && styles.sidebarItemActive,
                ]}
              >
                <Ionicons
                  name={CATEGORY_ICONS[cat.id]}
                  size={18}
                  color={selectedCategory === cat.id ? '#fff' : '#9ca3af'}
                />
                <Text
                  style={[
                    styles.sidebarText,
                    selectedCategory === cat.id && styles.sidebarTextActive,
                  ]}
                >
                  {getCategoryTitle(cat.id)}
                </Text>
              </Pressable>
            ))}
          </View>
          <Animated.ScrollView
            contentContainerStyle={[
              styles.tabletContent,
              { paddingBottom: insets.bottom + 100 }
            ]}
            onScroll={Animated.event(
              [{ nativeEvent: { contentOffset: { y: scrollY } } }],
              { useNativeDriver: false }
            )}
            scrollEventThrottle={16}
          >
            {renderCategory(selectedCategory)}
          </Animated.ScrollView>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <SettingsHeader title={t('settings.title')} onBack={goBack} scrollY={scrollY} />
      <Animated.ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingTop: headerHeight + 12, paddingBottom: insets.bottom + 100 }
        ]}
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { y: scrollY } } }],
          { useNativeDriver: false }
        )}
        scrollEventThrottle={16}
      >
        {renderAccount()}
        {renderContent()}
        {renderAppearance()}
        {Platform.OS === 'android' && renderAndroidPerformance()}
        {renderIntegrations()}
        {renderPlayback()}
        {renderAbout()}
      </Animated.ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0b0b0d',
  },
  content: {
    paddingHorizontal: 16,
  },
  comingSoon: {
    color: '#9ca3af',
    fontSize: 12,
    fontWeight: '600',
  },
  tabletLayout: {
    flex: 1,
    flexDirection: 'row',
  },
  sidebar: {
    width: 260,
    paddingHorizontal: 12,
    paddingTop: 8,
    borderRightWidth: 1,
    borderRightColor: 'rgba(255,255,255,0.08)',
  },
  sidebarItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 12,
    marginBottom: 6,
  },
  sidebarItemActive: {
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  sidebarText: {
    color: '#9ca3af',
    fontSize: 14,
    fontWeight: '600',
  },
  sidebarTextActive: {
    color: '#fff',
  },
  tabletContent: {
    paddingHorizontal: 20,
    flexGrow: 1,
  },
});
