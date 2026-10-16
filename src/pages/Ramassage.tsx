import React, { useState, useEffect, useMemo } from 'react';
import { 
  Egg, 
  Calendar, 
  CheckCircle2, 
  Clock, 
  Mail, 
  Send, 
  AlertCircle, 
  RefreshCw, 
  Save, 
  Eye, 
  Layers, 
  ShieldCheck, 
  Check, 
  Download, 
  FileText, 
  Image as ImageIcon,
  Trash2
} from 'lucide-react';
import { api } from '../api/client.js';
import { useAuth } from '../context/AuthContext.js';
import { ALL_SECTORS, CollectionRecord, DailySummary, SectorId, SLOTS, SlotTime } from '../types/index.js';
import { DocumentExportModal } from '../components/DocumentExportModal.js';
import { DeleteConfirmModal } from '../components/DeleteConfirmModal.js';

export const RamassagePage: React.FC = () => {
  const { user, allowedSectors, isAdmin, isManager, isEmployee } = useAuth();
  
  const [selectedDate, setSelectedDate] = useState<string>(() => new Date().toISOString().split('T')[0]);
  const [collections, setCollections] = useState<CollectionRecord[]>([]);
  const [summary, setSummary] = useState<DailySummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isSendingEmail, setIsSendingEmail] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error' | 'info'; message: string } | null>(null);
  const [showEmailPreview, setShowEmailPreview] = useState(false);
  const [showExportModal, setShowExportModal] = useState(false);
  const [deleteSlotTarget, setDeleteSlotTarget] = useState<{ sec: SectorId; slot: SlotTime; trays?: number } | null>(null);

  // Active sectors to display: for employee, strictly limited to assigned sectors
  const visibleSectors: SectorId[] = useMemo(() => {
    if (isAdmin || isManager) return ALL_SECTORS;
    return ALL_SECTORS.filter(s => allowedSectors.includes(s));
  }, [isAdmin, isManager, allowedSectors]);

  // Form input matrix: [sector][slot] = { trays, brokenEggs, doubleYolkEggs, depositTrays }
  // Primary unit: NOMBRE DE PLATEAUX
  // Cassés et Double Jaune: comptabilisés individuellement en unités d'œufs
  const [formValues, setFormValues] = useState<Record<string, Record<string, { trays: string; brokenEggs: string; doubleYolkEggs: string; depositTrays: string }>>>({});
  const [collectionMeta, setCollectionMeta] = useState<Record<string, { updatedAt?: string; recordedByName?: string }>>({});

  const loadData = async (dateToLoad: string, preserveFeedback = false) => {
    setIsLoading(true);
    if (!preserveFeedback) setFeedback(null);
    try {
      const [cols, sum] = await Promise.all([
        api.getCollections(dateToLoad),
        api.getDailySummary(dateToLoad),
      ]);
      setCollections(cols);
      setSummary(sum);

      // Build form matrix in PLATEAUX and metadata map
      const matrix: Record<string, Record<string, { trays: string; brokenEggs: string; doubleYolkEggs: string; depositTrays: string }>> = {};
      const meta: Record<string, { updatedAt?: string; recordedByName?: string }> = {};

      for (const sec of ALL_SECTORS) {
        matrix[sec] = {};
        for (const slot of SLOTS) {
          const found = cols.find(c => c.sector === sec && c.slot === slot);
          const tr = found ? (found.trays !== undefined ? found.trays : (found.quantity || 0)) : '';
          const brk = found ? (found.brokenEggs !== undefined ? found.brokenEggs : (found.cracked || 0)) : '';
          const dbl = found ? (found.doubleYolkEggs !== undefined ? found.doubleYolkEggs : 0) : '';
          const dep = found ? (found.depositTrays !== undefined ? found.depositTrays : (found.deposit !== undefined ? found.deposit : tr)) : '';

          matrix[sec][slot] = {
            trays: tr !== '' && tr !== 0 ? String(tr) : (found && tr === 0 ? '0' : ''),
            brokenEggs: brk !== '' && brk !== 0 ? String(brk) : (found && brk === 0 ? '0' : ''),
            doubleYolkEggs: dbl !== '' && dbl !== 0 ? String(dbl) : (found && dbl === 0 ? '0' : ''),
            depositTrays: dep !== '' && dep !== 0 ? String(dep) : (found && dep === 0 ? '0' : ''),
          };

          if (found) {
            meta[`${sec}_${slot}`] = {
              updatedAt: found.updatedAt,
              recordedByName: found.recordedByName,
            };
          }
        }
      }
      setFormValues(matrix);
      setCollectionMeta(meta);
    } catch (err: any) {
      setFeedback({ type: 'error', message: err?.message || 'Erreur lors du chargement des données' });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData(selectedDate);
  }, [selectedDate, user?.id]);

  // Real-time synchronization: listen to cloud events from other connected devices
  useEffect(() => {
    const unsubscribe = api.onSyncEvent((event) => {
      if (event.type === 'collection') {
        const eventDate = event.data?.date;
        if (!eventDate || eventDate === selectedDate) {
          loadData(selectedDate, true);
          setFeedback({
            type: 'info',
            message: `⚡ Synchronisation automatique : ${event.userName || 'Un collaborateur'} a mis à jour le secteur ${event.data?.sector || ''} (${event.data?.slot || ''})`,
          });
        }
      }
    });

    return () => {
      unsubscribe();
    };
  }, [selectedDate]);

  const handleInputChange = (
    sec: SectorId, 
    slot: SlotTime, 
    field: 'trays' | 'brokenEggs' | 'doubleYolkEggs' | 'depositTrays', 
    value: string
  ) => {
    // Only allow positive integer numbers
    const cleanVal = value.replace(/[^0-9]/g, '');

    setFormValues(prev => {
      const secData = prev[sec] ? { ...prev[sec] } : {};
      const slotData = secData[slot] ? { ...secData[slot] } : { trays: '', brokenEggs: '', doubleYolkEggs: '', depositTrays: '' };

      const updatedSlot = { ...slotData, [field]: cleanVal };

      // By default, deposit in stock equals collected trays if deposit wasn't manually overridden
      if (field === 'trays' && (!slotData.depositTrays || slotData.depositTrays === slotData.trays)) {
        updatedSlot.depositTrays = cleanVal;
      }

      return {
        ...prev,
        [sec]: {
          ...secData,
          [slot]: updatedSlot,
        },
      };
    });
  };

  const handleSaveSlot = async (sec: SectorId, slot: SlotTime, forceOverride = false) => {
    const val = formValues[sec]?.[slot];
    if (!val || val.trays === '') {
      setFeedback({ type: 'error', message: `Veuillez renseigner le nombre de plateaux pour le secteur ${sec} à ${slot}.` });
      return;
    }

    const tr = parseInt(val.trays, 10) || 0;
    const brk = parseInt(val.brokenEggs, 10) || 0;
    const dbl = parseInt(val.doubleYolkEggs, 10) || 0;
    const dep = val.depositTrays !== '' ? (parseInt(val.depositTrays, 10) || 0) : tr;

    setIsSaving(true);
    setFeedback(null);

    try {
      const knownMeta = collectionMeta[`${sec}_${slot}`];
      const res = await api.saveCollection({
        date: selectedDate,
        slot,
        sector: sec,
        trays: tr,
        brokenEggs: brk,
        doubleYolkEggs: dbl,
        depositTrays: dep,
        quantity: tr,
        cracked: brk,
        deposit: dep,
        lastKnownUpdatedAt: forceOverride ? undefined : knownMeta?.updatedAt,
        force: forceOverride,
      });

      setSummary(res.dailySummary);
      setFeedback({ 
        type: 'success', 
        message: `Ramassage ${slot} du secteur ${sec} enregistré : ${tr.toLocaleString('fr-FR')} plateaux (dépôt : ${dep} pl. • ${brk} œuf(s) cassé(s) • ${dbl} double jaune).` 
      });

      await loadData(selectedDate, true);
    } catch (err: any) {
      if (err.message?.includes('Conflit') || err.conflict) {
        setFeedback({ 
          type: 'error', 
          message: `⚠️ ${err.message} Vos données locales ont été actualisées avec la version du serveur.` 
        });
        await loadData(selectedDate, true);
      } else {
        setFeedback({ type: 'error', message: err?.message || 'Erreur lors de l\'enregistrement' });
      }
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteSlot = async (reason: string, opPass?: string) => {
    if (!deleteSlotTarget) return;
    try {
      const key = `${selectedDate}_${deleteSlotTarget.sec}_${deleteSlotTarget.slot}`;
      await api.deleteCollection(key, reason, opPass);
      setFeedback({
        type: 'success',
        message: `Ramassage ${deleteSlotTarget.slot} (Secteur ${deleteSlotTarget.sec}) du ${selectedDate} supprimé avec succès par l'Administrateur principal.`,
      });
      setDeleteSlotTarget(null);
      await loadData(selectedDate);
    } catch (err: any) {
      setFeedback({ type: 'error', message: err?.message || 'Erreur lors de la suppression du ramassage' });
    }
  };

  const handleSaveAllVisible = async () => {
    setIsSaving(true);
    setFeedback(null);
    let savedCount = 0;

    try {
      for (const sec of visibleSectors) {
        for (const slot of SLOTS) {
          const val = formValues[sec]?.[slot];
          if (val && val.trays !== '') {
            const tr = parseInt(val.trays, 10) || 0;
            const brk = parseInt(val.brokenEggs, 10) || 0;
            const dbl = parseInt(val.doubleYolkEggs, 10) || 0;
            const dep = val.depositTrays !== '' ? (parseInt(val.depositTrays, 10) || 0) : tr;

            await api.saveCollection({
              date: selectedDate,
              slot,
              sector: sec,
              trays: tr,
              brokenEggs: brk,
              doubleYolkEggs: dbl,
              depositTrays: dep,
              quantity: tr,
              cracked: brk,
              deposit: dep,
            });
            savedCount++;
          }
        }
      }

      setFeedback({
        type: 'success',
        message: `${savedCount} créneaux sauvegardés avec succès en nombre de plateaux. Les dépôts en stock ont été actualisés.`,
      });

      await loadData(selectedDate);
    } catch (err: any) {
      setFeedback({ type: 'error', message: err?.message || 'Erreur lors de la sauvegarde globale' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleTriggerEmail = async (force: boolean = false) => {
    setIsSendingEmail(true);
    setFeedback(null);
    try {
      const res = await api.triggerEmail(selectedDate, force);
      if (res.success) {
        setFeedback({
          type: 'success',
          message: `Rapport quotidien complet envoyé avec succès à ${summary?.emailRecipient || 'boubacarsene8@gmail.com'}.`,
        });
        await loadData(selectedDate);
      } else {
        setFeedback({
          type: 'error',
          message: res.error || 'Impossible d\'envoyer le rapport e-mail.',
        });
      }
    } catch (err: any) {
      setFeedback({ type: 'error', message: err?.message || 'Erreur lors de l\'envoi de l\'e-mail' });
    } finally {
      setIsSendingEmail(false);
    }
  };

  // Live calculations strictly separating PLATEAUX and INDIVIDUAL EGGS
  // No mixing in direct addition. Rule defined in project: 1 plateau = 30 eggs for explicit conversions.
  const liveTotals = useMemo(() => {
    const sectorTotals: Record<string, { trays: number; brokenEggs: number; doubleYolkEggs: number; depositTrays: number }> = {};
    const slotTotals: Record<string, { trays: number; brokenEggs: number; doubleYolkEggs: number }> = {
      '10H': { trays: 0, brokenEggs: 0, doubleYolkEggs: 0 },
      '13H': { trays: 0, brokenEggs: 0, doubleYolkEggs: 0 },
      '16H': { trays: 0, brokenEggs: 0, doubleYolkEggs: 0 },
    };
    let grandTrays = 0;
    let grandBroken = 0;
    let grandDouble = 0;
    let grandDepositTrays = 0;

    for (const sec of visibleSectors) {
      sectorTotals[sec] = { trays: 0, brokenEggs: 0, doubleYolkEggs: 0, depositTrays: 0 };
      for (const slot of SLOTS) {
        const item = formValues[sec]?.[slot];
        if (item) {
          const tr = parseInt(item.trays, 10) || 0;
          const brk = parseInt(item.brokenEggs, 10) || 0;
          const dbl = parseInt(item.doubleYolkEggs, 10) || 0;
          const dep = item.depositTrays !== '' ? (parseInt(item.depositTrays, 10) || 0) : tr;

          sectorTotals[sec].trays += tr;
          sectorTotals[sec].brokenEggs += brk;
          sectorTotals[sec].doubleYolkEggs += dbl;
          sectorTotals[sec].depositTrays += dep;

          slotTotals[slot].trays += tr;
          slotTotals[slot].brokenEggs += brk;
          slotTotals[slot].doubleYolkEggs += dbl;

          grandTrays += tr;
          grandBroken += brk;
          grandDouble += dbl;
          grandDepositTrays += dep;
        }
      }
    }

    return { 
      sectorTotals, 
      slotTotals, 
      grandTrays, 
      grandBroken, 
      grandDouble, 
      grandDepositTrays,
      equivalentGrandEggs: grandTrays * 30, // Conversion explicite vérifiée
    };
  }, [formValues, visibleSectors]);

  // Check completeness for visible sectors
  const missingSlots = useMemo(() => {
    const missing: Array<{ sector: SectorId; slot: SlotTime }> = [];
    for (const sec of visibleSectors) {
      for (const slot of SLOTS) {
        const item = formValues[sec]?.[slot];
        if (!item || item.trays === '' || parseInt(item.trays, 10) <= 0) {
          missing.push({ sector: sec, slot });
        }
      }
    }
    return missing;
  }, [formValues, visibleSectors]);

  const isDayFullyComplete = summary?.isComplete;

  return (
    <div className="space-y-6">
      
      {/* Header & Date Selector */}
      <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight">
              Ramassage Quotidien des Œufs
            </h1>
            <span className="bg-emerald-100 text-emerald-800 text-xs px-2.5 py-0.5 rounded-full font-bold">
              Comptabilisation en NOMBRE DE PLATEAUX
            </span>
          </div>
          <p className="text-sm text-slate-500 mt-1">
            Feuille de collecte des secteurs <strong>{visibleSectors.join(', ')}</strong>. La collecte principale est saisie en <strong>plateaux</strong>, avec distinction stricte des œufs cassés et à double jaune.
          </p>
        </div>

        {/* Date Selector & Action buttons */}
        <div className="flex items-center flex-wrap gap-2">
          <div className="flex items-center bg-slate-50 border border-slate-300 rounded-xl px-3 py-1.5 focus-within:ring-2 focus-within:ring-emerald-500">
            <Calendar className="w-4 h-4 text-slate-500 mr-2" />
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="bg-transparent text-sm font-semibold text-slate-800 focus:outline-none"
            />
          </div>

          <button
            onClick={() => loadData(selectedDate)}
            className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 transition"
            title="Rafraîchir"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          </button>

          <button
            onClick={() => setShowExportModal(true)}
            className="flex items-center gap-1.5 bg-slate-800 hover:bg-slate-900 text-white px-3.5 py-2 rounded-xl text-xs sm:text-sm font-bold shadow-md transition"
            title="Télécharger la fiche individuelle en PDF, PNG ou JPG"
          >
            <Download className="w-4 h-4" />
            <span>Exporter la fiche</span>
          </button>

          <button
            onClick={handleSaveAllVisible}
            disabled={isSaving || visibleSectors.length === 0}
            className="flex items-center gap-1.5 bg-emerald-700 hover:bg-emerald-800 text-white px-4 py-2 rounded-xl text-xs sm:text-sm font-bold shadow-md transition disabled:opacity-50"
          >
            <Save className="w-4 h-4" />
            <span>{isSaving ? 'Enregistrement...' : 'Enregistrer tout'}</span>
          </button>
        </div>
      </div>

      {/* Feedback Alert */}
      {feedback && (
        <div className={`p-4 rounded-xl text-sm flex items-start gap-3 border ${
          feedback.type === 'success' 
            ? 'bg-emerald-50 border-emerald-300 text-emerald-900' 
            : feedback.type === 'error'
            ? 'bg-rose-50 border-rose-300 text-rose-900'
            : 'bg-blue-50 border-blue-300 text-blue-900'
        }`}>
          {feedback.type === 'success' ? (
            <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0 mt-0.5" />
          ) : (
            <AlertCircle className="w-5 h-5 text-rose-600 flex-shrink-0 mt-0.5" />
          )}
          <div className="flex-1 font-medium">{feedback.message}</div>
          <button onClick={() => setFeedback(null)} className="text-xs font-bold underline opacity-70 hover:opacity-100">
            Fermer
          </button>
        </div>
      )}

      {/* Employee Restricted Notice if No Sector Assigned */}
      {isEmployee && visibleSectors.length === 0 && (
        <div className="bg-amber-50 border-2 border-dashed border-amber-300 rounded-2xl p-8 text-center">
          <AlertCircle className="w-12 h-12 text-amber-500 mx-auto mb-3" />
          <h3 className="text-lg font-bold text-slate-900">Aucun secteur ne vous a encore été attribué</h3>
          <p className="text-sm text-slate-600 max-w-md mx-auto mt-1">
            Votre compte Employé est actif mais aucun secteur (G3, G4, G5 ou G6) n'est assigné. Veuillez demander à l'Administrateur de vous affecter vos bâtiments.
          </p>
        </div>
      )}

      {/* Completion & Email Status Banner */}
      {visibleSectors.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          
          {/* Card 1: Day Completion Progress */}
          <div className={`rounded-2xl p-4 border shadow-sm ${
            isDayFullyComplete 
              ? 'bg-emerald-50 border-emerald-300' 
              : 'bg-amber-50/70 border-amber-200'
          }`}>
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-600">
                Statut de la Journée
              </span>
              {isDayFullyComplete ? (
                <span className="inline-flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded-full bg-emerald-200 text-emerald-800">
                  <Check className="w-3.5 h-3.5" /> Complète (3/3)
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded-full bg-amber-200 text-amber-800">
                  <Clock className="w-3.5 h-3.5" /> En cours ({3 - (missingSlots.length > 3 ? 3 : missingSlots.length)}/3)
                </span>
              )}
            </div>

            <div className="mt-3">
              <div className="text-xl font-extrabold text-slate-900">
                {isDayFullyComplete ? 'Tous les créneaux validés' : 'Créneaux manquants'}
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                {isDayFullyComplete 
                  ? 'Les 3 créneaux 10H, 13H et 16H sont enregistrés pour tous les secteurs.'
                  : missingSlots.length > 0 
                  ? `Manquants : ${missingSlots.slice(0, 4).map(m => `${m.sector} (${m.slot})`).join(', ')}${missingSlots.length > 4 ? '...' : ''}`
                  : 'Saisie partielle.'}
              </p>
            </div>
          </div>

          {/* Card 2: Email Notification Indicator */}
          <div className="rounded-2xl p-4 border shadow-sm bg-white border-slate-200 text-slate-800">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Notification E-mail (Facultative)
              </span>
              <Mail className="w-4 h-4 text-slate-400" />
            </div>

            <div className="mt-2">
              <div className="text-sm font-bold flex items-center gap-1.5">
                {summary?.emailSent ? (
                  <>
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    <span className="text-emerald-800 font-extrabold">E-mail envoyé (SMTP)</span>
                  </>
                ) : summary?.emailStatus === 'non_configure' ? (
                  <span className="text-slate-600 font-medium">Non configuré (Envoi ignoré)</span>
                ) : isDayFullyComplete ? (
                  <span className="text-amber-700 font-semibold">Prêt si SMTP actif</span>
                ) : (
                  <span className="text-slate-500">En attente des 3 créneaux</span>
                )}
              </div>
              <div className="text-xs mt-1 truncate text-slate-500">
                Destinataire : <strong className="font-mono">boubacarsene8@gmail.com</strong>
              </div>
            </div>

            <div className="mt-3 flex items-center gap-2">
              <button
                onClick={() => setShowEmailPreview(true)}
                className="text-xs px-2.5 py-1 rounded-lg font-semibold flex items-center gap-1 transition bg-slate-100 hover:bg-slate-200 text-slate-700"
              >
                <Eye className="w-3.5 h-3.5" />
                <span>Voir le tableau HTML</span>
              </button>

              {(isAdmin || isManager) && (
                <button
                  onClick={() => handleTriggerEmail(true)}
                  disabled={isSendingEmail}
                  className="text-xs px-2.5 py-1 rounded-lg font-semibold flex items-center gap-1 transition bg-slate-800 hover:bg-slate-900 text-white"
                  title="Tenter l'envoi SMTP manuel si configuré"
                >
                  <Send className={`w-3.5 h-3.5 ${isSendingEmail ? 'animate-spin' : ''}`} />
                  <span>Tester SMTP</span>
                </button>
              )}
            </div>
          </div>

          {/* Card 3: Grand Totals Today (Strictly in Plateaux & Distinct Eggs) */}
          <div className="rounded-2xl p-4 bg-white border border-slate-200 shadow-sm flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                {isEmployee ? 'Total de vos Secteurs' : 'Total Général Récolté'}
              </span>
              <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                {liveTotals.grandDepositTrays.toLocaleString('fr-FR')} pl. déposés
              </span>
            </div>

            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-3xl font-black text-emerald-900">
                {liveTotals.grandTrays.toLocaleString('fr-FR')}
              </span>
              <span className="text-sm font-bold text-emerald-800">plateaux</span>
            </div>
            <div className="text-[11px] text-slate-500 mt-0.5">
              Soit {liveTotals.equivalentGrandEggs.toLocaleString('fr-FR')} œufs (base confirmée : 30 œufs / plateau)
            </div>

            <div className="mt-2 pt-2 border-t border-slate-100 flex items-center justify-between text-xs text-slate-600">
              <div>
                Cassés : <strong className="text-rose-600">{liveTotals.grandBroken.toLocaleString('fr-FR')} œufs</strong>
              </div>
              <div>
                Double Jaune : <strong className="text-amber-600">{liveTotals.grandDouble.toLocaleString('fr-FR')} œufs</strong>
              </div>
            </div>
          </div>

        </div>
      )}

      {/* Main Unified Daily Sheet Matrix */}
      {visibleSectors.length > 0 && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          
          <div className="p-4 sm:p-5 border-b border-slate-200 bg-slate-50/60 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <span>Feuille de Ramassage</span>
                <span className="text-xs font-semibold text-slate-500">({selectedDate})</span>
              </h2>
              <p className="text-xs text-slate-500">
                Saisissez les quantités pour chaque créneau en <strong>nombre de plateaux</strong>. Les œufs cassés et les œufs à double jaune sont comptabilisés séparément en <strong>unités d'œufs</strong>.
              </p>
            </div>

            <div className="text-xs text-slate-600 bg-emerald-50 border border-emerald-200 px-3 py-1 rounded-lg">
              Règle du projet : 1 plateau standard = <strong>30 œufs</strong>
            </div>
          </div>

          {/* Table: Responsive on mobile Android */}
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[760px]">
              <thead>
                <tr className="bg-slate-100/80 text-[11px] font-extrabold uppercase tracking-wider text-slate-600 border-b border-slate-200">
                  <th className="py-3 px-4 w-36">Secteur</th>
                  <th className="py-3 px-3 text-center">Créneau 10H (Plateaux)</th>
                  <th className="py-3 px-3 text-center">Créneau 13H (Plateaux)</th>
                  <th className="py-3 px-3 text-center">Créneau 16H (Plateaux)</th>
                  <th className="py-3 px-3 text-center bg-slate-200/60 w-32">Total Ramassé</th>
                  <th className="py-3 px-3 text-center text-rose-700 w-24">Cassés</th>
                  <th className="py-3 px-3 text-center text-amber-700 w-24">Double Jaune</th>
                  <th className="py-3 px-4 text-center bg-emerald-50 text-emerald-900 w-36">Dépôt Stock (Plateaux)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 text-sm">
                {visibleSectors.map(sec => {
                  const secTotal = liveTotals.sectorTotals[sec] || { trays: 0, brokenEggs: 0, doubleYolkEggs: 0, depositTrays: 0 };

                  return (
                    <tr key={sec} className="hover:bg-slate-50/80 transition">
                      
                      {/* Sector badge */}
                      <td className="py-4 px-4 font-extrabold text-slate-900 bg-slate-50/50">
                        <div className="flex items-center gap-2">
                          <span className="w-8 h-8 rounded-xl bg-emerald-800 text-white flex items-center justify-center font-black text-xs shadow-sm">
                            {sec}
                          </span>
                          <div>
                            <div className="font-bold text-slate-900">Secteur {sec}</div>
                            <div className="text-[10px] text-slate-500">Pondeuses</div>
                          </div>
                        </div>
                      </td>

                      {/* 10H Slot Input */}
                      <td className="py-3 px-3">
                        <div className="space-y-1.5 min-w-[130px]">
                          <div>
                            <div className="flex items-center justify-between text-[10px] font-bold text-slate-600 mb-0.5">
                              <span>Plateaux</span>
                              <span className="text-emerald-700 font-extrabold">pl.</span>
                            </div>
                            <input
                              type="text"
                              inputMode="numeric"
                              pattern="[0-9]*"
                              placeholder="0"
                              value={formValues[sec]?.['10H']?.trays || ''}
                              onChange={(e) => handleInputChange(sec, '10H', 'trays', e.target.value)}
                              className="w-full text-center font-black text-sm bg-white border border-slate-300 rounded-lg py-1.5 px-2 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                            />
                          </div>
                          <div className="grid grid-cols-2 gap-1 text-[10px]">
                            <div>
                              <span className="text-rose-600 font-semibold block text-[9px]">Cassés (œufs)</span>
                              <input
                                type="text"
                                inputMode="numeric"
                                pattern="[0-9]*"
                                placeholder="0"
                                value={formValues[sec]?.['10H']?.brokenEggs || ''}
                                onChange={(e) => handleInputChange(sec, '10H', 'brokenEggs', e.target.value)}
                                className="w-full text-center font-bold text-rose-600 border border-slate-200 rounded py-1"
                              />
                            </div>
                            <div>
                              <span className="text-amber-600 font-semibold block text-[9px]">Dbl Jaune (œufs)</span>
                              <input
                                type="text"
                                inputMode="numeric"
                                pattern="[0-9]*"
                                placeholder="0"
                                value={formValues[sec]?.['10H']?.doubleYolkEggs || ''}
                                onChange={(e) => handleInputChange(sec, '10H', 'doubleYolkEggs', e.target.value)}
                                className="w-full text-center font-bold text-amber-600 border border-slate-200 rounded py-1"
                              />
                            </div>
                          </div>
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => handleSaveSlot(sec, '10H')}
                              disabled={isSaving}
                              className="flex-1 text-[10px] font-bold py-1 bg-slate-100 hover:bg-emerald-50 hover:text-emerald-700 text-slate-700 rounded transition border border-slate-200"
                            >
                              Valider 10H
                            </button>
                            {isAdmin && formValues[sec]?.['10H']?.trays && (
                              <button
                                type="button"
                                onClick={() => setDeleteSlotTarget({ sec, slot: '10H', trays: Number(formValues[sec]?.['10H']?.trays) || 0 })}
                                className="p-1 rounded bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200 transition"
                                title="Supprimer ce ramassage (Admin Boubacar Sene)"
                              >
                                <Trash2 className="w-3 h-3" />
                              </button>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* 13H Slot Input */}
                      <td className="py-3 px-3">
                        <div className="space-y-1.5 min-w-[130px]">
                          <div>
                            <div className="flex items-center justify-between text-[10px] font-bold text-slate-600 mb-0.5">
                              <span>Plateaux</span>
                              <span className="text-emerald-700 font-extrabold">pl.</span>
                            </div>
                            <input
                              type="text"
                              inputMode="numeric"
                              pattern="[0-9]*"
                              placeholder="0"
                              value={formValues[sec]?.['13H']?.trays || ''}
                              onChange={(e) => handleInputChange(sec, '13H', 'trays', e.target.value)}
                              className="w-full text-center font-black text-sm bg-white border border-slate-300 rounded-lg py-1.5 px-2 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                            />
                          </div>
                          <div className="grid grid-cols-2 gap-1 text-[10px]">
                            <div>
                              <span className="text-rose-600 font-semibold block text-[9px]">Cassés (œufs)</span>
                              <input
                                type="text"
                                inputMode="numeric"
                                pattern="[0-9]*"
                                placeholder="0"
                                value={formValues[sec]?.['13H']?.brokenEggs || ''}
                                onChange={(e) => handleInputChange(sec, '13H', 'brokenEggs', e.target.value)}
                                className="w-full text-center font-bold text-rose-600 border border-slate-200 rounded py-1"
                              />
                            </div>
                            <div>
                              <span className="text-amber-600 font-semibold block text-[9px]">Dbl Jaune (œufs)</span>
                              <input
                                type="text"
                                inputMode="numeric"
                                pattern="[0-9]*"
                                placeholder="0"
                                value={formValues[sec]?.['13H']?.doubleYolkEggs || ''}
                                onChange={(e) => handleInputChange(sec, '13H', 'doubleYolkEggs', e.target.value)}
                                className="w-full text-center font-bold text-amber-600 border border-slate-200 rounded py-1"
                              />
                            </div>
                          </div>
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => handleSaveSlot(sec, '13H')}
                              disabled={isSaving}
                              className="flex-1 text-[10px] font-bold py-1 bg-slate-100 hover:bg-emerald-50 hover:text-emerald-700 text-slate-700 rounded transition border border-slate-200"
                            >
                              Valider 13H
                            </button>
                            {isAdmin && formValues[sec]?.['13H']?.trays && (
                              <button
                                type="button"
                                onClick={() => setDeleteSlotTarget({ sec, slot: '13H', trays: Number(formValues[sec]?.['13H']?.trays) || 0 })}
                                className="p-1 rounded bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200 transition"
                                title="Supprimer ce ramassage (Admin Boubacar Sene)"
                              >
                                <Trash2 className="w-3 h-3" />
                              </button>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* 16H Slot Input */}
                      <td className="py-3 px-3">
                        <div className="space-y-1.5 min-w-[130px]">
                          <div>
                            <div className="flex items-center justify-between text-[10px] font-bold text-slate-600 mb-0.5">
                              <span>Plateaux</span>
                              <span className="text-emerald-700 font-extrabold">pl.</span>
                            </div>
                            <input
                              type="text"
                              inputMode="numeric"
                              pattern="[0-9]*"
                              placeholder="0"
                              value={formValues[sec]?.['16H']?.trays || ''}
                              onChange={(e) => handleInputChange(sec, '16H', 'trays', e.target.value)}
                              className="w-full text-center font-black text-sm bg-white border border-slate-300 rounded-lg py-1.5 px-2 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                            />
                          </div>
                          <div className="grid grid-cols-2 gap-1 text-[10px]">
                            <div>
                              <span className="text-rose-600 font-semibold block text-[9px]">Cassés (œufs)</span>
                              <input
                                type="text"
                                inputMode="numeric"
                                pattern="[0-9]*"
                                placeholder="0"
                                value={formValues[sec]?.['16H']?.brokenEggs || ''}
                                onChange={(e) => handleInputChange(sec, '16H', 'brokenEggs', e.target.value)}
                                className="w-full text-center font-bold text-rose-600 border border-slate-200 rounded py-1"
                              />
                            </div>
                            <div>
                              <span className="text-amber-600 font-semibold block text-[9px]">Dbl Jaune (œufs)</span>
                              <input
                                type="text"
                                inputMode="numeric"
                                pattern="[0-9]*"
                                placeholder="0"
                                value={formValues[sec]?.['16H']?.doubleYolkEggs || ''}
                                onChange={(e) => handleInputChange(sec, '16H', 'doubleYolkEggs', e.target.value)}
                                className="w-full text-center font-bold text-amber-600 border border-slate-200 rounded py-1"
                              />
                            </div>
                          </div>
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => handleSaveSlot(sec, '16H')}
                              disabled={isSaving}
                              className="flex-1 text-[10px] font-bold py-1 bg-slate-100 hover:bg-emerald-50 hover:text-emerald-700 text-slate-700 rounded transition border border-slate-200"
                            >
                              Valider 16H
                            </button>
                            {isAdmin && formValues[sec]?.['16H']?.trays && (
                              <button
                                type="button"
                                onClick={() => setDeleteSlotTarget({ sec, slot: '16H', trays: Number(formValues[sec]?.['16H']?.trays) || 0 })}
                                className="p-1 rounded bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200 transition"
                                title="Supprimer ce ramassage (Admin Boubacar Sene)"
                              >
                                <Trash2 className="w-3 h-3" />
                              </button>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Live Total for this Sector (Plateaux) */}
                      <td className="py-3 px-3 text-center bg-slate-100/60 font-black text-slate-900">
                        <div className="text-base font-black text-emerald-950">
                          {secTotal.trays.toLocaleString('fr-FR')} <span className="text-xs font-semibold">pl.</span>
                        </div>
                        <div className="text-[10px] text-slate-500 font-semibold">
                          ({(secTotal.trays * 30).toLocaleString('fr-FR')} œufs)
                        </div>
                      </td>

                      {/* Cracked (Individual egg count) */}
                      <td className="py-3 px-3 text-center font-bold text-rose-600 text-sm">
                        {secTotal.brokenEggs.toLocaleString('fr-FR')} <span className="text-[10px] font-normal text-rose-500">œufs</span>
                      </td>

                      {/* Double Yolk (Individual egg count) */}
                      <td className="py-3 px-3 text-center font-bold text-amber-600 text-sm">
                        {secTotal.doubleYolkEggs.toLocaleString('fr-FR')} <span className="text-[10px] font-normal text-amber-500">œufs</span>
                      </td>

                      {/* Deposit in Stock (Plateaux) */}
                      <td className="py-3 px-4 text-center bg-emerald-50/80 font-black text-emerald-900">
                        <div className="text-base font-black">
                          {secTotal.depositTrays.toLocaleString('fr-FR')} <span className="text-xs font-semibold">pl.</span>
                        </div>
                        <div className="text-[10px] font-semibold text-emerald-700">
                          soit {(secTotal.depositTrays * 30).toLocaleString('fr-FR')} œufs
                        </div>
                      </td>

                    </tr>
                  );
                })}
              </tbody>

              {/* Table Footer: Column Totals */}
              <tfoot>
                <tr className="bg-slate-900 text-white font-extrabold text-sm border-t-2 border-emerald-600">
                  <td className="py-3.5 px-4 uppercase text-xs tracking-wider">
                    {isEmployee ? 'TOTAUX ASSIGNÉS' : 'TOTAL GÉNÉRAL'}
                  </td>
                  <td className="py-3.5 px-3 text-center">
                    <div className="font-black text-emerald-300">{liveTotals.slotTotals['10H'].trays.toLocaleString('fr-FR')} pl.</div>
                    <div className="text-[10px] text-slate-400">
                      {liveTotals.slotTotals['10H'].brokenEggs} cass. • {liveTotals.slotTotals['10H'].doubleYolkEggs} dj.
                    </div>
                  </td>
                  <td className="py-3.5 px-3 text-center">
                    <div className="font-black text-emerald-300">{liveTotals.slotTotals['13H'].trays.toLocaleString('fr-FR')} pl.</div>
                    <div className="text-[10px] text-slate-400">
                      {liveTotals.slotTotals['13H'].brokenEggs} cass. • {liveTotals.slotTotals['13H'].doubleYolkEggs} dj.
                    </div>
                  </td>
                  <td className="py-3.5 px-3 text-center">
                    <div className="font-black text-emerald-300">{liveTotals.slotTotals['16H'].trays.toLocaleString('fr-FR')} pl.</div>
                    <div className="text-[10px] text-slate-400">
                      {liveTotals.slotTotals['16H'].brokenEggs} cass. • {liveTotals.slotTotals['16H'].doubleYolkEggs} dj.
                    </div>
                  </td>
                  <td className="py-3.5 px-3 text-center bg-slate-800 text-emerald-300 text-base">
                    <div className="font-black">{liveTotals.grandTrays.toLocaleString('fr-FR')} pl.</div>
                    <div className="text-[10px] text-emerald-400/80 font-normal">
                      ({liveTotals.equivalentGrandEggs.toLocaleString('fr-FR')} œufs)
                    </div>
                  </td>
                  <td className="py-3.5 px-3 text-center text-rose-300 font-bold">
                    {liveTotals.grandBroken.toLocaleString('fr-FR')} <span className="text-[10px] font-normal">œufs</span>
                  </td>
                  <td className="py-3.5 px-3 text-center text-amber-300 font-bold">
                    {liveTotals.grandDouble.toLocaleString('fr-FR')} <span className="text-[10px] font-normal">œufs</span>
                  </td>
                  <td className="py-3.5 px-4 text-center bg-emerald-800 text-white text-base font-black">
                    <div>{liveTotals.grandDepositTrays.toLocaleString('fr-FR')} pl.</div>
                    <div className="text-[10px] text-emerald-200 font-normal">
                      ({(liveTotals.grandDepositTrays * 30).toLocaleString('fr-FR')} œufs)
                    </div>
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>

          <div className="p-4 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between text-xs text-slate-500 gap-2">
            <div>
              Dernière mise à jour : <strong>{new Date().toLocaleTimeString('fr-FR')}</strong> • Collecte en plateaux standardisés.
            </div>
            <div className="flex items-center gap-3">
              <span className="flex items-center gap-1 text-emerald-700 font-semibold">
                <ShieldCheck className="w-4 h-4" />
                Vérification RBAC active
              </span>
            </div>
          </div>

        </div>
      )}

      {/* Email Preview Modal */}
      {showEmailPreview && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] flex flex-col shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95">
            
            <div className="p-4 bg-emerald-950 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Mail className="w-5 h-5 text-emerald-400" />
                <h3 className="font-bold text-base">Aperçu du Rapport E-mail Automatique</h3>
              </div>
              <button
                onClick={() => setShowEmailPreview(false)}
                className="text-slate-400 hover:text-white text-sm font-bold px-2 py-1"
              >
                ✕
              </button>
            </div>

            <div className="p-4 bg-slate-100 border-b border-slate-200 text-xs text-slate-600 space-y-1">
              <div><strong>Destinataire :</strong> {summary?.emailRecipient || 'boubacarsene8@gmail.com'}</div>
              <div><strong>Objet :</strong> POULAILLER CAMPEMENT — Tableau complet du ramassage du {selectedDate}</div>
              <div><strong>Déclenchement :</strong> Automatique dès complétion des 3 créneaux (10H + 13H + 16H)</div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 bg-slate-50">
              <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm space-y-4">
                <div className="border-b border-emerald-900 pb-3">
                  <h4 className="font-extrabold text-emerald-900 text-lg">POULAILLER CAMPEMENT</h4>
                  <p className="text-xs text-slate-500">Rapport de production journalière — {selectedDate}</p>
                </div>

                <div className="grid grid-cols-3 gap-2 text-center text-xs">
                  <div className="bg-emerald-50 p-2.5 rounded-lg border border-emerald-200">
                    <div className="text-[10px] font-bold text-emerald-700">TOTAL RÉCOLTÉ</div>
                    <div className="text-lg font-black text-emerald-900">{liveTotals.grandTrays.toLocaleString('fr-FR')} pl.</div>
                    <div className="text-[10px] text-emerald-600">({liveTotals.equivalentGrandEggs.toLocaleString('fr-FR')} œufs)</div>
                  </div>
                  <div className="bg-blue-50 p-2.5 rounded-lg border border-blue-200">
                    <div className="text-[10px] font-bold text-blue-700">DÉPÔT STOCK</div>
                    <div className="text-lg font-black text-blue-900">{liveTotals.grandDepositTrays.toLocaleString('fr-FR')} pl.</div>
                    <div className="text-[10px] text-blue-600">({(liveTotals.grandDepositTrays * 30).toLocaleString('fr-FR')} œufs)</div>
                  </div>
                  <div className="bg-rose-50 p-2.5 rounded-lg border border-rose-200">
                    <div className="text-[10px] font-bold text-rose-700">CASSÉS & DJ</div>
                    <div className="text-lg font-black text-rose-900">{liveTotals.grandBroken + liveTotals.grandDouble} œufs</div>
                    <div className="text-[10px] text-rose-600">{liveTotals.grandBroken} cass. • {liveTotals.grandDouble} dj.</div>
                  </div>
                </div>

                <table className="w-full text-xs border-collapse border border-slate-200">
                  <thead>
                    <tr className="bg-slate-100 font-bold text-slate-700">
                      <th className="p-2 border text-left">Secteur</th>
                      <th className="p-2 border text-center">10H (pl.)</th>
                      <th className="p-2 border text-center">13H (pl.)</th>
                      <th className="p-2 border text-center">16H (pl.)</th>
                      <th className="p-2 border text-center">Total (pl.)</th>
                      <th className="p-2 border text-center">Cassés (œufs)</th>
                      <th className="p-2 border text-center">Double Jaune (œufs)</th>
                      <th className="p-2 border text-center">Dépôt (pl.)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ALL_SECTORS.map(sec => {
                      const t = liveTotals.sectorTotals[sec] || { trays: 0, brokenEggs: 0, doubleYolkEggs: 0, depositTrays: 0 };
                      const q10 = formValues[sec]?.['10H']?.trays || '-';
                      const q13 = formValues[sec]?.['13H']?.trays || '-';
                      const q16 = formValues[sec]?.['16H']?.trays || '-';
                      return (
                        <tr key={sec} className="text-center border">
                          <td className="p-2 font-bold text-left bg-slate-50">{sec}</td>
                          <td className="p-2">{q10}</td>
                          <td className="p-2">{q13}</td>
                          <td className="p-2">{q16}</td>
                          <td className="p-2 font-bold">{t.trays} pl.</td>
                          <td className="p-2 font-semibold text-rose-600">{t.brokenEggs}</td>
                          <td className="p-2 font-semibold text-amber-600">{t.doubleYolkEggs}</td>
                          <td className="p-2 font-bold text-emerald-700 bg-emerald-50/50">{t.depositTrays} pl.</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="p-4 bg-white border-t border-slate-200 flex items-center justify-between">
              <span className="text-xs text-slate-500">
                {isDayFullyComplete ? '✅ Prêt pour notification' : '⚠️ En attente des créneaux restants'}
              </span>
              <button
                onClick={() => setShowEmailPreview(false)}
                className="bg-slate-800 hover:bg-slate-900 text-white text-xs font-bold px-4 py-2 rounded-xl transition"
              >
                Fermer l'aperçu
              </button>
            </div>

          </div>
        </div>
      )}

      {/* Individual Document Export Modal (PDF, PNG, JPG) */}
      <DocumentExportModal
        isOpen={showExportModal}
        onClose={() => setShowExportModal(false)}
        documentTitle="FICHE DE RAMASSAGE D'ŒUFS"
        documentReference={`RAM-${selectedDate}`}
        date={selectedDate}
      >
        <div className="space-y-4">
          <div className="flex items-center justify-between bg-slate-50 p-3 rounded-xl border border-slate-200 text-xs">
            <div>
              <span className="text-slate-500">Date de collecte :</span>{' '}
              <strong className="text-slate-900">{selectedDate}</strong>
            </div>
            <div>
              <span className="text-slate-500">Opérateur :</span>{' '}
              <strong className="text-slate-900">{user?.name || 'Direction Exploitation'}</strong>
            </div>
            <div>
              <span className="text-slate-500">Statut :</span>{' '}
              <strong className={isDayFullyComplete ? 'text-emerald-700' : 'text-amber-700'}>
                {isDayFullyComplete ? 'Journée Complète (3/3 créneaux)' : 'En cours de saisie'}
              </strong>
            </div>
          </div>

          {/* Quick Metrics */}
          <div className="grid grid-cols-4 gap-2.5 text-center">
            <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200">
              <div className="text-[10px] uppercase font-bold text-emerald-800">Total Récolté</div>
              <div className="text-xl font-black text-emerald-950 mt-0.5">
                {liveTotals.grandTrays.toLocaleString('fr-FR')}
              </div>
              <div className="text-[10px] text-emerald-700 font-semibold">plateaux</div>
              <div className="text-[9px] text-slate-500 mt-0.5">({liveTotals.equivalentGrandEggs.toLocaleString('fr-FR')} œufs)</div>
            </div>

            <div className="p-3 rounded-xl bg-blue-50 border border-blue-200">
              <div className="text-[10px] uppercase font-bold text-blue-800">Dépôt Stock</div>
              <div className="text-xl font-black text-blue-950 mt-0.5">
                {liveTotals.grandDepositTrays.toLocaleString('fr-FR')}
              </div>
              <div className="text-[10px] text-blue-700 font-semibold">
                plateaux
              </div>
              <div className="text-[9px] text-slate-500 mt-0.5">({(liveTotals.grandDepositTrays * 30).toLocaleString('fr-FR')} œufs)</div>
            </div>

            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200">
              <div className="text-[10px] uppercase font-bold text-rose-800">Œufs Déclassés</div>
              <div className="text-xl font-black text-rose-950 mt-0.5">
                {liveTotals.grandBroken.toLocaleString('fr-FR')}
              </div>
              <div className="text-[10px] text-rose-700 font-semibold">cassés (œufs)</div>
            </div>

            <div className="p-3 rounded-xl bg-amber-50 border border-amber-200">
              <div className="text-[10px] uppercase font-bold text-amber-800">Double Jaune</div>
              <div className="text-xl font-black text-amber-950 mt-0.5">
                {liveTotals.grandDouble.toLocaleString('fr-FR')}
              </div>
              <div className="text-[10px] text-amber-700 font-semibold">œufs individuels</div>
            </div>
          </div>

          {/* Clean Printed Table */}
          <table className="w-full text-xs border-collapse border border-slate-300">
            <thead>
              <tr className="bg-slate-100 text-slate-700 font-extrabold text-[11px] uppercase">
                <th className="p-2.5 border border-slate-300 text-left">Bâtiment / Secteur</th>
                <th className="p-2.5 border border-slate-300 text-center">Créneau 10H (pl.)</th>
                <th className="p-2.5 border border-slate-300 text-center">Créneau 13H (pl.)</th>
                <th className="p-2.5 border border-slate-300 text-center">Créneau 16H (pl.)</th>
                <th className="p-2.5 border border-slate-300 text-center bg-slate-200/60">Total (pl.)</th>
                <th className="p-2.5 border border-slate-300 text-center text-rose-700">Cassés (œufs)</th>
                <th className="p-2.5 border border-slate-300 text-center text-amber-700">Double Jaune (œufs)</th>
                <th className="p-2.5 border border-slate-300 text-center bg-emerald-50 text-emerald-900">Dépôt (pl.)</th>
              </tr>
            </thead>
            <tbody>
              {visibleSectors.map(sec => {
                const secTot = liveTotals.sectorTotals[sec] || { trays: 0, brokenEggs: 0, doubleYolkEggs: 0, depositTrays: 0 };
                const q10 = formValues[sec]?.['10H']?.trays || '-';
                const q13 = formValues[sec]?.['13H']?.trays || '-';
                const q16 = formValues[sec]?.['16H']?.trays || '-';

                return (
                  <tr key={sec} className="text-center border border-slate-300">
                    <td className="p-2.5 border border-slate-300 font-bold text-left bg-slate-50/70">
                      Secteur {sec}
                    </td>
                    <td className="p-2.5 border border-slate-300">{q10}</td>
                    <td className="p-2.5 border border-slate-300">{q13}</td>
                    <td className="p-2.5 border border-slate-300">{q16}</td>
                    <td className="p-2.5 border border-slate-300 font-bold bg-slate-100/50">
                      {secTot.trays.toLocaleString('fr-FR')} pl.
                    </td>
                    <td className="p-2.5 border border-slate-300 font-semibold text-rose-600">
                      {secTot.brokenEggs}
                    </td>
                    <td className="p-2.5 border border-slate-300 font-semibold text-amber-600">
                      {secTot.doubleYolkEggs}
                    </td>
                    <td className="p-2.5 border border-slate-300 font-extrabold text-emerald-800 bg-emerald-50/40">
                      {secTot.depositTrays.toLocaleString('fr-FR')} pl.
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="bg-slate-900 text-white font-extrabold text-xs">
                <td className="p-3 border border-slate-800 text-left">TOTAL GÉNÉRAL</td>
                <td className="p-3 border border-slate-800 text-center">{liveTotals.slotTotals['10H'].trays.toLocaleString('fr-FR')} pl.</td>
                <td className="p-3 border border-slate-800 text-center">{liveTotals.slotTotals['13H'].trays.toLocaleString('fr-FR')} pl.</td>
                <td className="p-3 border border-slate-800 text-center">{liveTotals.slotTotals['16H'].trays.toLocaleString('fr-FR')} pl.</td>
                <td className="p-3 border border-slate-800 text-center bg-slate-800 text-emerald-300 font-black">
                  {liveTotals.grandTrays.toLocaleString('fr-FR')} pl.
                </td>
                <td className="p-3 border border-slate-800 text-center text-rose-300">
                  {liveTotals.grandBroken.toLocaleString('fr-FR')} œufs
                </td>
                <td className="p-3 border border-slate-800 text-center text-amber-300">
                  {liveTotals.grandDouble.toLocaleString('fr-FR')} œufs
                </td>
                <td className="p-3 border border-slate-800 text-center bg-emerald-800 text-white font-black">
                  {liveTotals.grandDepositTrays.toLocaleString('fr-FR')} pl.
                </td>
              </tr>
            </tfoot>
          </table>

          {/* Signature block */}
          <div className="grid grid-cols-2 gap-8 pt-6 text-xs text-slate-500">
            <div className="border-t border-slate-300 pt-2 text-center">
              Signature / Visa du Ramasseur
            </div>
            <div className="border-t border-slate-300 pt-2 text-center">
              Visa du Gérant / Chef d'Exploitation
            </div>
          </div>
        </div>
      </DocumentExportModal>

      {deleteSlotTarget && (
        <DeleteConfirmModal
          isOpen={!!deleteSlotTarget}
          onClose={() => setDeleteSlotTarget(null)}
          onConfirm={handleDeleteSlot}
          title={`Supprimer le ramassage de ${deleteSlotTarget.slot} — Secteur ${deleteSlotTarget.sec}`}
          itemDetails={[
            { label: 'Date', value: selectedDate },
            { label: 'Secteur', value: deleteSlotTarget.sec },
            { label: 'Créneau', value: deleteSlotTarget.slot },
            { label: 'Plateaux enregistrés', value: `${deleteSlotTarget.trays || 0} plateaux` },
          ]}
          warningMessage="Attention : La suppression annulera définitivement cette saisie et recalculera immédiatement les totaux et stocks. Une copie d'audit est conservée dans la corbeille."
        />
      )}

    </div>
  );
};
