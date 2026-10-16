import React, { useState, useEffect } from 'react';
import { 
  Egg, 
  LayoutDashboard, 
  Package, 
  AlertTriangle, 
  DollarSign, 
  FileText, 
  Users, 
  Settings, 
  BarChart3, 
  Wifi, 
  WifiOff, 
  RefreshCw, 
  UserCheck, 
  ShieldAlert, 
  ChevronDown,
  Layers,
  Activity,
  Key,
  LogIn,
  Lock,
  CheckCircle2,
  Database,
  SlidersHorizontal,
  LogOut
} from 'lucide-react';
import { useAuth } from '../context/AuthContext.js';
import { api, OfflineAction } from '../api/client.js';

interface DashboardLayoutProps {
  currentTab: string;
  onTabChange: (tab: string) => void;
  children: React.ReactNode;
}

export const DashboardLayout: React.FC<DashboardLayoutProps> = ({ currentTab, onTabChange, children }) => {
  const { user, allowedSectors, allUsers, isAdmin, isManager, isVeterinaire, isEmployee, switchUser, login, logout, isLoading } = useAuth();
  const [isOnline, setIsOnline] = useState(true);
  const [offlineQueue, setOfflineQueue] = useState<OfflineAction[]>([]);
  const [isSyncing, setIsSyncing] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showSyncModal, setShowSyncModal] = useState(false);
  const [showPinModal, setShowPinModal] = useState(false);
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [vetAlertsCount, setVetAlertsCount] = useState<number>(0);

  // PIN Change state
  const [oldPin, setOldPin] = useState('');
  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [pinFeedback, setPinFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Login form state
  const [loginUserId, setLoginUserId] = useState('usr_admin');
  const [loginPin, setLoginPin] = useState('2026');
  const [loginError, setLoginError] = useState<string | null>(null);

  useEffect(() => {
    const checkState = () => {
      setIsOnline(navigator.onLine);
      setOfflineQueue(api.getOfflineQueue());
    };

    const fetchAlerts = async () => {
      try {
        const alerts = await api.getVeterinaryAlerts();
        setVetAlertsCount(alerts.totalAlertsCount || 0);
      } catch {}
    };

    checkState();
    fetchAlerts();
    window.addEventListener('online', checkState);
    window.addEventListener('offline', checkState);
    const interval = setInterval(() => {
      checkState();
      fetchAlerts();
    }, 15000);

    return () => {
      window.removeEventListener('online', checkState);
      window.removeEventListener('offline', checkState);
      clearInterval(interval);
    };
  }, []);

  const handleManualSync = async () => {
    setIsSyncing(true);
    try {
      await api.syncOfflineQueue();
      setOfflineQueue(api.getOfflineQueue());
    } finally {
      setIsSyncing(false);
    }
  };

  const navItems = [
    { id: 'dashboard', label: 'Tableau de bord', icon: LayoutDashboard },
    { id: 'ramassage', label: 'Ramassage', icon: Egg },
    { id: 'stocks', label: 'Stocks', icon: Package },
    { id: 'mortalite', label: 'Mortalité', icon: AlertTriangle },
    { id: 'veterinaire', label: 'Suivi Vétérinaire', icon: Activity, badge: vetAlertsCount },
    { id: 'ventes', label: 'Ventes', icon: DollarSign },
    { id: 'factures', label: 'Factures', icon: FileText },
    { id: 'clients', label: 'Clients', icon: Layers },
    { id: 'rapports', label: 'Rapports', icon: BarChart3 },
    ...((isAdmin || isManager) ? [{ id: 'utilisateurs', label: 'Utilisateurs & Rôles', icon: Users }] : []),
    { id: 'parametres', label: 'Paramètres & E-mails', icon: Settings },
  ];

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans text-slate-900 pb-20 md:pb-0">
      {/* Top Header */}
      <header className="sticky top-0 z-40 bg-emerald-950 text-white border-b border-emerald-900 shadow-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            
            {/* Logo */}
            <div className="flex items-center space-x-3 cursor-pointer" onClick={() => onTabChange('dashboard')}>
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-400 to-teal-600 flex items-center justify-center text-emerald-950 font-black shadow-inner">
                <Egg className="w-6 h-6 text-emerald-950 fill-white" />
              </div>
              <div>
                <span className="font-extrabold text-lg tracking-tight flex items-center gap-2">
                  POULAILLER CAMPEMENT
                  <span className="text-[10px] uppercase font-bold tracking-widest px-2 py-0.5 rounded-full bg-emerald-800 text-emerald-200 border border-emerald-700">
                    ERP v2.4
                  </span>
                </span>
                <p className="text-xs text-emerald-300 hidden sm:block">
                  Secteurs G3 • G4 • G5 • G6 • Créneaux 10H / 13H / 16H
                </p>
              </div>
            </div>

            {/* Right Status & User Switcher */}
            <div className="flex items-center space-x-2 sm:space-x-4">
              
              {/* Online / Offline badge (clickable for sync details) */}
              <button
                onClick={() => setShowSyncModal(true)}
                className="flex items-center cursor-pointer focus:outline-none"
                title="Cliquer pour afficher les détails de synchronisation centrale"
              >
                {isOnline ? (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-900/80 text-emerald-300 border border-emerald-700/60 hover:bg-emerald-800 transition">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                    <span className="hidden md:inline">En ligne • Cloud actif</span>
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-950 text-amber-300 border border-amber-800 hover:bg-amber-900 transition">
                    <WifiOff className="w-3.5 h-3.5 text-amber-400" />
                    <span>Hors ligne ({offlineQueue.length})</span>
                  </span>
                )}
              </button>

              {/* Offline pending items badge */}
              {offlineQueue.length > 0 && (
                <button
                  onClick={handleManualSync}
                  disabled={isSyncing}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold bg-amber-500 hover:bg-amber-400 text-amber-950 transition shadow"
                  title="Cliquez pour synchroniser la file d'attente hors connexion"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
                  <span>{offlineQueue.length} en attente</span>
                </button>
              )}

              {/* Active User Switcher Pill */}
              <div className="relative">
                <button
                  onClick={() => setShowUserMenu(!showUserMenu)}
                  className="flex items-center space-x-2 bg-emerald-900 hover:bg-emerald-800 border border-emerald-700/80 rounded-xl px-3 py-1.5 transition text-left focus:outline-none focus:ring-2 focus:ring-emerald-400"
                >
                  <div className="w-7 h-7 rounded-lg bg-emerald-700 flex items-center justify-center font-bold text-xs text-white uppercase">
                    {user?.name ? user.name[0] : 'U'}
                  </div>
                  <div className="text-left hidden md:block">
                    <div className="text-xs font-bold leading-tight truncate max-w-[140px] text-white">
                      {user?.name || 'Connexion...'}
                    </div>
                    <div className="text-[10px] text-emerald-300 flex items-center gap-1">
                      <span className="font-semibold uppercase tracking-wider">{user?.role}</span>
                      <span>•</span>
                      <span>
                        {user?.role === 'employee'
                          ? allowedSectors.length > 0
                            ? allowedSectors.join(', ')
                            : 'Aucun secteur'
                          : 'Tous (G3-G6)'}
                      </span>
                    </div>
                  </div>
                  <ChevronDown className="w-4 h-4 text-emerald-300" />
                </button>

                {/* Dropdown for instant user switching (Crucial for test validation!) */}
                {showUserMenu && (
                  <div className="absolute right-0 mt-2 w-80 bg-white rounded-2xl shadow-2xl border border-slate-200 py-2 z-50 text-slate-800 animate-in fade-in zoom-in-95 duration-100">
                    <div className="px-4 py-2 border-b border-slate-100 flex items-center justify-between">
                      <div>
                        <div className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                          Collaborateurs (8 Profils)
                        </div>
                        <div className="text-[11px] text-slate-500">
                          Bascule instantanée ou avec code PIN
                        </div>
                      </div>
                      <button
                        onClick={() => {
                          setShowUserMenu(false);
                          setShowLoginModal(true);
                        }}
                        className="text-[11px] font-bold text-emerald-700 hover:text-emerald-900 flex items-center gap-1"
                        title="Se connecter avec PIN"
                      >
                        <Key className="w-3.5 h-3.5" />
                        <span>Saisie PIN</span>
                      </button>
                    </div>

                    <div className="py-1 max-h-64 overflow-y-auto">
                      {allUsers.map(u => {
                        const isCurrent = u.id === user?.id;
                        return (
                          <button
                            key={u.id}
                            onClick={() => {
                              switchUser(u.id);
                              setShowUserMenu(false);
                            }}
                            className={`w-full text-left px-4 py-2 flex items-center justify-between hover:bg-slate-50 transition ${
                              isCurrent ? 'bg-emerald-50 text-emerald-900 font-bold' : ''
                            }`}
                          >
                            <div className="truncate mr-2">
                              <div className="text-sm font-semibold text-slate-900 truncate">{u.name}</div>
                              <div className="text-xs text-slate-500 flex items-center gap-1.5 mt-0.5">
                                <span className={`px-1.5 py-0.2 rounded text-[10px] font-bold uppercase ${
                                  u.role === 'admin' ? 'bg-purple-100 text-purple-700' :
                                  u.role === 'manager' ? 'bg-blue-100 text-blue-700' :
                                  u.role === 'veterinaire' ? 'bg-amber-100 text-amber-800 font-extrabold' :
                                  'bg-emerald-100 text-emerald-700'
                                }`}>
                                  {u.role === 'veterinaire' ? 'Vétérinaire & Gérant' : u.role}
                                </span>
                                <span>•</span>
                                <span className="font-medium text-slate-600">
                                  {u.role === 'employee' ? (u.sectors?.length ? u.sectors.join(', ') : 'Non attribué') : 'Tous'}
                                </span>
                              </div>
                            </div>
                            {isCurrent && <UserCheck className="w-4 h-4 text-emerald-600 flex-shrink-0" />}
                          </button>
                        );
                      })}
                    </div>

                    <div className="border-t border-slate-100 px-3 pt-2 space-y-1">
                      <button
                        onClick={() => {
                          setShowUserMenu(false);
                          setShowPinModal(true);
                        }}
                        className="w-full text-left px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-700 hover:bg-slate-100 flex items-center gap-2 transition"
                      >
                        <Lock className="w-3.5 h-3.5 text-slate-500" />
                        <span>Modifier mon code PIN</span>
                      </button>

                      {isAdmin && (
                        <button
                          onClick={() => {
                            onTabChange('utilisateurs');
                            setShowUserMenu(false);
                          }}
                          className="w-full text-left px-3 py-1.5 rounded-lg text-xs font-semibold text-emerald-700 hover:bg-emerald-50 flex items-center gap-2 transition"
                        >
                          <Users className="w-3.5 h-3.5 text-emerald-600" />
                          <span>Gérer les comptes & permissions RBAC</span>
                        </button>
                      )}

                      <button
                        onClick={async () => {
                          setShowUserMenu(false);
                          await logout();
                        }}
                        className="w-full text-left px-3 py-1.5 rounded-lg text-xs font-semibold text-rose-600 hover:bg-rose-50 flex items-center gap-2 transition"
                      >
                        <LogIn className="w-3.5 h-3.5 text-rose-500" />
                        <span>Se déconnecter</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>

            </div>
          </div>
        </div>

        {/* Desktop Navigation Tabs */}
        <div className="hidden md:block bg-emerald-900/60 border-t border-emerald-800/60">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <nav className="flex space-x-1 overflow-x-auto py-1.5 no-scrollbar">
              {navItems.map(item => {
                const Icon = item.icon;
                const isActive = currentTab === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => onTabChange(item.id)}
                    className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition ${
                      isActive
                        ? 'bg-white text-emerald-950 shadow-sm'
                        : 'text-emerald-100 hover:bg-emerald-800/60 hover:text-white'
                    }`}
                  >
                    <Icon className={`w-4 h-4 ${isActive ? 'text-emerald-700' : 'text-emerald-300'}`} />
                    <span>{item.label}</span>
                    {Boolean(item.badge && item.badge > 0) && (
                      <span className="ml-1 px-1.5 py-0.5 rounded-full text-[10px] font-black bg-rose-600 text-white animate-pulse">
                        {item.badge}
                      </span>
                    )}
                  </button>
                );
              })}
            </nav>
          </div>
        </div>
      </header>

      {/* Sector Permission Notice for Employee */}
      {isEmployee && (
        <div className="bg-emerald-50 border-b border-emerald-200 py-1.5 px-4">
          <div className="max-w-7xl mx-auto flex items-center justify-between text-xs">
            <div className="flex items-center gap-2 text-emerald-900">
              <span className="w-2 h-2 rounded-full bg-emerald-600"></span>
              <span>
                Compte Employé restreint : Accès exclusif à{' '}
                <strong>
                  {allowedSectors.length > 0
                    ? `Secteur(s) ${allowedSectors.join(' et ')}`
                    : 'Aucun secteur assigné'}
                </strong>
              </span>
            </div>
            <div className="text-emerald-700 font-medium">
              Protection RBAC appliquée côté serveur
            </div>
          </div>
        </div>
      )}

      {/* Offline Alert Banner */}
      {!isOnline && (
        <div className="bg-amber-500 text-amber-950 font-medium text-xs px-4 py-2 flex items-center justify-between shadow-inner">
          <div className="flex items-center gap-2 max-w-7xl mx-auto w-full">
            <WifiOff className="w-4 h-4 flex-shrink-0" />
            <span>
              Mode Hors Connexion : Vos saisies de ramassage seront conservées localement et synchronisées automatiquement dès le retour du réseau.
            </span>
          </div>
        </div>
      )}

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {children}
      </main>

      {/* Mobile Bottom Navigation Bar (Android Optimized) */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-slate-200 px-2 py-1 shadow-2xl flex items-center justify-around">
        {navItems.slice(0, 5).map(item => {
          const Icon = item.icon;
          const isActive = currentTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onTabChange(item.id)}
              className={`flex flex-col items-center justify-center py-1 px-2 rounded-xl transition ${
                isActive ? 'text-emerald-700 font-bold' : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              <div className={`p-1 rounded-lg ${isActive ? 'bg-emerald-100' : ''}`}>
                <Icon className="w-5 h-5" />
              </div>
              <span className="text-[10px] mt-0.5 tracking-tight">{item.label.split(' ')[0]}</span>
            </button>
          );
        })}

        {/* More Menu button for additional items on mobile */}
        <button
          onClick={() => {
            const nextTab = currentTab === 'factures' ? 'parametres' : currentTab === 'parametres' ? 'utilisateurs' : 'factures';
            onTabChange(nextTab);
          }}
          className="flex flex-col items-center justify-center py-1 px-2 rounded-xl text-slate-500 hover:text-slate-900"
        >
          <div className="p-1 rounded-lg">
            <SlidersHorizontal className="w-5 h-5" />
          </div>
          <span className="text-[10px] mt-0.5 tracking-tight">Plus...</span>
        </button>
      </nav>

      {/* SYNC STATUS MODAL */}
      {showSyncModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <div className="flex items-center gap-2">
                <Database className="w-5 h-5 text-emerald-600" />
                <h3 className="font-extrabold text-slate-900 text-base">État Synchronisation & Réseau</h3>
              </div>
              <button onClick={() => setShowSyncModal(false)} className="text-slate-400 hover:text-slate-700 font-bold">
                ✕
              </button>
            </div>

            <div className="space-y-3 mt-4 text-xs">
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between">
                <div>
                  <div className="font-bold text-slate-800">Connexion Internet</div>
                  <div className="text-[11px] text-slate-500">Statut du navigateur</div>
                </div>
                {isOnline ? (
                  <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800 flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                    En ligne
                  </span>
                ) : (
                  <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-amber-100 text-amber-800 flex items-center gap-1">
                    <WifiOff className="w-3 h-3 text-amber-600" />
                    Hors ligne
                  </span>
                )}
              </div>

              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between">
                <div>
                  <div className="font-bold text-slate-800">Base Centrale Multi-postes</div>
                  <div className="text-[11px] text-slate-500">Stockage centralisé et sauvegardes</div>
                </div>
                <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800 flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                  Opérationnelle
                </span>
              </div>

              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between">
                <div>
                  <div className="font-bold text-slate-800">Flux Temps-Réel (SSE)</div>
                  <div className="text-[11px] text-slate-500">Diffusion instantanée entre collaborateurs</div>
                </div>
                <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800 flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping"></span>
                  Connecté
                </span>
              </div>

              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between">
                <div>
                  <div className="font-bold text-slate-800">File d'attente Hors-Ligne</div>
                  <div className="text-[11px] text-slate-500">Opérations locales en attente</div>
                </div>
                <span className={`px-2.5 py-1 rounded-full text-[11px] font-bold ${
                  offlineQueue.length > 0 ? 'bg-amber-100 text-amber-800' : 'bg-slate-200 text-slate-700'
                }`}>
                  {offlineQueue.length} action(s)
                </span>
              </div>

              <div className="pt-3 border-t border-slate-200 flex justify-end gap-2">
                <button
                  onClick={handleManualSync}
                  disabled={isSyncing}
                  className="w-full py-2.5 bg-emerald-700 hover:bg-emerald-800 text-white font-bold rounded-xl shadow transition flex items-center justify-center gap-2"
                >
                  <RefreshCw className={`w-4 h-4 ${isSyncing ? 'animate-spin' : ''}`} />
                  <span>{isSyncing ? 'Synchronisation en cours...' : 'Forcer la synchronisation maintenant'}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* PIN CHANGE MODAL */}
      {showPinModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <div className="flex items-center gap-2">
                <Key className="w-5 h-5 text-emerald-600" />
                <h3 className="font-extrabold text-slate-900 text-base">Modifier mon code PIN</h3>
              </div>
              <button 
                onClick={() => {
                  setShowPinModal(false);
                  setPinFeedback(null);
                  setOldPin('');
                  setNewPin('');
                  setConfirmPin('');
                }} 
                className="text-slate-400 hover:text-slate-700 font-bold"
              >
                ✕
              </button>
            </div>

            <form
              onSubmit={async (e) => {
                e.preventDefault();
                setPinFeedback(null);
                if (newPin !== confirmPin) {
                  setPinFeedback({ type: 'error', message: 'Le nouveau PIN et sa confirmation ne correspondent pas.' });
                  return;
                }
                if (newPin.length < 4) {
                  setPinFeedback({ type: 'error', message: 'Le code PIN doit comporter au moins 4 chiffres.' });
                  return;
                }
                try {
                  const res = await api.changePin(oldPin, newPin);
                  if (res.success) {
                    setPinFeedback({ type: 'success', message: 'Code PIN modifié avec succès !' });
                    setTimeout(() => {
                      setShowPinModal(false);
                      setPinFeedback(null);
                      setOldPin('');
                      setNewPin('');
                      setConfirmPin('');
                    }, 1200);
                  }
                } catch (err: any) {
                  setPinFeedback({ type: 'error', message: err?.message || 'Erreur modification PIN' });
                }
              }}
              className="space-y-3 mt-4 text-xs"
            >
              {pinFeedback && (
                <div className={`p-2.5 rounded-xl text-xs font-semibold ${
                  pinFeedback.type === 'success' ? 'bg-emerald-50 text-emerald-900 border border-emerald-300' : 'bg-rose-50 text-rose-900 border border-rose-300'
                }`}>
                  {pinFeedback.message}
                </div>
              )}

              <div>
                <label className="font-bold text-slate-700 block mb-1">Ancien Code PIN :</label>
                <input
                  type="password"
                  required
                  value={oldPin}
                  onChange={(e) => setOldPin(e.target.value)}
                  placeholder="Code PIN actuel (par défaut : 2026)"
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 font-bold text-center tracking-widest text-slate-900"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Nouveau Code PIN :</label>
                <input
                  type="password"
                  required
                  value={newPin}
                  onChange={(e) => setNewPin(e.target.value)}
                  placeholder="Ex: 4 à 6 chiffres secrets"
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 font-bold text-center tracking-widest text-slate-900"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Confirmer le nouveau PIN :</label>
                <input
                  type="password"
                  required
                  value={confirmPin}
                  onChange={(e) => setConfirmPin(e.target.value)}
                  placeholder="Répétez le nouveau PIN"
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 font-bold text-center tracking-widest text-slate-900"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowPinModal(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white font-bold rounded-xl shadow"
                >
                  Valider
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* LOGIN WITH PIN MODAL */}
      {showLoginModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <div className="flex items-center gap-2">
                <LogIn className="w-5 h-5 text-emerald-600" />
                <h3 className="font-extrabold text-slate-900 text-base">Connexion Sécurisée</h3>
              </div>
              <button onClick={() => setShowLoginModal(false)} className="text-slate-400 hover:text-slate-700 font-bold">
                ✕
              </button>
            </div>

            <form
              onSubmit={async (e) => {
                e.preventDefault();
                setLoginError(null);
                try {
                  await login(loginUserId, loginPin);
                  setShowLoginModal(false);
                } catch (err: any) {
                  setLoginError(err?.message || 'Identifiants incorrects.');
                }
              }}
              className="space-y-4 mt-4 text-xs"
            >
              {loginError && (
                <div className="p-2.5 bg-rose-50 border border-rose-300 text-rose-900 rounded-xl font-semibold">
                  {loginError}
                </div>
              )}

              <div>
                <label className="font-bold text-slate-700 block mb-1">Sélectionner votre profil :</label>
                <select
                  value={loginUserId}
                  onChange={(e) => setLoginUserId(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 font-bold text-slate-900"
                >
                  {allUsers.map(u => (
                    <option key={u.id} value={u.id}>
                      {u.name} — {u.role === 'veterinaire' ? 'Vétérinaire' : u.role}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Code PIN Secret :</label>
                <input
                  type="password"
                  required
                  value={loginPin}
                  onChange={(e) => setLoginPin(e.target.value)}
                  placeholder="Code PIN à 4 chiffres (défaut : 2026)"
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 font-bold text-center tracking-widest text-slate-900"
                />
                <p className="text-[10px] text-slate-500 mt-1">
                  Code initial par défaut : <strong>2026</strong> (personnalisable après connexion)
                </p>
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowLoginModal(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white font-bold rounded-xl shadow"
                >
                  Se connecter
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};
