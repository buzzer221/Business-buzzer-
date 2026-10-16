import React, { useState, useEffect } from 'react';
import { 
  BarChart3, 
  Calendar, 
  Download, 
  RefreshCw, 
  TrendingUp, 
  Egg, 
  Award, 
  Layers,
  FileText
} from 'lucide-react';
import { api } from '../api/client.js';
import { useAuth } from '../context/AuthContext.js';
import { ALL_SECTORS, CollectionRecord, SectorId } from '../types/index.js';
import { DocumentExportModal } from '../components/DocumentExportModal.js';

export const RapportsPage: React.FC = () => {
  const { user, allowedSectors, isAdmin, isManager } = useAuth();
  const [collections, setCollections] = useState<CollectionRecord[]>([]);
  const [settings, setSettings] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showExportModal, setShowExportModal] = useState(false);

  const visibleSectors: SectorId[] = isAdmin || isManager
    ? ALL_SECTORS
    : ALL_SECTORS.filter(s => allowedSectors.includes(s));

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [cols, sett] = await Promise.all([
        api.getCollections(),
        api.getSettings(),
      ]);
      setCollections(cols);
      setSettings(sett);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [user?.id]);

  // Aggregate by sector (primary metric: PLATEAUX, with distinct broken & double yolk eggs)
  const sectorStats = visibleSectors.map(sec => {
    const secCols = collections.filter(c => c.sector === sec);
    const totalTrays = secCols.reduce((sum, c) => sum + (c.trays !== undefined ? c.trays : (c.quantity || 0)), 0);
    const totalBroken = secCols.reduce((sum, c) => sum + (c.brokenEggs !== undefined ? c.brokenEggs : (c.cracked || 0)), 0);
    const totalDoubleYolk = secCols.reduce((sum, c) => sum + (c.doubleYolkEggs || 0), 0);
    const totalDepositTrays = secCols.reduce((sum, c) => sum + (c.depositTrays !== undefined ? c.depositTrays : (c.deposit !== undefined ? c.deposit : (c.trays || c.quantity || 0))), 0);
    const flock = settings?.sectorFlocks?.[sec] || 2500;
    // Règle confirmée du projet : 1 plateau = 30 œufs
    const equivalentEggs = totalTrays * 30;
    const eggPerHen = flock > 0 ? (equivalentEggs / flock).toFixed(2) : '0';

    return {
      sector: sec,
      totalTrays,
      totalBroken,
      totalDoubleYolk,
      totalDepositTrays,
      equivalentEggs,
      totalEggs: totalTrays,
      totalCracked: totalBroken,
      totalDeposit: totalDepositTrays,
      flock,
      eggPerHen,
    };
  });

  const exportCSV = () => {
    const headers = 'Date,Créneau,Secteur,Plateaux,Oeufs_Equivalents_30pl,Oeufs_Casses,Double_Jaune,Depot_Stock_Plateaux,Operateur\n';
    const rows = collections
      .filter(c => visibleSectors.includes(c.sector))
      .map(c => {
        const tr = c.trays !== undefined ? c.trays : (c.quantity || 0);
        const brk = c.brokenEggs !== undefined ? c.brokenEggs : (c.cracked || 0);
        const dbl = c.doubleYolkEggs !== undefined ? c.doubleYolkEggs : 0;
        const dep = c.depositTrays !== undefined ? c.depositTrays : (c.deposit !== undefined ? c.deposit : tr);
        return `${c.date},${c.slot},${c.sector},${tr},${tr * 30},${brk},${dbl},${dep},"${c.recordedByName || ''}"`;
      })
      .join('\n');

    const blob = new Blob([headers + rows], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `campement_export_ramassage_plateaux_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
  };

  return (
    <div className="space-y-6">
      
      {/* Header */}
      <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight">
              Analyses & Rapports de Production
            </h1>
            <span className="bg-emerald-100 text-emerald-800 text-xs px-2.5 py-0.5 rounded-full font-bold">
              Indicateurs Zootechniques
            </span>
          </div>
          <p className="text-sm text-slate-500 mt-1">
            Performance comparée des bâtiments G3, G4, G5 et G6, taux de déclassement et exportations CSV.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => loadData()}
            className="p-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 transition"
            title="Actualiser"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          </button>

          <button
            onClick={() => setShowExportModal(true)}
            className="flex items-center gap-1.5 bg-emerald-800 hover:bg-emerald-900 text-white px-3.5 py-2.5 rounded-xl text-xs sm:text-sm font-bold shadow-md transition"
            title="Télécharger le rapport officiel en PDF, PNG ou JPG"
          >
            <FileText className="w-4 h-4" />
            <span>Fiche Rapport (PDF/PNG/JPG)</span>
          </button>

          <button
            onClick={exportCSV}
            className="flex items-center gap-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-300 px-3.5 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition"
          >
            <Download className="w-4 h-4 text-slate-600" />
            <span>CSV</span>
          </button>
        </div>
      </div>

      {/* Sector Performance Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {sectorStats.map(stat => (
          <div key={stat.sector} className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm space-y-3">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <span className="font-extrabold text-sm text-slate-900">Bâtiment {stat.sector}</span>
              <span className="text-[10px] uppercase font-bold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded">
                {stat.flock.toLocaleString()} poules
              </span>
            </div>

            <div>
              <div className="text-2xl font-black text-slate-900">
                {stat.totalTrays.toLocaleString('fr-FR')} <span className="text-sm font-bold text-emerald-800">pl.</span>
              </div>
              <div className="text-xs text-slate-500">
                soit {stat.equivalentEggs.toLocaleString('fr-FR')} œufs (base 30/pl.)
              </div>
            </div>

            <div className="pt-2 border-t border-slate-100 grid grid-cols-2 gap-2 text-xs">
              <div>
                <span className="text-slate-400 text-[10px] block">Dépôt Stock</span>
                <span className="font-bold text-emerald-700">{stat.totalDepositTrays.toLocaleString('fr-FR')} pl.</span>
              </div>
              <div>
                <span className="text-slate-400 text-[10px] block">Cassés / Déclassés</span>
                <span className="font-bold text-rose-600">{stat.totalBroken} œufs</span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Graphical Comparison Bar Visualizer */}
      <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm space-y-4">
        <h3 className="font-bold text-slate-900 text-base flex items-center gap-2">
          <BarChart3 className="w-5 h-5 text-emerald-700" />
          <span>Comparaison de Volume Récolté par Bâtiment (Plateaux)</span>
        </h3>

        <div className="space-y-4 pt-2">
          {sectorStats.map(stat => {
            const maxVal = Math.max(...sectorStats.map(s => s.totalTrays), 1);
            const pct = Math.round((stat.totalTrays / maxVal) * 100);

            return (
              <div key={stat.sector} className="space-y-1.5">
                <div className="flex items-center justify-between text-xs font-semibold text-slate-700">
                  <span className="flex items-center gap-2">
                    <span className="w-5 h-5 rounded bg-emerald-800 text-white font-bold text-[10px] flex items-center justify-center">
                      {stat.sector}
                    </span>
                    <span>Secteur {stat.sector}</span>
                  </span>
                  <span>{stat.totalTrays.toLocaleString('fr-FR')} plateaux ({stat.equivalentEggs.toLocaleString('fr-FR')} œufs)</span>
                </div>
                <div className="w-full bg-slate-100 rounded-full h-3 overflow-hidden">
                  <div
                    className="bg-emerald-600 h-3 rounded-full transition-all duration-700"
                    style={{ width: `${pct}%` }}
                  ></div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Production & Analysis Official Report Export Modal (PDF, PNG, JPG) */}
      {showExportModal && (
        <DocumentExportModal
          isOpen={showExportModal}
          onClose={() => setShowExportModal(false)}
          documentTitle="RAPPORT DE SYNTHÈSE ZOOTECHNIQUE & PRODUCTION"
          documentReference={`RAP-${new Date().toISOString().split('T')[0]}`}
          date={new Date().toISOString().split('T')[0]}
        >
          <div className="space-y-4">
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs flex justify-between items-center">
              <div>
                <span className="text-slate-500">Période d'analyse :</span>{' '}
                <strong className="text-slate-900">Production en exploitation</strong>
              </div>
              <div>
                <span className="text-slate-500">Effectif total :</span>{' '}
                <strong className="text-emerald-800 font-extrabold">
                  {sectorStats.reduce((sum, s) => sum + s.flock, 0).toLocaleString('fr-FR')} poules pondeuses
                </strong>
              </div>
            </div>

            {/* Performance Matrix */}
            <table className="w-full text-xs border-collapse border border-slate-300">
              <thead>
                <tr className="bg-slate-100 text-slate-700 font-extrabold text-[11px] uppercase">
                  <th className="p-2.5 border border-slate-300 text-left">Bâtiment</th>
                  <th className="p-2.5 border border-slate-300 text-center">Effectif</th>
                  <th className="p-2.5 border border-slate-300 text-center">Total Plateaux</th>
                  <th className="p-2.5 border border-slate-300 text-center text-rose-700">Cassés (œufs)</th>
                  <th className="p-2.5 border border-slate-300 text-center text-amber-700">Double Jaune (œufs)</th>
                  <th className="p-2.5 border border-slate-300 text-center bg-emerald-50 text-emerald-900">Dépôt (pl.)</th>
                  <th className="p-2.5 border border-slate-300 text-right">Rendement / Poule</th>
                </tr>
              </thead>
              <tbody>
                {sectorStats.map(stat => (
                  <tr key={stat.sector} className="border border-slate-300 text-center">
                    <td className="p-2.5 border border-slate-300 font-bold text-left bg-slate-50/70">
                      Secteur {stat.sector}
                    </td>
                    <td className="p-2.5 border border-slate-300 font-semibold text-slate-800">
                      {stat.flock.toLocaleString('fr-FR')}
                    </td>
                    <td className="p-2.5 border border-slate-300 font-black text-slate-900">
                      {stat.totalTrays.toLocaleString('fr-FR')} pl.
                      <span className="block text-[10px] text-slate-500 font-normal">({stat.equivalentEggs.toLocaleString('fr-FR')} œufs)</span>
                    </td>
                    <td className="p-2.5 border border-slate-300 font-bold text-rose-600">
                      {stat.totalBroken.toLocaleString('fr-FR')}
                    </td>
                    <td className="p-2.5 border border-slate-300 font-bold text-amber-600">
                      {stat.totalDoubleYolk.toLocaleString('fr-FR')}
                    </td>
                    <td className="p-2.5 border border-slate-300 font-extrabold text-emerald-800 bg-emerald-50/40">
                      {stat.totalDepositTrays.toLocaleString('fr-FR')} pl.
                    </td>
                    <td className="p-2.5 border border-slate-300 font-black text-slate-900 text-right">
                      {stat.eggPerHen} œuf/poule
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-slate-900 text-white font-extrabold text-xs">
                  <td className="p-3 border border-slate-800 text-left">TOTAL EXPLOITATION</td>
                  <td className="p-3 border border-slate-800 text-center">
                    {sectorStats.reduce((sum, s) => sum + s.flock, 0).toLocaleString('fr-FR')}
                  </td>
                  <td className="p-3 border border-slate-800 text-center text-emerald-300 font-black">
                    {sectorStats.reduce((sum, s) => sum + s.totalTrays, 0).toLocaleString('fr-FR')} pl.
                  </td>
                  <td className="p-3 border border-slate-800 text-center text-rose-300">
                    {sectorStats.reduce((sum, s) => sum + s.totalBroken, 0).toLocaleString('fr-FR')}
                  </td>
                  <td className="p-3 border border-slate-800 text-center text-amber-300">
                    {sectorStats.reduce((sum, s) => sum + s.totalDoubleYolk, 0).toLocaleString('fr-FR')}
                  </td>
                  <td className="p-3 border border-slate-800 text-center bg-emerald-800 text-white font-black">
                    {sectorStats.reduce((sum, s) => sum + s.totalDepositTrays, 0).toLocaleString('fr-FR')} pl.
                  </td>
                  <td className="p-3 border border-slate-800 text-right text-emerald-300">
                    {(sectorStats.reduce((sum, s) => sum + s.equivalentEggs, 0) / Math.max(1, sectorStats.reduce((sum, s) => sum + s.flock, 0))).toFixed(2)} moy.
                  </td>
                </tr>
              </tfoot>
            </table>

            {/* Signatures */}
            <div className="grid grid-cols-2 gap-8 pt-6 text-xs text-slate-500">
              <div className="border-t border-slate-300 pt-2 text-center">
                Visa du Responsable d'Élevage
              </div>
              <div className="border-t border-slate-300 pt-2 text-center">
                Visa de la Direction / Gérant
              </div>
            </div>
          </div>
        </DocumentExportModal>
      )}

    </div>
  );
};
