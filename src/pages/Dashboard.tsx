import React, { useState, useEffect } from 'react';
import { 
  Egg, 
  Layers, 
  TrendingUp, 
  AlertTriangle, 
  Clock, 
  CheckCircle2, 
  Mail, 
  ArrowUpRight, 
  ShieldCheck, 
  DollarSign, 
  Package, 
  Calendar,
  Sparkles
} from 'lucide-react';
import { api } from '../api/client.js';
import { useAuth } from '../context/AuthContext.js';
import { ALL_SECTORS, DailySummary, SectorId } from '../types/index.js';

interface DashboardPageProps {
  onNavigate: (tab: string) => void;
}

export const DashboardPage: React.FC<DashboardPageProps> = ({ onNavigate }) => {
  const { user, allowedSectors, isAdmin, isManager, isEmployee } = useAuth();
  
  const [summary, setSummary] = useState<DailySummary | null>(null);
  const [stockBalances, setStockBalances] = useState<any>({});
  const [recentMovements, setRecentMovements] = useState<any[]>([]);
  const [settings, setSettings] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);

  const today = new Date().toISOString().split('T')[0];

  useEffect(() => {
    const fetchData = async () => {
      try {
        setIsLoading(true);
        const [sum, balances, movements, conf] = await Promise.all([
          api.getDailySummary(today),
          api.getStockBalances(),
          api.getStockMovements(),
          api.getSettings(),
        ]);
        setSummary(sum);
        setStockBalances(balances);
        setRecentMovements(movements.slice(0, 5));
        setSettings(conf);
      } catch (err) {
        console.error('Erreur chargement dashboard:', err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();

    const unsub = api.onSyncEvent(() => {
      fetchData();
    });

    return () => {
      unsub();
    };
  }, [user?.id]);

  const visibleSectors: SectorId[] = isAdmin || isManager 
    ? ALL_SECTORS 
    : ALL_SECTORS.filter(s => allowedSectors.includes(s));

  // Compute total stock of standard eggs across visible sectors
  const totalStandardEggsStock = visibleSectors.reduce((sum, sec) => {
    return sum + (stockBalances[sec]?.oefsStandards || 0);
  }, (isAdmin || isManager ? stockBalances['CENTRAL']?.oefsStandards || 0 : 0));

  const totalTraysInStock = Math.floor(totalStandardEggsStock / 30);

  return (
    <div className="space-y-6">
      
      {/* Welcome Banner */}
      <div className="bg-gradient-to-r from-emerald-950 via-emerald-900 to-teal-950 text-white rounded-3xl p-6 sm:p-8 shadow-xl relative overflow-hidden">
        <div className="absolute right-0 top-0 bottom-0 w-1/3 bg-emerald-800/10 rounded-full blur-3xl pointer-events-none"></div>

        <div className="relative z-10 max-w-2xl">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-800/80 text-emerald-200 text-xs font-bold border border-emerald-700/60 mb-3">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
            <span>Exploitation Avicole Opérationnelle • {new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</span>
          </div>

          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
            Bonjour, {user?.name || 'Collaborateur'}
          </h1>
          <p className="text-sm text-emerald-200/90 mt-2 leading-relaxed">
            {isEmployee ? (
              <>
                Vous êtes connecté avec les accès restreints au(x) secteur(s) <strong>{allowedSectors.join(' et ') || 'Aucun'}</strong>. Vos données et indicateurs sont filtrés sur votre périmètre d'intervention.
              </>
            ) : (
              <>
                Vue de supervision globale active pour les secteurs <strong>G3, G4, G5 et G6</strong>. Suivez les ramassages de 10H, 13H et 16H, les dépôts en stock et les expéditions.
              </>
            )}
          </p>

          <div className="mt-6 flex flex-wrap gap-3">
            <button
              onClick={() => onNavigate('ramassage')}
              className="bg-emerald-500 hover:bg-emerald-400 text-emerald-950 font-bold px-4 py-2.5 rounded-xl text-xs sm:text-sm flex items-center gap-2 shadow-lg transition"
            >
              <Egg className="w-4 h-4 fill-emerald-950" />
              <span>Saisir le ramassage du jour</span>
            </button>

            <button
              onClick={() => onNavigate('stocks')}
              className="bg-emerald-900/80 hover:bg-emerald-800 text-white font-semibold px-4 py-2.5 rounded-xl text-xs sm:text-sm flex items-center gap-2 border border-emerald-700 transition"
            >
              <Package className="w-4 h-4 text-emerald-300" />
              <span>Consulter les stocks</span>
            </button>

            {isAdmin && (
              <button
                onClick={() => onNavigate('utilisateurs')}
                className="bg-emerald-900/80 hover:bg-emerald-800 text-white font-semibold px-4 py-2.5 rounded-xl text-xs sm:text-sm flex items-center gap-2 border border-emerald-700 transition"
              >
                <ShieldCheck className="w-4 h-4 text-emerald-300" />
                <span>Gérer les employés</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* KPI Highlights */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        
        {/* KPI 1: Trays Collected Today */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase text-slate-500">Ramassé Aujourd'hui</span>
            <div className="w-8 h-8 rounded-xl bg-emerald-100 flex items-center justify-center text-emerald-700">
              <Egg className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl sm:text-3xl font-black text-slate-900">
              {(summary?.totalTrays ?? summary?.totalEggs ?? 0).toLocaleString('fr-FR')} <span className="text-sm font-bold text-emerald-800">plateaux</span>
            </div>
            <div className="text-xs font-semibold text-emerald-700 mt-1 flex items-center gap-1">
              <span>{((summary?.totalTrays ?? summary?.totalEggs ?? 0) * 30).toLocaleString('fr-FR')} œufs (base 30/pl.)</span>
            </div>
          </div>
        </div>

        {/* KPI 2: Time Slots Status */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase text-slate-500">Créneaux 10H-13H-16H</span>
            <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${
              summary?.isComplete ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
            }`}>
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-lg sm:text-xl font-bold text-slate-900 flex items-center gap-1.5">
              {summary?.isComplete ? (
                <>
                  <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                  <span>3 / 3 Validés</span>
                </>
              ) : (
                <span className="text-amber-700 font-bold">En cours de journée</span>
              )}
            </div>
            <div className="text-xs text-slate-500 mt-1">
              {summary?.isComplete ? 'Journée clôturée' : 'Dernier créneau attendu'}
            </div>
          </div>
        </div>

        {/* KPI 3: Stock Standard Eggs */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase text-slate-500">Stock Disponible</span>
            <div className="w-8 h-8 rounded-xl bg-blue-100 flex items-center justify-center text-blue-700">
              <Package className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl sm:text-3xl font-black text-slate-900">
              {(totalTraysInStock || 0).toLocaleString('fr-FR')}
            </div>
            <div className="text-xs font-semibold text-slate-500 mt-1">
              plateaux ({(totalStandardEggsStock || 0).toLocaleString('fr-FR')} œufs)
            </div>
          </div>
        </div>

        {/* KPI 4: Email Recap Status */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase text-slate-500">Notification E-mail</span>
            <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${
              summary?.emailSent ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'
            }`}>
              <Mail className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-sm font-bold text-slate-900 truncate">
              {summary?.emailSent ? '✅ Envoyé à boubacarsene8' : '⏳ En attente de 16H'}
            </div>
            <div className="text-xs text-slate-500 mt-1">
              Non-bloquant • Journalisé
            </div>
          </div>
        </div>

      </div>

      {/* Sector Breakdown Grid */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
            <span>Périmètre de Production</span>
            <span className="text-xs font-normal text-slate-500">
              ({visibleSectors.length} secteur{visibleSectors.length > 1 ? 's' : ''} visible{visibleSectors.length > 1 ? 's' : ''})
            </span>
          </h2>
          <button
            onClick={() => onNavigate('ramassage')}
            className="text-xs font-bold text-emerald-700 hover:text-emerald-800 flex items-center gap-1"
          >
            <span>Détail complet des créneaux</span>
            <ArrowUpRight className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {visibleSectors.map(sec => {
            const secData = summary?.bySector?.[sec];
            const secTrays = secData?.trays ?? secData?.total ?? 0;
            const secBroken = secData?.brokenEggs ?? secData?.cracked ?? 0;
            const secDouble = secData?.doubleYolkEggs ?? 0;
            const flock = settings?.sectorFlocks?.[sec] || 2500;
            // Laying rate calculated using verified 30 eggs per tray
            const layingRate = flock > 0 ? (((secTrays * 30) / flock) * 100).toFixed(1) : '0';

            return (
              <div key={sec} className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm hover:border-emerald-300 transition">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-7 h-7 rounded-lg bg-emerald-800 text-white font-black text-xs flex items-center justify-center">
                      {sec}
                    </span>
                    <span className="font-bold text-slate-900 text-sm">Secteur {sec}</span>
                  </div>
                  <span className="text-[11px] font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">
                    {(Number(flock) || 0).toLocaleString()} poules
                  </span>
                </div>

                <div className="mt-4">
                  <div className="text-2xl font-black text-slate-900">
                    {secTrays.toLocaleString('fr-FR')} <span className="text-sm font-bold text-emerald-800">plateaux</span>
                  </div>
                  <div className="text-xs font-medium text-slate-500">
                    soit {(secTrays * 30).toLocaleString('fr-FR')} œufs récoltés (30/pl.)
                  </div>
                </div>

                {/* Progress bar of laying rate */}
                <div className="mt-3">
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="text-slate-500 font-medium">Taux de ponte :</span>
                    <span className="font-bold text-emerald-700">{layingRate}%</span>
                  </div>
                  <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                    <div
                      className="bg-emerald-500 h-2 rounded-full transition-all duration-500"
                      style={{ width: `${Math.min(100, Math.max(0, parseFloat(layingRate)))}%` }}
                    ></div>
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
                  <span>Dépôt : <strong className="text-emerald-800 font-bold">{secTrays} pl.</strong></span>
                  <span>Cassés : <strong className="text-rose-600 font-bold">{secBroken}</strong></span>
                  {secDouble > 0 && <span>DJ : <strong className="text-amber-600 font-bold">{secDouble}</strong></span>}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Recent Activity and Stock Alerts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Recent Stock Movements */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
              <Package className="w-4 h-4 text-emerald-700" />
              <span>Derniers mouvements de stock</span>
            </h3>
            <button
              onClick={() => onNavigate('stocks')}
              className="text-xs font-bold text-emerald-700 hover:text-emerald-800"
            >
              Voir tout
            </button>
          </div>

          <div className="space-y-3">
            {recentMovements.length === 0 ? (
              <p className="text-xs text-slate-400 py-4 text-center">Aucun mouvement récent</p>
            ) : (
              recentMovements.map(m => (
                <div key={m.id} className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-100 text-xs">
                  <div>
                    <div className="font-bold text-slate-900">{m.reason}</div>
                    <div className="text-[11px] text-slate-500 mt-0.5">
                      Secteur {m.sector} • Par {m.performedByName || 'Opérateur'}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className={`font-black ${
                      m.movementType === 'ENTREE' || m.movementType === 'DEPOT_RAMASSAGE' 
                        ? 'text-emerald-700' 
                        : 'text-slate-900'
                    }`}>
                      {m.movementType === 'ENTREE' || m.movementType === 'DEPOT_RAMASSAGE' ? '+' : '-'}
                      {(Number(m?.quantity) || 0).toLocaleString('fr-FR')} {m.itemType === 'OEFS_STANDARDS' ? 'œufs' : 'unités'}
                    </div>
                    <div className="text-[10px] text-slate-400">
                      {new Date(m.timestamp).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Operating Rules & Instructions */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm flex flex-col justify-between">
          <div>
            <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2 mb-3">
              <ShieldCheck className="w-4 h-4 text-emerald-700" />
              <span>Règles Métier de l'Exploitation POULAILLER CAMPEMENT</span>
            </h3>

            <div className="space-y-2.5 text-xs text-slate-600">
              <div className="p-3 bg-emerald-50/70 border border-emerald-200 rounded-xl">
                <strong className="text-emerald-900 block mb-0.5">1. Horaires réglementaires de ramassage :</strong>
                Effectuer les saisies strictes aux créneaux <strong>10H</strong>, <strong>13H</strong> et <strong>16H</strong>.
              </div>

              <div className="p-3 bg-blue-50/70 border border-blue-200 rounded-xl">
                <strong className="text-blue-900 block mb-0.5">2. Envoi du rapport e-mail complet :</strong>
                L'e-mail automatique à <code>boubacarsene8@gmail.com</code> n'est déclenché qu'une fois les 3 créneaux complétés. Aucun e-mail partiel n'est envoyé.
              </div>

              <div className="p-3 bg-amber-50/70 border border-amber-200 rounded-xl">
                <strong className="text-amber-900 block mb-0.5">3. Droits d'accès et sectorisation (RBAC) :</strong>
                Chaque employé ne peut saisir et visualiser que les bâtiments qui lui sont affectés. La gérante (Awa Gassama), le vétérinaire (M. Ndour) et l'administrateur supervisent l'ensemble des secteurs G3, G4, G5, G6.
              </div>

              <div className="p-3 bg-rose-50/70 border border-rose-200 rounded-xl">
                <strong className="text-rose-900 block mb-0.5">4. Suivi sanitaire et prescriptions :</strong>
                Les médicaments, vaccins et protocoles de traitement sont validés sous la responsabilité du vétérinaire M. Ndour.
              </div>
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
            <span>POULAILLER CAMPEMENT • Domaine Avicole</span>
            <span className="font-mono text-[10px]">Cloud Sync OK</span>
          </div>
        </div>

      </div>

    </div>
  );
};
