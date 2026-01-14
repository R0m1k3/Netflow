import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/services/auth';
import { toast } from 'react-hot-toast';

export default function LoginPage() {
    const navigate = useNavigate();
    const location = useLocation();
    const { login, register } = useAuth();
    const [isRegistering, setIsRegistering] = useState(false);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [username, setUsername] = useState('');
    const [loading, setLoading] = useState(false);

    const from = location.state?.from?.pathname || '/';

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);

        try {
            if (isRegistering) {
                await register(email, password, username);
                toast.success('Compte créé ! Veuillez vous connecter.');
                setIsRegistering(false);
            } else {
                await login(email, password);
                toast.success('Connexion réussie');
                navigate(from, { replace: true });
            }
        } catch (error: any) {
            console.error(error);
            toast.error(error.response?.data?.message || 'Une erreur est survenue');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-black/90 relative overflow-hidden">
            {/* Background elements */}
            <div className="absolute inset-0 bg-gradient-to-br from-purple-900/20 via-black to-blue-900/20 z-0" />

            <div className="w-full max-w-md p-8 rounded-2xl bg-zinc-900/80 backdrop-blur-xl border border-white/5 z-10 shadow-2xl">
                <div className="text-center mb-8">
                    <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-purple-400 to-blue-400">
                        Netflow
                    </h1>
                    <p className="text-zinc-400 mt-2">
                        {isRegistering ? 'Créez votre compte' : 'Bon retour parmi nous'}
                    </p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                    {isRegistering && (
                        <div>
                            <label className="block text-sm font-medium text-zinc-400 mb-1">Nom d'utilisateur</label>
                            <input
                                type="text"
                                value={username}
                                onChange={(e) => setUsername(e.target.value)}
                                className="w-full bg-black/50 border border-white/10 rounded-lg px-4 py-3 text-white focus:ring-2 focus:ring-purple-500/50 outline-none transition-all"
                                placeholder="Votre nom"
                                required
                            />
                        </div>
                    )}

                    <div>
                        <label className="block text-sm font-medium text-zinc-400 mb-1">Email</label>
                        <input
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            className="w-full bg-black/50 border border-white/10 rounded-lg px-4 py-3 text-white focus:ring-2 focus:ring-purple-500/50 outline-none transition-all"
                            placeholder="nom@exemple.com"
                            required
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-zinc-400 mb-1">Mot de passe</label>
                        <input
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            className="w-full bg-black/50 border border-white/10 rounded-lg px-4 py-3 text-white focus:ring-2 focus:ring-purple-500/50 outline-none transition-all"
                            placeholder="••••••••"
                            required
                        />
                    </div>

                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 text-white font-medium py-3 rounded-lg transition-all transform hover:scale-[1.02] disabled:opacity-50 disabled:cursor-not-allowed mt-6"
                    >
                        {loading ? 'Chargement...' : (isRegistering ? 'S\'inscrire' : 'Se connecter')}
                    </button>
                </form>

                <div className="mt-6 text-center">
                    <button
                        type="button"
                        onClick={() => setIsRegistering(!isRegistering)}
                        className="text-sm text-zinc-400 hover:text-white transition-colors"
                    >
                        {isRegistering ? 'Déjà un compte ? Se connecter' : 'Pas encore de compte ? S\'inscrire'}
                    </button>
                </div>
            </div>
        </div>
    );
}
