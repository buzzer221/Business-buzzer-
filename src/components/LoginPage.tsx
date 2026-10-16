import React, { useState } from 'react';
import { Egg, Lock, Key, ShieldCheck, ArrowRight, AlertCircle, CheckCircle2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext.js';

export const LoginPage: React.FC = () => {
  const { allUsers, login } = useAuth();
  const [selectedUserId, setSelectedUserId] = useState<string>('usr_admin');
  const [pin, setPin] = useState<string>('2026');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      await login(selectedUserId, pin);
    } catch (err: any) {
      setError(err?.message || 'Identifiant ou code PIN incorrect.');
    } finally {
      setIsLoading(false);
    }
  };

  const selectedUser = allUsers.find(u => u.id === selectedUserId);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-center items-center p-4 relative overflow-hidden font-sans">
      {/* Background Glow */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-96 h-96 bg-emerald-600/10 rounded-full blur-3xl pointer-events-none"></div>

      <div className="max-w-md w-full relative z-10">
        
        {/* Header Logo */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 mx-auto rounded-2xl bg-gradient-to-br from-emerald-400 to-teal-600 flex items-center justify-center text-emerald-950 font-black shadow-xl shadow-emerald-950/50 mb-3 border border-emerald-300/30">
            <Egg className="w-10 h-10 text-emerald-950 fill-white" />
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
            POULAILLER CAMPEMENT
          </h1>
          <p className="text-xs sm:text-sm text-emerald-300 font-semibold mt-1">
            Système Central Multi-Utilisateurs & Synchronisation Cloud
          </p>
          <div className="mt-2 inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full bg-emerald-950/80 border border-emerald-800 text-[11px] text-emerald-400 font-bold">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
            <span>Authentification Sécurisée par Code PIN</span>
          </div>
        </div>

        {/* Card */}
        <div className="bg-slate-900/90 backdrop-blur-md rounded-3xl p-6 sm:p-8 border border-slate-800 shadow-2xl">
          <h2 className="text-base font-extrabold text-white mb-4 flex items-center gap-2">
            <Lock className="w-4 h-4 text-emerald-400" />
            <span>Connexion à votre espace collaborateur</span>
          </h2>

          {error && (
            <div className="mb-4 p-3 bg-rose-950/80 border border-rose-800/80 text-rose-200 text-xs rounded-xl flex items-center gap-2 animate-shake">
              <AlertCircle className="w-4 h-4 text-rose-400 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5 text-xs">
            {/* User Select */}
            <div>
              <label className="font-bold text-slate-300 block mb-1.5">
                Sélectionnez votre compte :
              </label>
              <select
                value={selectedUserId}
                onChange={(e) => setSelectedUserId(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl p-3 text-white font-bold text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-none"
              >
                {allUsers.map(u => (
                  <option key={u.id} value={u.id} className="bg-slate-900 text-white py-1">
                    {u.name} — {u.role === 'veterinaire' ? 'Vétérinaire & Gérant' : u.role.toUpperCase()}
                  </option>
                ))}
              </select>

              {selectedUser && (
                <div className="mt-2 p-2.5 bg-slate-800/60 rounded-xl border border-slate-800 text-[11px] text-slate-400 flex items-center justify-between">
                  <span>
                    Rôle : <strong className="text-emerald-400 uppercase">{selectedUser.role}</strong>
                  </span>
                  <span>
                    Secteur(s) : <strong className="text-white">
                      {selectedUser.role === 'employee'
                        ? selectedUser.sectors?.join(', ') || 'Non assigné'
                        : 'Tous (G3, G4, G5, G6)'}
                    </strong>
                  </span>
                </div>
              )}
            </div>

            {/* PIN Code Input */}
            <div>
              <label className="font-bold text-slate-300 block mb-1.5">
                Code PIN Secret :
              </label>
              <div className="relative">
                <input
                  type="password"
                  required
                  value={pin}
                  onChange={(e) => setPin(e.target.value.replace(/[^0-9]/g, ''))}
                  placeholder="Ex: 2026"
                  maxLength={8}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl p-3 font-mono text-center tracking-[0.4em] text-lg font-black text-emerald-400 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                />
                <Key className="w-4 h-4 text-slate-500 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>
              <div className="mt-1.5 flex items-center justify-between text-[11px] text-slate-400">
                <span>Code initial par défaut : <strong className="text-emerald-400 font-mono">2026</strong></span>
                <span className="text-slate-500">4 chiffres min.</span>
              </div>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isLoading || !pin}
              className="w-full py-3.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-extrabold text-sm rounded-xl shadow-lg shadow-emerald-900/50 flex items-center justify-center gap-2 transition disabled:opacity-50"
            >
              <span>{isLoading ? 'Vérification...' : 'Ouvrir la session'}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>

          {/* Security details footer */}
          <div className="mt-6 pt-4 border-t border-slate-800/80 text-[11px] text-slate-400 space-y-1.5">
            <div className="flex items-center gap-1.5 text-emerald-400 font-bold">
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>Base centrale synchronisée et sécurisée</span>
            </div>
            <p className="text-slate-500 leading-normal">
              Contrôle strict des accès au niveau du serveur. Vos saisies de ramassage sont automatiquement répercutées auprès des autres membres autorisés.
            </p>
          </div>
        </div>

      </div>
    </div>
  );
};
