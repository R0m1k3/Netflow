import { useState, useEffect } from 'react';
import { toast } from 'react-hot-toast';
import api from '@/services/api';

function classNames(...classes: string[]) {
    return classes.filter(Boolean).join(' ');
}

export default function SettingsPage() {
    const [activeTab, setActiveTab] = useState<'general' | 'plex' | 'tmdb' | 'trakt' | 'security'>('general');

    // Configs
    const [config, setConfig] = useState({
        host: '',
        port: 32400,
        protocol: 'http',
        token: '',
        manual: true
    });

    const [preferences, setPreferences] = useState({
        listProvider: 'plex',
        language: 'fr',
        theme: 'dark'
    });

    const [passwords, setPasswords] = useState({
        currentPassword: '',
        newPassword: '',
        confirmPassword: ''
    });

    // States
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    // Plex Auth
    const [isPlexAuthenticating, setIsPlexAuthenticating] = useState(false);
    const [plexAuthStatus, setPlexAuthStatus] = useState('');
    const [testingPlex, setTestingPlex] = useState(false);

    // Trakt Auth
    const [traktStatus, setTraktStatus] = useState({ connected: false, username: '' });
    const [isTraktAuthenticating, setIsTraktAuthenticating] = useState(false);
    const [traktAuthStatus, setTraktAuthStatus] = useState('');
    const [traktDeviceCode, setTraktDeviceCode] = useState('');

    // Plex Servers (Discovered)
    const [plexServers, setPlexServers] = useState<any[]>([]);
    const [startPlexScan, setStartPlexScan] = useState(false);

    useEffect(() => {
        loadAllSettings();
    }, []);

    const loadAllSettings = async () => {
        setLoading(true);

        // Load Plex settings (Critical)
        api.get('/settings/plex').then(res => {
            console.log('Loaded Plex settings:', res);
            if (res.config) {
                setConfig(prev => ({ ...prev, ...res.config, manual: true }));
            } else if (res.configured) {
                setConfig({ ...res.config, manual: true });
            }
        }).catch(err => {
            console.error('Failed to load Plex settings', err);
            toast.error('Erreur chargement Plex');
        });

        // Load Preferences (UI)
        api.getPreferences().then(res => {
            setPreferences(prev => ({ ...prev, ...res }));
        }).catch(err => console.error('Failed to load preferences', err));

        // Load Trakt (Optional / Slow)
        api.getTraktStatus().then(res => {
            setTraktStatus(res);
        }).catch(err => console.error('Failed to load Trakt status', err));

        // We don't wait for everything to finish to show the UI, 
        // but we unset "loading" quickly for the main parts.
        // Actually, let's keep loading true only for Plex config which is critical.
        api.get('/settings/plex').finally(() => {
            setLoading(false);
        });
    };

    // --- PLEX HANDLERS ---

    const handleSavePlex = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true);
        try {
            await api.post('/settings/plex', config);
            toast.success('Configuration Plex sauvegardée');
            await scanPlexServers(); // Trigger sync and update UI
        } catch (error) {
            console.error(error);
            toast.error('Erreur sauvegarde Plex');
        } finally {
            setSaving(false);
        }
    };

    const handleTestPlex = async () => {
        setTestingPlex(true);
        try {
            const res = await api.testPlexConnection(config as any);
            if (res.success) {
                toast.success('Connexion Plex réussie !');
            } else {
                toast.error('Échec connexion Plex');
            }
        } catch (error) {
            toast.error('Erreur test connexion');
        } finally {
            setTestingPlex(false);
        }
    };

    const handleGetPlexToken = async () => {
        try {
            const placeholder = window.open('about:blank', '_blank');
            setIsPlexAuthenticating(true);
            setPlexAuthStatus('Initialisation...');

            const pinData = await api.createPlexPin();
            const { id, code, clientId, authUrl } = pinData;

            if (placeholder) placeholder.location.href = authUrl;

            setPlexAuthStatus('En attente de connexion Plex...');

            const pollInterval = setInterval(async () => {
                try {
                    const result = await api.checkPlexPin(id, clientId, true);
                    if (result.authenticated && result.token) {
                        clearInterval(pollInterval);
                        placeholder?.close();
                        setConfig(prev => ({ ...prev, token: result.token }));
                        toast.success('Token récupéré !');
                        setIsPlexAuthenticating(false);
                        setPlexAuthStatus('');
                        // Trigger scan after token
                        setStartPlexScan(true);
                    }
                } catch (err) { }
            }, 2000);

            setTimeout(() => {
                clearInterval(pollInterval);
                if (isPlexAuthenticating) {
                    setIsPlexAuthenticating(false);
                    setPlexAuthStatus('Temps écoulé');
                }
            }, 120000);

        } catch (error) {
            toast.error('Erreur auth Plex');
            setIsPlexAuthenticating(false);
        }
    };

    // --- PLEX DISCOVERY ---
    useEffect(() => {
        if (startPlexScan) {
            scanPlexServers();
            setStartPlexScan(false);
        }
    }, [startPlexScan]);

    const scanPlexServers = async () => {
        try {
            const servers = await api.getServers();
            console.log('Discovered servers:', servers);
            if (Array.isArray(servers)) {
                setPlexServers(servers);
            } else {
                console.warn('Scan returned non-array:', servers);
                setPlexServers([]);
            }
        } catch (e) { console.error('Failed to scan servers:', e); }
    };

    const handleSelectServerConnection = (server: any, connection: any) => {
        // Auto-fill config from selected connection
        let protocol = 'http';
        let host = '';
        let port = 32400;

        if (connection.uri) {
            try {
                const u = new URL(connection.uri);
                protocol = u.protocol.replace(':', '');
                host = u.hostname;
                port = parseInt(u.port || '32400');
            } catch { }
        } else {
            host = connection.address;
            port = connection.port;
            protocol = connection.protocol;
        }

        setConfig({
            host,
            port,
            protocol: protocol as any,
            token: server.token || config.token, // Use server token if available
            manual: true
        });
        toast.success(`Configuré: ${server.name} via ${host}`);
    };

    // --- TRAKT HANDLERS ---

    const handleConnectTrakt = async () => {
        try {
            setIsTraktAuthenticating(true);
            setTraktAuthStatus('Récupération code...');
            const codeData = await api.getTraktDeviceCode();

            // Show code to user logic (Trakt device flow requires user to visit url and enter code)
            const { user_code, verification_url, device_code, interval } = codeData;

            // Open verification URL
            window.open(verification_url, '_blank');

            // Set code for UI display
            setTraktDeviceCode(user_code);
            setTraktAuthStatus(`Entrez ce code sur la page Trakt`);

            const pollInterval = setInterval(async () => {
                const res = await api.pollTraktDeviceToken(device_code);
                if (res.ok) {
                    clearInterval(pollInterval);
                    toast.success('Compte Trakt connecté !');
                    setTraktStatus({ connected: true, username: 'Connecté' });
                    setTraktAuthStatus('');
                    setTraktDeviceCode('');
                    setIsTraktAuthenticating(false);
                } else if (res.error === 'expired_token' || res.error === 'access_denied') {
                    clearInterval(pollInterval);
                    setIsTraktAuthenticating(false);
                    setTraktAuthStatus('Échec ou expiré');
                    setTraktDeviceCode('');
                }
                // allow pending...
            }, (interval || 5) * 1000);

        } catch (error) {
            toast.error('Erreur connexion Trakt');
            setIsTraktAuthenticating(false);
        }
    };

    const handleDisconnectTrakt = async () => {
        try {
            await api.signOutTrakt();
            setTraktStatus({ connected: false, username: '' });
            toast.success('Déconnecté de Trakt');
        } catch (e) { toast.error('Erreur déconnexion'); }
    };

    // --- PREFS HANDLERS ---
    const handleSavePrefs = async () => {
        setSaving(true);
        try {
            await api.savePreferences(preferences);
            toast.success('Préférences sauvegardées');
        } catch (e) { toast.error('Erreur sauvegarde'); }
        finally { setSaving(false); }
    };

    // --- SECURITY HANDLERS ---
    const handleChangePassword = async (e: React.FormEvent) => {
        e.preventDefault();
        if (passwords.newPassword !== passwords.confirmPassword) {
            toast.error('Mots de passe différents');
            return;
        }
        try {
            await api.post('/auth/password', {
                currentPassword: passwords.currentPassword,
                newPassword: passwords.newPassword
            });
            toast.success('Mot de passe changé');
            setPasswords({ currentPassword: '', newPassword: '', confirmPassword: '' });
        } catch (e: any) { toast.error(e.response?.data?.message || 'Erreur'); }
    };

    // --- TMDB HANDLERS ---
    const [tmdbKey, setTmdbKey] = useState('');
    const [tmdbKeyInfo, setTmdbKeyInfo] = useState<any>(null);

    const loadTmdbInfo = async () => {
        try {
            const info = await api.getTmdbKeyInfo();
            setTmdbKeyInfo(info);
            // We don't get the key back if it's custom, just whether it exists
        } catch (e) { console.error(e); }
    };

    useEffect(() => {
        if (activeTab === 'tmdb') loadTmdbInfo();
    }, [activeTab]);

    const handleSaveTmdb = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!tmdbKey) return;
        setSaving(true);
        try {
            const res = await api.validateTmdbKey(tmdbKey);
            if (res.valid) {
                toast.success('Clé API validée et sauvegardée');
                setTmdbKey('');
                loadTmdbInfo();
            } else {
                toast.error('Clé API invalide');
            }
        } catch (e) { toast.error('Erreur sauvegarde'); }
        finally { setSaving(false); }
    };

    const handleRemoveTmdb = async () => {
        if (!confirm('Utiliser la clé par défaut ?')) return;
        setSaving(true);
        try {
            await api.removeTmdbKey();
            toast.success('Clé supprimée');
            loadTmdbInfo();
        } catch (e) { toast.error('Erreur suppression'); }
        finally { setSaving(false); }
    };

    if (loading) return <div className="p-8 text-center text-zinc-400">Chargement...</div>;

    const TabButton = ({ id, label, icon }: any) => (
        <button
            onClick={() => setActiveTab(id)}
            className={classNames(
                'flex items-center gap-2 px-6 py-3 rounded-lg font-medium transition-all w-full md:w-auto justify-center md:justify-start',
                activeTab === id
                    ? 'bg-red-600 text-white shadow-lg shadow-red-900/20'
                    : 'bg-zinc-800/50 text-zinc-400 hover:bg-zinc-800 hover:text-white'
            )}
        >
            {icon}
            {label}
        </button>
    );

    return (
        <div className="container mx-auto px-4 py-8 max-w-6xl">
            <h1 className="text-3xl font-bold text-white mb-8">Paramètres</h1>

            <div className="flex flex-col md:flex-row gap-8">
                {/* Sidebar Navigation */}
                <div className="md:w-64 flex flex-col gap-2 shrink-0">
                    <TabButton id="general" label="Général" icon={<span className="text-lg">⚙️</span>} />
                    <TabButton id="plex" label="Plex" icon={<span className="text-lg">🎬</span>} />
                    <TabButton id="tmdb" label="TMDB" icon={<span className="text-lg">🎥</span>} />
                    <TabButton id="trakt" label="Trakt" icon={<span className="text-lg">📅</span>} />
                    <TabButton id="security" label="Sécurité" icon={<span className="text-lg">🔒</span>} />
                </div>

                {/* Content Area */}
                <div className="flex-1 bg-zinc-900/50 rounded-xl border border-white/5 p-6 md:p-8 min-h-[500px]">

                    {/* GENERAL TAB */}
                    {activeTab === 'general' && (
                        <div className="space-y-8 animate-fade-in">
                            <h2 className="text-2xl font-bold text-white mb-6">Préférences Générales</h2>

                            <div className="max-w-md space-y-6">
                                <div>
                                    <label className="block text-sm font-medium text-zinc-400 mb-2">Fournisseur de listes principal</label>
                                    <select
                                        value={preferences.listProvider}
                                        onChange={(e) => setPreferences({ ...preferences, listProvider: e.target.value })}
                                        className="w-full bg-black/50 border border-white/10 rounded-lg px-4 py-3 text-white outline-none focus:border-red-500"
                                    >
                                        <option value="plex">Plex Media Server</option>
                                        <option value="trakt">Trakt.tv</option>
                                    </select>
                                    <p className="text-xs text-zinc-500 mt-2">Définit la source utilisée pour les sections "Tendances" et "Populaires".</p>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-zinc-400 mb-2">Langue de l'interface</label>
                                    <select
                                        value={preferences.language}
                                        onChange={(e) => setPreferences({ ...preferences, language: e.target.value })}
                                        className="w-full bg-black/50 border border-white/10 rounded-lg px-4 py-3 text-white outline-none focus:border-red-500"
                                    >
                                        <option value="fr">Français</option>
                                        <option value="en">English</option>
                                    </select>
                                </div>

                                <button
                                    onClick={handleSavePrefs}
                                    disabled={saving}
                                    className="bg-white text-black px-6 py-2 rounded font-bold hover:bg-gray-200 transition-colors"
                                >
                                    {saving ? '...' : 'Enregistrer'}
                                </button>
                            </div>
                        </div>
                    )}

                    {/* PLEX TAB */}
                    {activeTab === 'plex' && (
                        <div className="space-y-6 animate-fade-in">
                            <h2 className="text-2xl font-bold text-white mb-6">Configuration Plex</h2>
                            <p className="text-zinc-400 mb-6">Connexion directe à votre serveur Plex Media Server.</p>

                            <form onSubmit={handleSavePlex} className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-2xl">

                                {/* Server Discovery Section */}
                                <div className="md:col-span-2 bg-black/40 p-4 rounded-lg border border-white/5 mb-4">
                                    <div className="flex justify-between items-center mb-3">
                                        <h3 className="text-white font-medium">Serveurs Découverts</h3>
                                        <button
                                            type="button"
                                            onClick={scanPlexServers}
                                            className="text-xs bg-zinc-700 px-2 py-1 rounded text-white hover:bg-zinc-600"
                                        >
                                            Actualiser
                                        </button>
                                    </div>

                                    {plexServers.length === 0 ? (
                                        <p className="text-sm text-zinc-500 italic">Aucun serveur détecté. Assurez-vous d'avoir un token valide.</p>
                                    ) : (
                                        <div className="space-y-3">
                                            {plexServers.map(srv => (
                                                <div key={srv.clientIdentifier} className="border-l-2 border-red-500 pl-3">
                                                    <div className="text-white font-bold">{srv.name}</div>
                                                    <div className="flex flex-wrap gap-2 mt-1">
                                                        {srv.connections?.map((conn: any, idx: number) => (
                                                            <button
                                                                key={idx}
                                                                type="button"
                                                                onClick={() => handleSelectServerConnection(srv, conn)}
                                                                className="text-xs bg-zinc-800 hover:bg-red-900 border border-zinc-700 px-2 py-1 rounded text-zinc-300 transition-colors"
                                                                title={conn.uri}
                                                            >
                                                                {conn.local ? '🏠 Local' : '☁️ Distant'} ({conn.protocol})
                                                            </button>
                                                        ))}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-zinc-400 mb-1">Protocole</label>
                                    <select
                                        value={config.protocol}
                                        onChange={(e) => setConfig({ ...config, protocol: e.target.value as any })}
                                        className="w-full bg-black/50 border border-white/10 rounded-lg px-4 py-3 text-white outline-none focus:border-red-500"
                                    >
                                        <option value="http">HTTP</option>
                                        <option value="https">HTTPS</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-zinc-400 mb-1">Port</label>
                                    <input
                                        type="number"
                                        value={config.port}
                                        onChange={(e) => setConfig({ ...config, port: parseInt(e.target.value) })}
                                        className="w-full bg-black/50 border border-white/10 rounded-lg px-4 py-3 text-white outline-none focus:border-red-500"
                                    />
                                </div>
                                <div className="md:col-span-2">
                                    <label className="block text-sm font-medium text-zinc-400 mb-1">IP / Hostname</label>
                                    <input
                                        type="text"
                                        value={config.host}
                                        onChange={(e) => setConfig({ ...config, host: e.target.value })}
                                        className="w-full bg-black/50 border border-white/10 rounded-lg px-4 py-3 text-white outline-none focus:border-red-500"
                                        placeholder="ex: 192.168.1.50"
                                    />
                                </div>
                                <div className="md:col-span-2">
                                    <label className="block text-sm font-medium text-zinc-400 mb-1">Token (X-Plex-Token)</label>
                                    <div className="flex gap-2">
                                        <input
                                            type="password"
                                            value={config.token}
                                            onChange={(e) => setConfig({ ...config, token: e.target.value })}
                                            className="w-full bg-black/50 border border-white/10 rounded-lg px-4 py-3 text-white outline-none focus:border-red-500"
                                        />
                                        <button
                                            type="button"
                                            onClick={handleGetPlexToken}
                                            disabled={isPlexAuthenticating}
                                            className="bg-zinc-800 hover:bg-zinc-700 text-white px-4 rounded-lg whitespace-nowrap"
                                        >
                                            {isPlexAuthenticating ? '...' : 'Obtenir'}
                                        </button>
                                    </div>
                                    {plexAuthStatus && <p className="text-sm text-yellow-500 mt-2">{plexAuthStatus}</p>}
                                </div>

                                <div className="md:col-span-2 flex gap-4 pt-4">
                                    <button
                                        type="submit"
                                        disabled={saving}
                                        className="bg-red-600 hover:bg-red-700 text-white px-6 py-2 rounded font-bold transition-colors"
                                    >
                                        {saving ? '...' : 'Sauvegarder'}
                                    </button>
                                    <button
                                        type="button"
                                        onClick={handleTestPlex}
                                        disabled={testingPlex}
                                        className="bg-zinc-700 hover:bg-zinc-600 text-white px-6 py-2 rounded font-bold transition-colors"
                                    >
                                        {testingPlex ? 'Test...' : 'Tester connexion'}
                                    </button>
                                </div>
                            </form>
                        </div>
                    )}

                    {/* TMDB TAB */}
                    {activeTab === 'tmdb' && (
                        <div className="space-y-6 animate-fade-in">
                            <h2 className="text-2xl font-bold text-white mb-6">Configuration TMDB</h2>
                            <p className="text-zinc-400 mb-6">Utilisez votre propre clé API TMDB pour augmenter les limites.</p>

                            <div className="bg-black/40 p-6 rounded-xl border border-white/5 max-w-xl">
                                {tmdbKeyInfo && (
                                    <div className="mb-6 space-y-2">
                                        <div className="flex justify-between items-center">
                                            <span className="text-zinc-400">Statut:</span>
                                            <span className={tmdbKeyInfo.hasCustomKey ? "text-green-500 font-bold" : "text-yellow-500"}>
                                                {tmdbKeyInfo.hasCustomKey ? "Clé Personnalisée Active" : "Clé par défaut (Limitée)"}
                                            </span>
                                        </div>
                                        <div className="flex justify-between items-center">
                                            <span className="text-zinc-400">Requêtes aujourd'hui:</span>
                                            <span className="text-white font-mono">{tmdbKeyInfo.stats?.dailyRequests || 0}</span>
                                        </div>
                                        <div className="flex justify-between items-center">
                                            <span className="text-zinc-400">Rate Limit:</span>
                                            <span className="text-white font-mono">{tmdbKeyInfo.rateLimit?.requests} req / {tmdbKeyInfo.rateLimit?.window}s</span>
                                        </div>
                                    </div>
                                )}

                                <form onSubmit={handleSaveTmdb} className="space-y-4">
                                    <div>
                                        <label className="block text-sm font-medium text-zinc-400 mb-1">Clé API (v3)</label>
                                        <input
                                            type="text"
                                            value={tmdbKey}
                                            onChange={(e) => setTmdbKey(e.target.value)}
                                            placeholder="Entrez votre clé API TMDB..."
                                            className="w-full bg-black/50 border border-white/10 rounded-lg px-4 py-3 text-white outline-none focus:border-red-500"
                                        />
                                        <p className="text-xs text-zinc-500 mt-2">
                                            Vous pouvez obtenir une clé gratuitement sur <a href="https://www.themoviedb.org/settings/api" target="_blank" rel="noreferrer" className="text-red-400 hover:underline">themoviedb.org</a>
                                        </p>
                                    </div>

                                    <div className="flex gap-3 pt-2">
                                        <button
                                            type="submit"
                                            disabled={saving || !tmdbKey}
                                            className="flex-1 bg-red-600 hover:bg-red-700 text-white font-bold py-2 rounded transition-colors disabled:opacity-50"
                                        >
                                            {saving ? 'Validation...' : 'Valider & Sauvegarder'}
                                        </button>
                                        <button
                                            type="button"
                                            onClick={async (e) => {
                                                e.preventDefault();
                                                if (!tmdbKey) return;
                                                setSaving(true);
                                                try {
                                                    const res = await api.validateTmdbKey(tmdbKey);
                                                    if (res.valid) toast.success('Test réussi ! Clé valide.');
                                                    else toast.error('Test échoué : Clé invalide.');
                                                } catch (e) { toast.error('Erreur test connexion'); }
                                                finally { setSaving(false); }
                                            }}
                                            disabled={saving || !tmdbKey}
                                            className="px-6 bg-zinc-700 hover:bg-zinc-600 text-white font-bold py-2 rounded transition-colors disabled:opacity-50"
                                        >
                                            Tester
                                        </button>
                                        {tmdbKeyInfo?.hasCustomKey && (
                                            <button
                                                type="button"
                                                onClick={handleRemoveTmdb}
                                                disabled={saving}
                                                className="px-4 bg-zinc-800 hover:bg-red-900/50 text-white rounded transition-colors"
                                                title="Supprimer la clé personnalisée"
                                            >
                                                🗑️
                                            </button>
                                        )}
                                    </div>
                                </form>
                            </div>
                        </div>
                    )}

                    {/* TRAKT TAB */}
                    {activeTab === 'trakt' && (
                        <div className="space-y-6 animate-fade-in">
                            <h2 className="text-2xl font-bold text-white mb-6">Connexion Trakt.tv</h2>
                            <p className="text-zinc-400 mb-6">Synchronisez votre historique et vos listes de lecture.</p>

                            <div className="bg-black/40 p-6 rounded-xl border border-white/5 max-w-xl">
                                <div className="flex items-center justify-between mb-6">
                                    <div>
                                        <h3 className="text-lg font-medium text-white">Statut</h3>
                                        <p className={classNames('text-sm mt-1 font-medium', traktStatus.connected ? 'text-green-500' : 'text-zinc-500')}>
                                            {traktStatus.connected ? `Connecté en tant que ${traktStatus.username}` : 'Non connecté'}
                                        </p>
                                    </div>
                                    <div className="text-4xl">
                                        {traktStatus.connected ? '✅' : '⚪'}
                                    </div>
                                </div>

                                {traktAuthStatus && (
                                    <div className="bg-blue-900/30 p-4 rounded mb-6 text-blue-200 text-center animate-pulse">
                                        <p className="mb-2">{traktAuthStatus}</p>
                                        {traktDeviceCode && (
                                            <div className="flex items-center justify-center gap-2 mt-2">
                                                <code className="bg-black/40 px-3 py-1 rounded text-xl font-mono tracking-widest">{traktDeviceCode}</code>
                                                <button
                                                    onClick={() => {
                                                        navigator.clipboard.writeText(traktDeviceCode);
                                                        toast.success('Code copié !');
                                                    }}
                                                    className="bg-white/10 hover:bg-white/20 p-2 rounded transition-colors"
                                                    title="Copier le code"
                                                >
                                                    📋
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                )}

                                {!traktStatus.connected ? (
                                    <button
                                        onClick={handleConnectTrakt}
                                        disabled={isTraktAuthenticating}
                                        className="w-full bg-red-600 hover:bg-red-700 text-white font-bold py-3 rounded transition-colors"
                                    >
                                        {isTraktAuthenticating ? 'Connexion en cours...' : 'Connecter Trakt'}
                                    </button>
                                ) : (
                                    <button
                                        onClick={handleDisconnectTrakt}
                                        className="w-full bg-zinc-800 hover:bg-zinc-700 text-white font-bold py-3 rounded transition-colors"
                                    >
                                        Déconnecter
                                    </button>
                                )}

                                <p className="text-xs text-zinc-500 mt-4 text-center">
                                    Nous utiliserons un code temporaire pour authentifier l'application.
                                </p>
                            </div>
                        </div>
                    )}

                    {/* SECURITY TAB */}
                    {activeTab === 'security' && (
                        <div className="space-y-6 animate-fade-in">
                            <h2 className="text-2xl font-bold text-white mb-6">Sécurité</h2>

                            <form onSubmit={handleChangePassword} className="max-w-md space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-zinc-400 mb-1">Mot de passe actuel</label>
                                    <input
                                        type="password"
                                        value={passwords.currentPassword}
                                        onChange={(e) => setPasswords({ ...passwords, currentPassword: e.target.value })}
                                        className="w-full bg-black/50 border border-white/10 rounded-lg px-4 py-3 text-white outline-none focus:border-red-500"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-zinc-400 mb-1">Nouveau mot de passe</label>
                                    <input
                                        type="password"
                                        value={passwords.newPassword}
                                        onChange={(e) => setPasswords({ ...passwords, newPassword: e.target.value })}
                                        className="w-full bg-black/50 border border-white/10 rounded-lg px-4 py-3 text-white outline-none focus:border-red-500"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-zinc-400 mb-1">Confirmer nouveau</label>
                                    <input
                                        type="password"
                                        value={passwords.confirmPassword}
                                        onChange={(e) => setPasswords({ ...passwords, confirmPassword: e.target.value })}
                                        className="w-full bg-black/50 border border-white/10 rounded-lg px-4 py-3 text-white outline-none focus:border-red-500"
                                    />
                                </div>
                                <button
                                    type="submit"
                                    className="bg-white text-black px-6 py-2 rounded font-bold hover:bg-gray-200 transition-colors mt-4"
                                >
                                    Modifier mot de passe
                                </button>
                            </form>
                        </div>
                    )}

                </div>
            </div>
        </div>
    );
}
