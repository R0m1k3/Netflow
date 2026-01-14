import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/services/auth';
import { toast } from 'react-hot-toast';

export default function LoginPage() {
    const navigate = useNavigate();
    const location = useLocation();
    const { login } = useAuth();

    // Generic identifier for login (email or username)
    const [identifier, setIdentifier] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);

    const from = location.state?.from?.pathname || '/';

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);

        try {
            await login(identifier, password);
            toast.success('Connexion réussie');
            navigate(from, { replace: true });
        } catch (error: any) {
            console.error(error);
            toast.error(error.response?.data?.message || 'Une erreur est survenue');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center relative overflow-hidden bg-home-gradient">
            {/* Global background layer */}
            <div className="app-bg-fixed bg-home-gradient" />

            <div className="w-full max-w-md p-8 sm:p-12 rounded-xl bg-black/70 backdrop-blur-md border border-white/5 shadow-2xl relative z-10">
                <div className="text-center mb-8">
                    {/* Consistent Branding */}
                    <h1 className="text-4xl font-extrabold tracking-tight text-red-600 mb-6 drop-shadow-md">
                        NETFLOW
                    </h1>
                    <h2 className="text-xl font-medium text-white mb-2">
                        S'identifier
                    </h2>
                </div>

                <form onSubmit={handleSubmit} className="space-y-6">
                    <div>
                        <label className="hidden">Email ou Nom d'utilisateur</label>
                        <input
                            type="text"
                            value={identifier}
                            onChange={(e) => setIdentifier(e.target.value)}
                            className="w-full bg-neutral-700/50 border border-transparent rounded px-4 py-3 text-white placeholder-neutral-400 focus:outline-none focus:bg-neutral-700 focus:ring-2 focus:ring-neutral-500 transition-colors"
                            placeholder="Email ou nom d'utilisateur"
                            required
                        />
                    </div>

                    <div>
                        <label className="hidden">Mot de passe</label>
                        <input
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            className="w-full bg-neutral-700/50 border border-transparent rounded px-4 py-3 text-white placeholder-neutral-400 focus:outline-none focus:bg-neutral-700 focus:ring-2 focus:ring-neutral-500 transition-colors"
                            placeholder="Mot de passe"
                            required
                        />
                    </div>

                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full bg-red-600 hover:bg-red-700 text-white font-bold py-3 rounded transition-colors disabled:opacity-50 mt-4"
                    >
                        {loading ? 'Chargement...' : 'S\'identifier'}
                    </button>
                </form>
            </div>
        </div>
    );
}
