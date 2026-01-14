import { useState, useEffect } from 'react';
import { toast } from 'react-hot-toast';
import api from '@/services/api';

export default function SettingsPage() {
    const [config, setConfig] = useState({
        host: '',
        port: 32400,
        protocol: 'http',
        token: '',
        manual: true
    });
    const [passwords, setPasswords] = useState({
        currentPassword: '',
        newPassword: '',
        confirmPassword: ''
    });
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [changingPassword, setChangingPassword] = useState(false);

    // Plex Auth State
    const [isPlexAuthenticating, setIsPlexAuthenticating] = useState(false);
    const [plexAuthStatus, setPlexAuthStatus] = useState('');

    useEffect(() => {
        loadConfig();
    }, []);

    const loadConfig = async () => {
        try {
            const res = await api.get('/settings/plex');
            if (res.data.configured) {
                setConfig({ ...res.data.config, manual: true });
            }
        } catch (error) {
            console.error('Failed to load settings', error);
            toast.error('Erreur lors du chargement des paramètres');
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true);
        try {
            await api.post('/settings/plex', config);
            toast.success('Configuration sauvegardée');
            // Optionally trigger a sync or reload servers
            await api.get('/auth/servers');
        } catch (error) {
            console.error('Failed to save settings', error);
            toast.error('Erreur lors de la sauvegarde');
        } finally {
            setSaving(false);
        }
    };

    const handleChangePassword = async (e: React.FormEvent) => {
        e.preventDefault();
        if (passwords.newPassword !== passwords.confirmPassword) {
            toast.error('Les nouveaux mots de passe ne correspondent pas');
            return;
        }

        setChangingPassword(true);
        try {
            await api.post('/auth/password', {
                currentPassword: passwords.currentPassword,
                newPassword: passwords.newPassword
            });
            toast.success('Mot de passe mis à jour');
            setPasswords({ currentPassword: '', newPassword: '', confirmPassword: '' });
        } catch (error: any) {
            console.error('Failed to change password', error);
            toast.error(error.message || 'Erreur lors du changement de mot de passe');
        } finally {
            setChangingPassword(false);
        }
    };

    const handleGetPlexToken = async () => {
        try {
            // Open placeholder for popup blocker
            const placeholder = window.open('about:blank', '_blank');

            setIsPlexAuthenticating(true);
            setPlexAuthStatus('Initialisation...');

            const pinData = await api.createPlexPin();
            const { id, code, clientId, authUrl } = pinData;

            if (placeholder) {
                placeholder.location.href = authUrl;
            } else {
                setPlexAuthStatus('Popup bloquée. Veuillez autoriser les popups.');
                // Fallback link?
            }

            setPlexAuthStatus('En attente de connexion Plex...');

            const pollInterval = setInterval(async () => {
                try {
                    // Pass retrieveToken=true to just get the token back
                    const result = await api.checkPlexPin(id, clientId, true);
                    if (result.authenticated && result.token) {
                        clearInterval(pollInterval);
                        placeholder?.close();

                        setConfig(prev => ({ ...prev, token: result.token }));
                        toast.success('Token Plex récupéré avec succès');
                        setIsPlexAuthenticating(false);
                        setPlexAuthStatus('');
                    }
                } catch (err) {
                    console.error('Polling error', err);
                }
            }, 2000);

            // Timeout 2 mins
            setTimeout(() => {
                clearInterval(pollInterval);
                if (isPlexAuthenticating) {
                    setIsPlexAuthenticating(false);
                    setPlexAuthStatus('Temps écoulé');
                }
            }, 120000);

        } catch (error) {
            console.error('Failed to start Plex auth', error);
            toast.error('Erreur initialisation Plex Auth');
            setIsPlexAuthenticating(false);
        }
    };

    if (loading) return <div className="p-8 text-center text-zinc-400">Chargement...</div>;

    return (
        <div className="container mx-auto px-4 py-8 max-w-4xl grid grid-cols-1 md:grid-cols-2 gap-8">

            {/* Plex Server Config */}
            <div className="bg-zinc-900/50 rounded-xl border border-white/5 p-6 h-fit">
                <h2 className="text-xl font-semibold mb-4 text-purple-400">Configuration Serveur</h2>
                <p className="text-zinc-400 text-sm mb-6">
                    Configurez manuellement votre serveur Plex pour garantir une connexion stable.
                </p>

                <form onSubmit={handleSave} className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-zinc-400 mb-1">Protocole</label>
                            <select
                                value={config.protocol}
                                onChange={(e) => setConfig({ ...config, protocol: e.target.value as 'http' | 'https' })}
                                className="w-full bg-black/50 border border-white/10 rounded-lg px-4 py-3 text-white focus:ring-2 focus:ring-purple-500/50 outline-none"
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
                                className="w-full bg-black/50 border border-white/10 rounded-lg px-4 py-3 text-white focus:ring-2 focus:ring-purple-500/50 outline-none"
                            />
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-zinc-400 mb-1">IP ou Nom d'hôte</label>
                        <input
                            type="text"
                            value={config.host}
                            onChange={(e) => setConfig({ ...config, host: e.target.value })}
                            className="w-full bg-black/50 border border-white/10 rounded-lg px-4 py-3 text-white focus:ring-2 focus:ring-purple-500/50 outline-none"
                            placeholder="192.168.1.50"
                            required
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-zinc-400 mb-1">Token Plex (X-Plex-Token)</label>
                        <div className="flex gap-2">
                            <input
                                type="password"
                                value={config.token}
                                onChange={(e) => setConfig({ ...config, token: e.target.value })}
                                className="w-full bg-black/50 border border-white/10 rounded-lg px-4 py-3 text-white focus:ring-2 focus:ring-purple-500/50 outline-none"
                                placeholder="Votre token"
                                required
                            />
                            <button
                                type="button"
                                onClick={handleGetPlexToken}
                                disabled={isPlexAuthenticating}
                                className="bg-zinc-700 hover:bg-zinc-600 text-white px-4 rounded-lg text-sm whitespace-nowrap transition-colors"
                                title="Récupérer via connexion Plex"
                            >
                                {isPlexAuthenticating ? '...' : 'Obtenir'}
                            </button>
                        </div>
                        {plexAuthStatus && <p className="text-xs text-yellow-500 mt-1">{plexAuthStatus}</p>}
                        <p className="text-xs text-zinc-500 mt-1">Vous pouvez trouver votre token dans le XML d'un média sur Plex Web.</p>
                    </div>

                    <div className="pt-4 flex justify-end">
                        <button
                            type="submit"
                            disabled={saving}
                            className="bg-purple-600 hover:bg-purple-500 text-white px-6 py-2 rounded-lg font-medium transition-colors disabled:opacity-50"
                        >
                            {saving ? 'Sauvegarde...' : 'Sauvegarder'}
                        </button>
                    </div>
                </form>
            </div>

            {/* Security Config */}
            <div className="bg-zinc-900/50 rounded-xl border border-white/5 p-6 h-fit">
                <h2 className="text-xl font-semibold mb-4 text-purple-400">Sécurité</h2>
                <p className="text-zinc-400 text-sm mb-6">
                    Modifiez votre mot de passe administrateur.
                </p>

                <form onSubmit={handleChangePassword} className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-zinc-400 mb-1">Mot de passe actuel</label>
                        <input
                            type="password"
                            value={passwords.currentPassword}
                            onChange={(e) => setPasswords({ ...passwords, currentPassword: e.target.value })}
                            className="w-full bg-black/50 border border-white/10 rounded-lg px-4 py-3 text-white focus:ring-2 focus:ring-purple-500/50 outline-none"
                            placeholder="••••••••"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-zinc-400 mb-1">Nouveau mot de passe</label>
                        <input
                            type="password"
                            value={passwords.newPassword}
                            onChange={(e) => setPasswords({ ...passwords, newPassword: e.target.value })}
                            className="w-full bg-black/50 border border-white/10 rounded-lg px-4 py-3 text-white focus:ring-2 focus:ring-purple-500/50 outline-none"
                            placeholder="••••••••"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-zinc-400 mb-1">Confirmer</label>
                        <input
                            type="password"
                            value={passwords.confirmPassword}
                            onChange={(e) => setPasswords({ ...passwords, confirmPassword: e.target.value })}
                            className="w-full bg-black/50 border border-white/10 rounded-lg px-4 py-3 text-white focus:ring-2 focus:ring-purple-500/50 outline-none"
                            placeholder="••••••••"
                        />
                    </div>

                    <div className="pt-4 flex justify-end">
                        <button
                            type="submit"
                            disabled={changingPassword}
                            className="bg-purple-600 hover:bg-purple-500 text-white px-6 py-2 rounded-lg font-medium transition-colors disabled:opacity-50"
                        >
                            {changingPassword ? 'Modification...' : 'Modifier'}
                        </button>
                    </div>
                </form>
            </div>

        </div>
    );
}
