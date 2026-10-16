import React, { useState, useEffect } from 'react';
import { 
  Activity, 
  AlertTriangle, 
  Calendar, 
  Check, 
  CheckCircle2, 
  Clock, 
  Download, 
  FileText, 
  Filter, 
  HelpCircle, 
  Info, 
  Layers, 
  Plus, 
  RefreshCw, 
  Search, 
  ShieldAlert, 
  ShieldCheck, 
  Sparkles, 
  Stethoscope, 
  Syringe, 
  X 
} from 'lucide-react';
import { api } from '../api/client.js';
import { useAuth } from '../context/AuthContext.js';
import { 
  ALL_SECTORS, 
  MedicationItem, 
  MedicationMovement, 
  SanitaryTreatmentRecord, 
  SectorId, 
  VaccinationCampaign, 
  VaccineItem, 
  VeterinaryAlerts 
} from '../types/index.js';
import { DocumentExportModal } from '../components/DocumentExportModal.js';

export const SuiviVeterinairePage: React.FC = () => {
  const { user, isAdmin, isManager, isVeterinaire, isEmployee, allowedSectors } = useAuth();

  const isVetOrAdmin = isVeterinaire || isAdmin;
  const canViewAll = isAdmin || isManager || isVeterinaire;

  // Active sub-tab
  const [activeTab, setActiveTab] = useState<'alertes' | 'medicaments' | 'vaccins' | 'traitements' | 'exports'>('alertes');

  // Data states
  const [alerts, setAlerts] = useState<VeterinaryAlerts | null>(null);
  const [medications, setMedications] = useState<MedicationItem[]>([]);
  const [movements, setMovements] = useState<MedicationMovement[]>([]);
  const [vaccines, setVaccines] = useState<VaccineItem[]>([]);
  const [vaccinations, setVaccinations] = useState<VaccinationCampaign[]>([]);
  const [treatments, setTreatments] = useState<SanitaryTreatmentRecord[]>([]);

  const [isLoading, setIsLoading] = useState(true);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Sector filter for treatments & vaccinations
  const [selectedSectorFilter, setSelectedSectorFilter] = useState<SectorId | 'TOUS'>(
    isEmployee && allowedSectors.length === 1 ? allowedSectors[0] : 'TOUS'
  );

  // Modals
  const [showAddMedModal, setShowAddMedModal] = useState(false);
  const [showMedMovementModal, setShowMedMovementModal] = useState(false);
  const [selectedMedForMovement, setSelectedMedForMovement] = useState<MedicationItem | null>(null);
  const [showAddVaccineModal, setShowAddVaccineModal] = useState(false);
  const [showScheduleVaccinationModal, setShowScheduleVaccinationModal] = useState(false);
  const [showRealizeVaccinationModal, setShowRealizeVaccinationModal] = useState(false);
  const [campaignToRealize, setCampaignToRealize] = useState<VaccinationCampaign | null>(null);
  const [showAddTreatmentModal, setShowAddTreatmentModal] = useState(false);

  // Export document modal
  const [exportModalState, setExportModalState] = useState<{
    isOpen: boolean;
    type: 'medications' | 'vaccines' | 'treatments';
    title: string;
    reference: string;
  }>({
    isOpen: false,
    type: 'medications',
    title: '',
    reference: '',
  });

  // Forms
  const [medForm, setMedForm] = useState({
    name: '',
    category: 'antibiotique' as any,
    unit: 'Flacons 100ml',
    currentStock: 10,
    minimumStockAlert: 3,
    expiryDate: new Date(Date.now() + 180 * 24 * 3600 * 1000).toISOString().split('T')[0],
    batchNumber: '',
  });

  const [movForm, setMovForm] = useState({
    medicationId: '',
    type: 'SORTIE_TRAITEMENT' as any,
    quantity: 1,
    sector: 'G3' as SectorId | 'TOUS' | 'CENTRAL',
    reason: '',
    dosagePrescrit: '',
  });

  const [vacForm, setVacForm] = useState({
    name: '',
    targetDisease: 'Maladie de Newcastle',
    unit: 'Doses (flacons)',
    quantityReceived: 5000,
    minimumStockAlert: 2000,
    receptionDate: new Date().toISOString().split('T')[0],
    expiryDate: new Date(Date.now() + 150 * 24 * 3600 * 1000).toISOString().split('T')[0],
    batchNumber: '',
  });

  const [campForm, setCampForm] = useState({
    vaccineId: '',
    vaccineName: '',
    sector: 'G3' as SectorId,
    scheduledDate: new Date().toISOString().split('T')[0],
    targetBirdCount: 2500,
    administrationRoute: 'EAU_BOISSON' as any,
    observations: '',
  });

  const [realizeForm, setRealizeForm] = useState({
    realizedDate: new Date().toISOString().split('T')[0],
    dosesAdministered: 2500,
    observations: 'Vaccination administrée conformément au protocole vétérinaire.',
  });

  const [treatForm, setTreatForm] = useState({
    sector: 'G3' as SectorId,
    diagnosis: '',
    treatmentType: 'MEDICAMENT' as any,
    productName: '',
    dosage: '',
    durationDays: 3,
    startDate: new Date().toISOString().split('T')[0],
    withdrawalPeriodDays: 0,
    observations: '',
  });

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [alertData, medData, movData, vacData, campData, treatData] = await Promise.all([
        api.getVeterinaryAlerts(),
        api.getMedications(),
        api.getMedicationMovements(),
        api.getVaccines(),
        api.getVaccinations(selectedSectorFilter === 'TOUS' ? undefined : selectedSectorFilter),
        api.getSanitaryTreatments(selectedSectorFilter === 'TOUS' ? undefined : selectedSectorFilter),
      ]);
      setAlerts(alertData);
      setMedications(medData);
      setMovements(movData);
      setVaccines(vacData);
      setVaccinations(campData);
      setTreatments(treatData);
    } catch (err: any) {
      console.error('Error loading veterinary data:', err);
      setFeedback({ type: 'error', message: err?.message || 'Erreur lors du chargement des données sanitaires.' });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [selectedSectorFilter]);

  // Handlers
  const handleCreateMedication = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!medForm.name) return;
    try {
      await api.saveMedication(medForm);
      setFeedback({ type: 'success', message: `Médicament ${medForm.name} enregistré avec succès.` });
      setShowAddMedModal(false);
      setMedForm({
        name: '',
        category: 'antibiotique',
        unit: 'Flacons 100ml',
        currentStock: 10,
        minimumStockAlert: 3,
        expiryDate: new Date(Date.now() + 180 * 24 * 3600 * 1000).toISOString().split('T')[0],
        batchNumber: '',
      });
      await loadData();
    } catch (err: any) {
      setFeedback({ type: 'error', message: err?.message || 'Erreur lors de l\'enregistrement' });
    }
  };

  const handleAddMovement = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!movForm.medicationId || !movForm.quantity) return;
    try {
      await api.addMedicationMovement(movForm);
      setFeedback({ type: 'success', message: 'Mouvement de stock enregistré avec succès.' });
      setShowMedMovementModal(false);
      await loadData();
    } catch (err: any) {
      setFeedback({ type: 'error', message: err?.message || 'Erreur lors de l\'opération' });
    }
  };

  const handleCreateVaccine = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!vacForm.name || !vacForm.targetDisease) return;
    try {
      await api.saveVaccine(vacForm);
      setFeedback({ type: 'success', message: `Lot de vaccin ${vacForm.name} enregistré avec succès.` });
      setShowAddVaccineModal(false);
      setVacForm({
        name: '',
        targetDisease: 'Maladie de Newcastle',
        unit: 'Doses (flacons)',
        quantityReceived: 5000,
        minimumStockAlert: 2000,
        receptionDate: new Date().toISOString().split('T')[0],
        expiryDate: new Date(Date.now() + 150 * 24 * 3600 * 1000).toISOString().split('T')[0],
        batchNumber: '',
      });
      await loadData();
    } catch (err: any) {
      setFeedback({ type: 'error', message: err?.message || 'Erreur lors de l\'enregistrement' });
    }
  };

  const handleScheduleVaccination = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!campForm.vaccineName || !campForm.scheduledDate) return;
    try {
      await api.saveVaccination(campForm);
      setFeedback({ type: 'success', message: `Campagne de vaccination programmée pour ${campForm.sector}.` });
      setShowScheduleVaccinationModal(false);
      await loadData();
    } catch (err: any) {
      setFeedback({ type: 'error', message: err?.message || 'Erreur programmation' });
    }
  };

  const handleRealizeVaccination = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!campaignToRealize) return;
    try {
      await api.realizeVaccination(campaignToRealize.id, {
        realizedDate: realizeForm.realizedDate,
        dosesAdministered: Number(realizeForm.dosesAdministered),
        observations: realizeForm.observations,
      });
      setFeedback({ type: 'success', message: `Vaccination certifiée et validée pour ${campaignToRealize.sector}.` });
      setShowRealizeVaccinationModal(false);
      setCampaignToRealize(null);
      await loadData();
    } catch (err: any) {
      setFeedback({ type: 'error', message: err?.message || 'Erreur lors de la validation' });
    }
  };

  const handleCreateTreatment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!treatForm.diagnosis || !treatForm.productName || !treatForm.dosage) {
      setFeedback({ type: 'error', message: 'Veuillez renseigner le diagnostic, le produit et la posologie précise.' });
      return;
    }
    try {
      await api.addSanitaryTreatment(treatForm);
      setFeedback({ type: 'success', message: `Protocole de traitement validé pour le Secteur ${treatForm.sector}.` });
      setShowAddTreatmentModal(false);
      setTreatForm({
        sector: 'G3',
        diagnosis: '',
        treatmentType: 'MEDICAMENT',
        productName: '',
        dosage: '',
        durationDays: 3,
        startDate: new Date().toISOString().split('T')[0],
        withdrawalPeriodDays: 0,
        observations: '',
      });
      await loadData();
    } catch (err: any) {
      setFeedback({ type: 'error', message: err?.message || 'Erreur enregistrement traitement' });
    }
  };

  return (
    <div className="space-y-6">
      
      {/* Top Banner & Header */}
      <div className="bg-gradient-to-r from-emerald-950 via-teal-950 to-slate-950 text-white rounded-3xl p-6 shadow-xl border border-emerald-900/50 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <div className="w-8 h-8 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center border border-emerald-500/30">
              <Stethoscope className="w-5 h-5 text-emerald-400" />
            </div>
            <span className="text-xs uppercase font-extrabold tracking-widest text-emerald-300">
              Santé Avicole & Pharmacie
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
            Suivi Vétérinaire & Vaccins
          </h1>
          <p className="text-xs sm:text-sm text-emerald-200/90 mt-1 max-w-2xl">
            Sous la responsabilité de <strong>M. Ndour</strong> (Vétérinaire & Gérant). Gestion des médicaments, stocks d'urgence, calendrier de vaccination et traçabilité sanitaire pour <strong>G3, G4, G5 et G6</strong>.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => loadData()}
            className="p-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white transition"
            title="Actualiser"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          </button>

          {isVetOrAdmin && (
            <button
              onClick={() => setShowAddTreatmentModal(true)}
              className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2.5 rounded-xl text-xs sm:text-sm font-extrabold shadow-lg transition"
            >
              <Plus className="w-4 h-4" />
              <span>Nouveau Traitement</span>
            </button>
          )}
        </div>
      </div>

      {feedback && (
        <div className={`p-4 rounded-2xl text-xs sm:text-sm flex items-start gap-3 border shadow-sm ${
          feedback.type === 'success' ? 'bg-emerald-50 border-emerald-300 text-emerald-900' : 'bg-rose-50 border-rose-300 text-rose-900'
        }`}>
          {feedback.type === 'success' ? (
            <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0" />
          ) : (
            <AlertTriangle className="w-5 h-5 text-rose-600 flex-shrink-0" />
          )}
          <div className="flex-1 font-semibold">{feedback.message}</div>
          <button onClick={() => setFeedback(null)} className="text-xs font-bold underline opacity-80 hover:opacity-100">
            Fermer
          </button>
        </div>
      )}

      {/* Tabs Navigation */}
      <div className="flex items-center space-x-2 border-b border-slate-200 overflow-x-auto pb-2 no-scrollbar text-xs font-bold">
        <button
          onClick={() => setActiveTab('alertes')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl transition whitespace-nowrap ${
            activeTab === 'alertes' 
              ? 'bg-emerald-800 text-white shadow-sm' 
              : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-200'
          }`}
        >
          <AlertTriangle className="w-4 h-4" />
          <span>Alertes & Synthèse</span>
          {Boolean(alerts?.totalAlertsCount && alerts.totalAlertsCount > 0) && (
            <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-rose-600 text-white font-black">
              {alerts?.totalAlertsCount}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab('medicaments')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl transition whitespace-nowrap ${
            activeTab === 'medicaments' 
              ? 'bg-emerald-800 text-white shadow-sm' 
              : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-200'
          }`}
        >
          <Activity className="w-4 h-4" />
          <span>Pharmacie & Médicaments ({medications.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('vaccins')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl transition whitespace-nowrap ${
            activeTab === 'vaccins' 
              ? 'bg-emerald-800 text-white shadow-sm' 
              : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-200'
          }`}
        >
          <Syringe className="w-4 h-4" />
          <span>Vaccins & Campagnes ({vaccinations.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('traitements')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl transition whitespace-nowrap ${
            activeTab === 'traitements' 
              ? 'bg-emerald-800 text-white shadow-sm' 
              : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-200'
          }`}
        >
          <Stethoscope className="w-4 h-4" />
          <span>Traitements Sanitaires ({treatments.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('exports')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl transition whitespace-nowrap ${
            activeTab === 'exports' 
              ? 'bg-emerald-800 text-white shadow-sm' 
              : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-200'
          }`}
        >
          <FileText className="w-4 h-4" />
          <span>Rapports & Fiches Officielles</span>
        </button>
      </div>

      {/* TAB 1: ALERTES & SYNTHÈSE */}
      {activeTab === 'alertes' && (
        <div className="space-y-6 animate-in fade-in">
          
          {/* Quick Alert Metric Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            
            {/* Stocks faibles */}
            <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-400 uppercase">Stocks faibles</span>
                <span className="p-2 rounded-xl bg-amber-50 text-amber-700">
                  <AlertTriangle className="w-4 h-4" />
                </span>
              </div>
              <div className="text-2xl font-black text-slate-900 mt-2">
                {(alerts?.lowStockMedications.length || 0) + (alerts?.lowStockVaccines.length || 0)}
              </div>
              <div className="text-xs text-amber-700 font-medium mt-1">
                {alerts?.lowStockMedications.length || 0} méd. • {alerts?.lowStockVaccines.length || 0} vaccins sous le seuil
              </div>
            </div>

            {/* Produits proches péremption */}
            <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-400 uppercase">Péremption &lt; 30j</span>
                <span className="p-2 rounded-xl bg-rose-50 text-rose-700">
                  <Clock className="w-4 h-4" />
                </span>
              </div>
              <div className="text-2xl font-black text-rose-900 mt-2">
                {(alerts?.expiringMedications.length || 0) + (alerts?.expiringVaccines.length || 0)}
              </div>
              <div className="text-xs text-rose-700 font-medium mt-1">
                À surveiller ou renouveler en urgence
              </div>
            </div>

            {/* Vaccinations en retard */}
            <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-400 uppercase">Vaccins en retard</span>
                <span className="p-2 rounded-xl bg-red-50 text-red-700">
                  <ShieldAlert className="w-4 h-4" />
                </span>
              </div>
              <div className="text-2xl font-black text-red-900 mt-2">
                {alerts?.overdueVaccinations.length || 0}
              </div>
              <div className="text-xs text-red-700 font-medium mt-1">
                Campagnes planifiées non encore validées
              </div>
            </div>

            {/* Vaccinations à venir */}
            <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-400 uppercase">Vaccins à venir (7j)</span>
                <span className="p-2 rounded-xl bg-blue-50 text-blue-700">
                  <Calendar className="w-4 h-4" />
                </span>
              </div>
              <div className="text-2xl font-black text-blue-900 mt-2">
                {alerts?.upcomingVaccinations.length || 0}
              </div>
              <div className="text-xs text-blue-700 font-medium mt-1">
                Prévoir les flacons et l'eau de boisson
              </div>
            </div>

          </div>

          {/* Active alerts detail list if any */}
          {Boolean(alerts?.totalAlertsCount && alerts.totalAlertsCount > 0) && (
            <div className="bg-rose-50/70 border border-rose-200 rounded-3xl p-5 shadow-sm space-y-3">
              <div className="flex items-center gap-2 text-rose-950 font-extrabold text-sm">
                <ShieldAlert className="w-5 h-5 text-rose-600" />
                <span>Points de vigilance sanitaire immédiats :</span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                {alerts?.lowStockMedications.map(m => (
                  <div key={m.id} className="p-3 bg-white rounded-xl border border-rose-200 flex justify-between items-center">
                    <div>
                      <strong className="text-slate-900 block">{m.name}</strong>
                      <span className="text-rose-700">Stock restant : {m.currentStock} {m.unit} (Seuil d'alerte : {m.minimumStockAlert})</span>
                    </div>
                    <span className="px-2 py-0.5 rounded text-[10px] font-black bg-amber-100 text-amber-800 uppercase">
                      Stock Bas
                    </span>
                  </div>
                ))}
                {alerts?.overdueVaccinations.map(v => (
                  <div key={v.id} className="p-3 bg-white rounded-xl border border-rose-200 flex justify-between items-center">
                    <div>
                      <strong className="text-slate-900 block">{v.vaccineName} ({v.sector})</strong>
                      <span className="text-rose-700">Date prévue : {v.scheduledDate} • Non réalisée</span>
                    </div>
                    <span className="px-2 py-0.5 rounded text-[10px] font-black bg-rose-100 text-rose-800 uppercase">
                      En retard
                    </span>
                  </div>
                ))}
                {alerts?.expiringMedications.map(m => (
                  <div key={m.id} className="p-3 bg-white rounded-xl border border-rose-200 flex justify-between items-center">
                    <div>
                      <strong className="text-slate-900 block">{m.name}</strong>
                      <span className="text-slate-500">Lot : {m.batchNumber} • Péremption : {m.expiryDate}</span>
                    </div>
                    <span className="px-2 py-0.5 rounded text-[10px] font-black bg-rose-100 text-rose-800 uppercase">
                      Péremption proche
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Sector Overview: G3, G4, G5, G6 */}
          <div>
            <h3 className="text-base font-extrabold text-slate-900 mb-3 flex items-center gap-2">
              <Layers className="w-5 h-5 text-emerald-700" />
              <span>État Sanitaire par Bâtiment d'Élevage (G3 • G4 • G5 • G6)</span>
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {ALL_SECTORS.map(sec => {
                const secTreatments = treatments.filter(t => t.sector === sec && t.status === 'EN_COURS');
                const secVaccinations = vaccinations.filter(v => v.sector === sec);
                const nextVaccination = secVaccinations.find(v => v.status === 'PROGRAMMEE');

                return (
                  <div key={sec} className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm flex flex-col justify-between">
                    <div>
                      <div className="flex justify-between items-center border-b border-slate-100 pb-2">
                        <span className="font-black text-lg text-emerald-950">Secteur {sec}</span>
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold ${
                          secTreatments.length > 0 ? 'bg-amber-100 text-amber-900' : 'bg-emerald-100 text-emerald-900'
                        }`}>
                          {secTreatments.length > 0 ? `${secTreatments.length} Traitement en cours` : 'État Sain'}
                        </span>
                      </div>

                      <div className="mt-3 space-y-2 text-xs">
                        <div>
                          <span className="text-slate-400 block text-[10px] uppercase font-bold">Dernier traitement :</span>
                          {secTreatments.length > 0 ? (
                            <span className="font-bold text-slate-800">
                              {secTreatments[0].productName} ({secTreatments[0].diagnosis})
                            </span>
                          ) : (
                            <span className="text-slate-500 italic">Aucun traitement actif</span>
                          )}
                        </div>

                        <div>
                          <span className="text-slate-400 block text-[10px] uppercase font-bold">Prochaine vaccination :</span>
                          {nextVaccination ? (
                            <span className="font-bold text-blue-900">
                              {nextVaccination.vaccineName} le {nextVaccination.scheduledDate}
                            </span>
                          ) : (
                            <span className="text-slate-500 italic">À jour de protocole</span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="mt-4 pt-3 border-t border-slate-100 flex justify-between items-center text-[11px]">
                      <span className="text-slate-400">Responsables :</span>
                      <span className="font-bold text-slate-700">
                        {sec === 'G3' ? 'Saliou' : sec === 'G4' ? 'Moustapha' : sec === 'G5' ? 'Faty & Cherif' : 'Boubacar Keita & B. Sene'}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

        </div>
      )}

      {/* TAB 2: MÉDICAMENTS & PHARMACIE */}
      {activeTab === 'medicaments' && (
        <div className="space-y-6 animate-in fade-in">
          
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
            <div>
              <h2 className="text-base sm:text-lg font-extrabold text-slate-900">
                Pharmacie & Stocks de Médicaments
              </h2>
              <p className="text-xs text-slate-500">
                Suivi des entrées, sorties de soins, dates de péremption et stocks restants.
              </p>
            </div>

            {isVetOrAdmin && (
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setShowAddMedModal(true)}
                  className="flex items-center gap-1.5 bg-emerald-700 hover:bg-emerald-800 text-white px-3.5 py-2 rounded-xl text-xs font-bold shadow transition"
                >
                  <Plus className="w-4 h-4" />
                  <span>Nouveau Médicament</span>
                </button>
              </div>
            )}
          </div>

          {/* Medications Catalog */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-4 border-b border-slate-200 bg-slate-50/70 font-bold text-xs uppercase text-slate-600">
              Inventaire disponible ({medications.length})
            </div>

            {medications.length === 0 ? (
              <div className="p-12 text-center text-slate-400 text-xs">
                Aucun médicament enregistré pour le moment.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-100 text-slate-600 font-extrabold border-b border-slate-200">
                      <th className="py-3 px-4">Médicament</th>
                      <th className="py-3 px-3">Catégorie</th>
                      <th className="py-3 px-3">Stock Actuel</th>
                      <th className="py-3 px-3">Seuil Alerte</th>
                      <th className="py-3 px-3">N° de Lot</th>
                      <th className="py-3 px-3">Date Péremption</th>
                      <th className="py-3 px-3">Validation Vétérinaire</th>
                      {isVetOrAdmin && <th className="py-3 px-4 text-right">Actions</th>}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {medications.map(m => {
                      const isLow = m.currentStock <= m.minimumStockAlert;
                      return (
                        <tr key={m.id} className="hover:bg-slate-50 transition">
                          <td className="py-3 px-4 font-bold text-slate-900">
                            <div>{m.name}</div>
                            <span className="text-[10px] text-slate-400 font-normal">Conditionnement : {m.unit}</span>
                          </td>
                          <td className="py-3 px-3 capitalize text-slate-600">{m.category}</td>
                          <td className="py-3 px-3">
                            <span className={`px-2 py-0.5 rounded-full font-black text-xs ${
                              isLow ? 'bg-amber-100 text-amber-900 border border-amber-300' : 'bg-emerald-100 text-emerald-900'
                            }`}>
                              {m.currentStock} {m.unit}
                            </span>
                          </td>
                          <td className="py-3 px-3 text-slate-500 font-mono">{m.minimumStockAlert}</td>
                          <td className="py-3 px-3 font-mono text-slate-700">{m.batchNumber}</td>
                          <td className="py-3 px-3 font-medium text-slate-700">{m.expiryDate}</td>
                          <td className="py-3 px-3">
                            <span className="inline-flex items-center gap-1 text-emerald-700 font-bold text-[11px]">
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                              <span>{m.vetName || 'M. Ndour'}</span>
                            </span>
                          </td>
                          {isVetOrAdmin && (
                            <td className="py-3 px-4 text-right">
                              <button
                                onClick={() => {
                                  setSelectedMedForMovement(m);
                                  setMovForm(prev => ({ ...prev, medicationId: m.id }));
                                  setShowMedMovementModal(true);
                                }}
                                className="px-2.5 py-1 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-800 font-bold text-[11px] border border-emerald-200 transition"
                              >
                                Mouvement stock
                              </button>
                            </td>
                          )}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Movement history */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-4 border-b border-slate-200 bg-slate-50/70 font-bold text-xs uppercase text-slate-600">
              Historique de Traçabilité des Mouvements ({movements.length})
            </div>

            {movements.length === 0 ? (
              <div className="p-8 text-center text-slate-400 text-xs">
                Aucun mouvement de stock enregistré.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-100 text-slate-600 font-extrabold border-b border-slate-200">
                      <th className="py-3 px-4">Date & Heure</th>
                      <th className="py-3 px-3">Médicament</th>
                      <th className="py-3 px-3">Type</th>
                      <th className="py-3 px-3">Quantité</th>
                      <th className="py-3 px-3">Secteur</th>
                      <th className="py-3 px-3">Motif & Posologie</th>
                      <th className="py-3 px-4">Opérateur & Validation</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {movements.map(mov => (
                      <tr key={mov.id} className="hover:bg-slate-50 transition">
                        <td className="py-3 px-4 text-slate-500 font-mono text-[11px]">
                          {mov.date} <span className="text-[10px] opacity-75">{mov.timestamp.split('T')[1]?.slice(0, 5)}</span>
                        </td>
                        <td className="py-3 px-3 font-bold text-slate-900">{mov.medicationName}</td>
                        <td className="py-3 px-3">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase ${
                            mov.type === 'ENTREE' ? 'bg-emerald-100 text-emerald-800' :
                            mov.type === 'SORTIE_TRAITEMENT' ? 'bg-blue-100 text-blue-800' :
                            'bg-slate-100 text-slate-700'
                          }`}>
                            {mov.type.replace('_', ' ')}
                          </span>
                        </td>
                        <td className="py-3 px-3 font-black text-slate-800">
                          {mov.type === 'ENTREE' ? `+${mov.quantity}` : `-${mov.quantity}`}
                          <span className="text-[10px] text-slate-400 font-normal ml-1">({mov.previousStock} → {mov.newStock})</span>
                        </td>
                        <td className="py-3 px-3 font-bold text-emerald-900">{mov.sector}</td>
                        <td className="py-3 px-3 text-slate-700">
                          <div>{mov.reason}</div>
                          {mov.dosagePrescrit && (
                            <div className="text-[10px] text-purple-700 font-semibold mt-0.5">
                              Posologie : {mov.dosagePrescrit}
                            </div>
                          )}
                        </td>
                        <td className="py-3 px-4 text-slate-600">
                          <div className="font-medium">{mov.performedByName}</div>
                          <div className="text-[10px] text-emerald-700 font-bold">Certifié par M. Ndour</div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

        </div>
      )}

      {/* TAB 3: VACCINS & CAMPAGNES */}
      {activeTab === 'vaccins' && (
        <div className="space-y-6 animate-in fade-in">
          
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
            <div>
              <h2 className="text-base sm:text-lg font-extrabold text-slate-900">
                Programme & Calendrier de Vaccination
              </h2>
              <p className="text-xs text-slate-500">
                Planification sectorisée pour G3, G4, G5 et G6. Validation médicale obligatoire par M. Ndour.
              </p>
            </div>

            {isVetOrAdmin && (
              <div className="flex flex-wrap items-center gap-2">
                <button
                  onClick={() => setShowAddVaccineModal(true)}
                  className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold rounded-xl text-xs transition"
                >
                  + Réception Lot Vaccin
                </button>
                <button
                  onClick={() => setShowScheduleVaccinationModal(true)}
                  className="px-3.5 py-2 bg-emerald-700 hover:bg-emerald-800 text-white font-bold rounded-xl text-xs shadow transition"
                >
                  + Programmer Vaccination
                </button>
              </div>
            )}
          </div>

          {/* Vaccines inventory list */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-4 border-b border-slate-200 bg-slate-50/70 font-bold text-xs uppercase text-slate-600">
              Vaccins Reçus & Stocks Disponibles ({vaccines.length})
            </div>

            {vaccines.length === 0 ? (
              <div className="p-8 text-center text-slate-400 text-xs">
                Aucun vaccin en stock actuellement.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-100 text-slate-600 font-extrabold border-b border-slate-200">
                      <th className="py-3 px-4">Vaccin</th>
                      <th className="py-3 px-3">Pathologie Cible</th>
                      <th className="py-3 px-3">Stock Restant</th>
                      <th className="py-3 px-3">Date Réception</th>
                      <th className="py-3 px-3">N° de Lot</th>
                      <th className="py-3 px-3">Péremption</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {vaccines.map(v => (
                      <tr key={v.id} className="hover:bg-slate-50 transition">
                        <td className="py-3 px-4 font-bold text-slate-900">{v.name}</td>
                        <td className="py-3 px-3 font-semibold text-emerald-800">{v.targetDisease}</td>
                        <td className="py-3 px-3">
                          <span className="font-black text-xs text-slate-900 bg-slate-100 px-2.5 py-1 rounded-md">
                            {(Number(v.currentStock) || 0).toLocaleString('fr-FR')} {v.unit}
                          </span>
                        </td>
                        <td className="py-3 px-3 text-slate-500 font-mono">{v.receptionDate}</td>
                        <td className="py-3 px-3 font-mono text-slate-700">{v.batchNumber}</td>
                        <td className="py-3 px-3 font-medium text-slate-700">{v.expiryDate}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Vaccination campaigns by sector */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-4 border-b border-slate-200 bg-slate-50/70 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <span className="font-bold text-xs uppercase text-slate-600">
                Calendrier des Vaccinations G3, G4, G5, G6 ({vaccinations.length})
              </span>
              
              <div className="flex items-center gap-2">
                <span className="text-[11px] text-slate-500">Filtrer bâtiment :</span>
                <select
                  value={selectedSectorFilter}
                  onChange={(e) => setSelectedSectorFilter(e.target.value as any)}
                  className="bg-white border border-slate-300 rounded-lg text-xs font-bold px-2 py-1"
                >
                  <option value="TOUS">Tous les secteurs</option>
                  {ALL_SECTORS.map(s => (
                    <option key={s} value={s} disabled={isEmployee && !allowedSectors.includes(s)}>
                      Secteur {s}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {vaccinations.length === 0 ? (
              <div className="p-12 text-center text-slate-400 text-xs">
                Aucune campagne de vaccination planifiée pour ce filtre.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-100 text-slate-600 font-extrabold border-b border-slate-200">
                      <th className="py-3 px-4">Secteur</th>
                      <th className="py-3 px-3">Vaccin</th>
                      <th className="py-3 px-3">Date Prévue</th>
                      <th className="py-3 px-3">Effectif Cible</th>
                      <th className="py-3 px-3">Voie d'Admin.</th>
                      <th className="py-3 px-3">Statut</th>
                      <th className="py-3 px-3">Date Réalisée</th>
                      <th className="py-3 px-4 text-right">Validation Vétérinaire</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {vaccinations.map(c => {
                      const isOverdue = c.status === 'PROGRAMMEE' && c.scheduledDate < new Date().toISOString().split('T')[0];
                      return (
                        <tr key={c.id} className="hover:bg-slate-50 transition">
                          <td className="py-3 px-4 font-black text-emerald-950">Secteur {c.sector}</td>
                          <td className="py-3 px-3 font-bold text-slate-900">{c.vaccineName}</td>
                          <td className="py-3 px-3 font-mono text-slate-700">{c.scheduledDate}</td>
                          <td className="py-3 px-3 text-slate-600">{c.targetBirdCount} poules</td>
                          <td className="py-3 px-3 text-[11px] font-semibold text-slate-600">{c.administrationRoute}</td>
                          <td className="py-3 px-3">
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase ${
                              c.status === 'REALISEE' ? 'bg-emerald-100 text-emerald-900' :
                              isOverdue ? 'bg-rose-100 text-rose-900 font-black' :
                              'bg-blue-100 text-blue-900'
                            }`}>
                              {c.status === 'REALISEE' ? 'Réalisée' : isOverdue ? 'En retard' : 'Programmée'}
                            </span>
                          </td>
                          <td className="py-3 px-3 text-slate-600">
                            {c.realizedDate ? (
                              <span className="font-bold text-emerald-900">{c.realizedDate} ({c.dosesAdministered} doses)</span>
                            ) : (
                              <span className="text-slate-400 italic">En attente</span>
                            )}
                          </td>
                          <td className="py-3 px-4 text-right">
                            {c.status === 'REALISEE' ? (
                              <span className="inline-flex items-center gap-1 text-emerald-700 font-bold text-[11px]">
                                <Check className="w-3.5 h-3.5 text-emerald-600" />
                                <span>Certifié par {c.vetName || 'M. Ndour'}</span>
                              </span>
                            ) : isVetOrAdmin ? (
                              <button
                                onClick={() => {
                                  setCampaignToRealize(c);
                                  setRealizeForm({
                                    realizedDate: new Date().toISOString().split('T')[0],
                                    dosesAdministered: c.targetBirdCount,
                                    observations: 'Protocole vaccinal exécuté avec succès.',
                                  });
                                  setShowRealizeVaccinationModal(true);
                                }}
                                className="px-3 py-1 bg-emerald-700 hover:bg-emerald-800 text-white font-bold rounded-lg text-[11px] shadow-sm transition"
                              >
                                Valider réalisation
                              </button>
                            ) : (
                              <span className="text-slate-400 text-[11px] italic">Validation M. Ndour requise</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

        </div>
      )}

      {/* TAB 4: TRAITEMENTS SANITAIRES */}
      {activeTab === 'traitements' && (
        <div className="space-y-6 animate-in fade-in">
          
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
            <div>
              <h2 className="text-base sm:text-lg font-extrabold text-slate-900">
                Registre des Traitements Sanitaires & Prescriptions
              </h2>
              <p className="text-xs text-slate-500">
                Prescriptions et posologies validées sous l'autorité du vétérinaire M. Ndour.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <select
                value={selectedSectorFilter}
                onChange={(e) => setSelectedSectorFilter(e.target.value as any)}
                className="bg-white border border-slate-300 rounded-xl text-xs font-bold px-3 py-2"
              >
                <option value="TOUS">Tous les secteurs</option>
                {ALL_SECTORS.map(s => (
                  <option key={s} value={s} disabled={isEmployee && !allowedSectors.includes(s)}>
                    Secteur {s}
                  </option>
                ))}
              </select>

              {isVetOrAdmin && (
                <button
                  onClick={() => setShowAddTreatmentModal(true)}
                  className="flex items-center gap-1.5 bg-emerald-700 hover:bg-emerald-800 text-white px-3.5 py-2 rounded-xl text-xs font-bold shadow transition"
                >
                  <Plus className="w-4 h-4" />
                  <span>Nouveau Traitement</span>
                </button>
              )}
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-4 border-b border-slate-200 bg-slate-50/70 font-bold text-xs uppercase text-slate-600">
              Historique des Traitements ({treatments.length})
            </div>

            {treatments.length === 0 ? (
              <div className="p-12 text-center text-slate-400 text-xs">
                Aucun traitement sanitaire enregistré pour ce filtre.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-100 text-slate-600 font-extrabold border-b border-slate-200">
                      <th className="py-3 px-4">Date & Secteur</th>
                      <th className="py-3 px-3">Motif / Diagnostic</th>
                      <th className="py-3 px-3">Produit Prescrit</th>
                      <th className="py-3 px-3">Dosage / Posologie Validé</th>
                      <th className="py-3 px-3">Période & Durée</th>
                      <th className="py-3 px-3">Délai Attente Œufs</th>
                      <th className="py-3 px-3">Statut</th>
                      <th className="py-3 px-4">Validation Praticien</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {treatments.map(t => (
                      <tr key={t.id} className="hover:bg-slate-50 transition">
                        <td className="py-3 px-4 font-bold text-slate-900">
                          <span className="inline-block px-2 py-0.5 rounded bg-emerald-800 text-white text-[11px] font-black mr-2">
                            {t.sector}
                          </span>
                          <span className="font-mono text-slate-600">{t.date}</span>
                        </td>
                        <td className="py-3 px-3 font-semibold text-slate-900">{t.diagnosis}</td>
                        <td className="py-3 px-3 font-bold text-emerald-950">{t.productName}</td>
                        <td className="py-3 px-3 text-purple-900 font-bold bg-purple-50/70 px-2 py-1 rounded">
                          {t.dosage}
                        </td>
                        <td className="py-3 px-3 text-slate-600">
                          {t.startDate} au {t.endDate} ({t.durationDays}j)
                        </td>
                        <td className="py-3 px-3 font-mono font-bold text-slate-700">
                          {t.withdrawalPeriodDays > 0 ? `${t.withdrawalPeriodDays} jours` : '0 jour'}
                        </td>
                        <td className="py-3 px-3">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase ${
                            t.status === 'EN_COURS' ? 'bg-amber-100 text-amber-900' :
                            t.status === 'TERMINE' ? 'bg-emerald-100 text-emerald-900' :
                            'bg-slate-100 text-slate-700'
                          }`}>
                            {t.status.replace('_', ' ')}
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          <div className="font-bold text-emerald-900 flex items-center gap-1">
                            <Check className="w-3.5 h-3.5 text-emerald-600" />
                            <span>{t.vetName || 'M. Ndour'}</span>
                          </div>
                          <div className="text-[10px] text-slate-400">Opérateur : {t.recordedByName}</div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

        </div>
      )}

      {/* TAB 5: RAPPORTS & FICHES OFFICIELLES (PDF / Image) */}
      {activeTab === 'exports' && (
        <div className="space-y-6 animate-in fade-in">
          
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
            <h2 className="text-base sm:text-lg font-extrabold text-slate-900">
              Édition & Téléchargement des Documents Vétérinaires Officiels
            </h2>
            <p className="text-xs text-slate-500 mt-1">
              Génération certifiée en PDF, image PNG ou JPG via le moteur d'exportation de <strong>POULAILLER CAMPEMENT</strong>.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            
            {/* Card 1: Fiche de stock médicaments */}
            <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm flex flex-col justify-between">
              <div>
                <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center mb-3">
                  <Activity className="w-5 h-5 text-emerald-700" />
                </div>
                <h3 className="font-bold text-base text-slate-900">Fiche de Pharmacie & Stocks</h3>
                <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                  Inventaire exhaustif des médicaments, dates de péremption, numéros de lots, niveaux d'alerte et derniers mouvements de sortie.
                </p>
              </div>

              <button
                onClick={() => {
                  setExportModalState({
                    isOpen: true,
                    type: 'medications',
                    title: 'Fiche Officielle de Pharmacie et Stocks Médicamenteux',
                    reference: `MED-${new Date().toISOString().split('T')[0]}`,
                  });
                }}
                className="mt-5 w-full flex items-center justify-center gap-2 bg-emerald-700 hover:bg-emerald-800 text-white font-bold py-2.5 rounded-xl text-xs shadow transition"
              >
                <Download className="w-4 h-4" />
                <span>Ouvrir & Télécharger (PDF/Image)</span>
              </button>
            </div>

            {/* Card 2: Registre vaccinal sectorisé */}
            <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm flex flex-col justify-between">
              <div>
                <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-700 flex items-center justify-center mb-3">
                  <Syringe className="w-5 h-5 text-blue-700" />
                </div>
                <h3 className="font-bold text-base text-slate-900">Calendrier & Registre Vaccinal</h3>
                <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                  Tableau officiel des vaccinations réalisées et programmées par secteur (G3, G4, G5, G6), doses, voies et visas du vétérinaire.
                </p>
              </div>

              <button
                onClick={() => {
                  setExportModalState({
                    isOpen: true,
                    type: 'vaccines',
                    title: 'Registre Officiel de Vaccination Sectorisée (G3-G6)',
                    reference: `VAC-${new Date().toISOString().split('T')[0]}`,
                  });
                }}
                className="mt-5 w-full flex items-center justify-center gap-2 bg-blue-700 hover:bg-blue-800 text-white font-bold py-2.5 rounded-xl text-xs shadow transition"
              >
                <Download className="w-4 h-4" />
                <span>Ouvrir & Télécharger (PDF/Image)</span>
              </button>
            </div>

            {/* Card 3: Registre Sanitaire & Traitements */}
            <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm flex flex-col justify-between">
              <div>
                <div className="w-10 h-10 rounded-xl bg-purple-50 text-purple-700 flex items-center justify-center mb-3">
                  <Stethoscope className="w-5 h-5 text-purple-700" />
                </div>
                <h3 className="font-bold text-base text-slate-900">Registre d'Élevage Sanitaire</h3>
                <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                  Historique complet des diagnostics, prescriptions, posologies validées et temps d'attente certifiés par le vétérinaire M. Ndour.
                </p>
              </div>

              <button
                onClick={() => {
                  setExportModalState({
                    isOpen: true,
                    type: 'treatments',
                    title: 'Registre d\'Élevage Sanitaire et Soins Vétérinaires',
                    reference: `SAN-${new Date().toISOString().split('T')[0]}`,
                  });
                }}
                className="mt-5 w-full flex items-center justify-center gap-2 bg-purple-800 hover:bg-purple-900 text-white font-bold py-2.5 rounded-xl text-xs shadow transition"
              >
                <Download className="w-4 h-4" />
                <span>Ouvrir & Télécharger (PDF/Image)</span>
              </button>
            </div>

          </div>

        </div>
      )}

      {/* DOCUMENT EXPORT MODAL CONTENT RENDERING */}
      {exportModalState.isOpen && (
        <DocumentExportModal
          isOpen={exportModalState.isOpen}
          onClose={() => setExportModalState(prev => ({ ...prev, isOpen: false }))}
          documentTitle={exportModalState.title}
          documentReference={exportModalState.reference}
          date={new Date().toISOString().split('T')[0]}
        >
          {exportModalState.type === 'medications' && (
            <div className="space-y-4 text-xs">
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl">
                <h4 className="font-bold text-slate-900 text-sm mb-1">INVENTAIRE PHARMACEUTIQUE OFFICIEL</h4>
                <p className="text-slate-500">Exploitation avicole POULAILLER CAMPEMENT • Suivi et traçabilité</p>
              </div>

              <table className="w-full text-left border-collapse border border-slate-300 text-xs">
                <thead>
                  <tr className="bg-slate-100 font-bold border-b border-slate-300">
                    <th className="p-2 border-r border-slate-300">Médicament</th>
                    <th className="p-2 border-r border-slate-300">Catégorie</th>
                    <th className="p-2 border-r border-slate-300">Stock Restant</th>
                    <th className="p-2 border-r border-slate-300">N° Lot</th>
                    <th className="p-2">Péremption</th>
                  </tr>
                </thead>
                <tbody>
                  {medications.map(m => (
                    <tr key={m.id} className="border-b border-slate-200">
                      <td className="p-2 border-r border-slate-200 font-bold">{m.name}</td>
                      <td className="p-2 border-r border-slate-200 capitalize">{m.category}</td>
                      <td className="p-2 border-r border-slate-200 font-black">{m.currentStock} {m.unit}</td>
                      <td className="p-2 border-r border-slate-200 font-mono">{m.batchNumber}</td>
                      <td className="p-2 font-medium">{m.expiryDate}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <div className="mt-6 pt-4 border-t border-slate-200 flex justify-between items-center text-[11px] text-slate-600">
                <div>Visa du Vétérinaire & Gérant : <strong>M. Ndour</strong></div>
                <div>Cachet & Signature de l'exploitation</div>
              </div>
            </div>
          )}

          {exportModalState.type === 'vaccines' && (
            <div className="space-y-4 text-xs">
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl">
                <h4 className="font-bold text-slate-900 text-sm mb-1">REGISTRE DES VACCINATIONS SECTORISÉES (G3, G4, G5, G6)</h4>
                <p className="text-slate-500">Plan de prophylaxie sanitaire • Responsable : M. Ndour</p>
              </div>

              <table className="w-full text-left border-collapse border border-slate-300 text-xs">
                <thead>
                  <tr className="bg-slate-100 font-bold border-b border-slate-300">
                    <th className="p-2 border-r border-slate-300">Bâtiment</th>
                    <th className="p-2 border-r border-slate-300">Vaccin</th>
                    <th className="p-2 border-r border-slate-300">Date Prévue</th>
                    <th className="p-2 border-r border-slate-300">Date Réalisée</th>
                    <th className="p-2 border-r border-slate-300">Doses</th>
                    <th className="p-2">Statut</th>
                  </tr>
                </thead>
                <tbody>
                  {vaccinations.map(v => (
                    <tr key={v.id} className="border-b border-slate-200">
                      <td className="p-2 border-r border-slate-200 font-bold">Secteur {v.sector}</td>
                      <td className="p-2 border-r border-slate-200 font-bold">{v.vaccineName}</td>
                      <td className="p-2 border-r border-slate-200 font-mono">{v.scheduledDate}</td>
                      <td className="p-2 border-r border-slate-200">{v.realizedDate || '—'}</td>
                      <td className="p-2 border-r border-slate-200">{v.dosesAdministered || v.targetBirdCount}</td>
                      <td className="p-2 font-bold uppercase">{v.status}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <div className="mt-6 pt-4 border-t border-slate-200 flex justify-between items-center text-[11px] text-slate-600">
                <div>Certification sanitaire : <strong>M. Ndour (Vétérinaire & Gérant)</strong></div>
                <div>POULAILLER CAMPEMENT</div>
              </div>
            </div>
          )}

          {exportModalState.type === 'treatments' && (
            <div className="space-y-4 text-xs">
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl">
                <h4 className="font-bold text-slate-900 text-sm mb-1">REGISTRE OFFICIEL DES SOINS & PRESCRIPTIONS</h4>
                <p className="text-slate-500">Traçabilité complète des traitements validés sous autorité vétérinaire</p>
              </div>

              <table className="w-full text-left border-collapse border border-slate-300 text-xs">
                <thead>
                  <tr className="bg-slate-100 font-bold border-b border-slate-300">
                    <th className="p-2 border-r border-slate-300">Date & Bât.</th>
                    <th className="p-2 border-r border-slate-300">Diagnostic</th>
                    <th className="p-2 border-r border-slate-300">Produit</th>
                    <th className="p-2 border-r border-slate-300">Posologie & Dosage</th>
                    <th className="p-2 border-r border-slate-300">Attente</th>
                    <th className="p-2">Visa Praticien</th>
                  </tr>
                </thead>
                <tbody>
                  {treatments.map(t => (
                    <tr key={t.id} className="border-b border-slate-200">
                      <td className="p-2 border-r border-slate-200 font-bold">{t.date} ({t.sector})</td>
                      <td className="p-2 border-r border-slate-200">{t.diagnosis}</td>
                      <td className="p-2 border-r border-slate-200 font-bold">{t.productName}</td>
                      <td className="p-2 border-r border-slate-200 font-mono font-bold text-purple-900">{t.dosage}</td>
                      <td className="p-2 border-r border-slate-200">{t.withdrawalPeriodDays} jours</td>
                      <td className="p-2 font-bold text-emerald-800">{t.vetName || 'M. Ndour'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <div className="mt-6 pt-4 border-t border-slate-200 flex justify-between items-center text-[11px] text-slate-600">
                <div>Prescription validée par : <strong>M. Ndour (Vétérinaire)</strong></div>
                <div>Validité juridique et traçabilité archivée</div>
              </div>
            </div>
          )}
        </DocumentExportModal>
      )}

      {/* MODAL 1: AJOUTER UN MÉDICAMENT */}
      {showAddMedModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95">
            <div className="flex justify-between items-center pb-3 border-b border-slate-200">
              <h3 className="font-extrabold text-base text-slate-900 flex items-center gap-2">
                <Activity className="w-5 h-5 text-emerald-700" />
                <span>Nouveau Médicament en Pharmacie</span>
              </h3>
              <button onClick={() => setShowAddMedModal(false)} className="text-slate-400 hover:text-slate-700">✕</button>
            </div>

            <form onSubmit={handleCreateMedication} className="space-y-3 mt-4 text-xs">
              <div>
                <label className="font-bold text-slate-700 block mb-1">Nom du produit / Spécialité :</label>
                <input
                  type="text"
                  required
                  placeholder="ex: Oxytétracycline 20%"
                  value={medForm.name}
                  onChange={(e) => setMedForm({ ...medForm, name: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 font-bold text-slate-900"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Catégorie :</label>
                  <select
                    value={medForm.category}
                    onChange={(e) => setMedForm({ ...medForm, category: e.target.value as any })}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 font-semibold text-slate-800"
                  >
                    <option value="antibiotique">Antibiotique</option>
                    <option value="vitamine">Vitamine / Complément</option>
                    <option value="antiparasitaire">Antiparasitaire</option>
                    <option value="desinfectant">Désinfectant</option>
                    <option value="autre">Autre</option>
                  </select>
                </div>

                <div>
                  <label className="font-bold text-slate-700 block mb-1">Conditionnement :</label>
                  <input
                    type="text"
                    required
                    value={medForm.unit}
                    onChange={(e) => setMedForm({ ...medForm, unit: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 text-slate-800"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Stock initial :</label>
                  <input
                    type="number"
                    min="0"
                    required
                    value={medForm.currentStock}
                    onChange={(e) => setMedForm({ ...medForm, currentStock: Number(e.target.value) })}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 font-mono font-bold"
                  />
                </div>

                <div>
                  <label className="font-bold text-slate-700 block mb-1">Seuil d'alerte :</label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={medForm.minimumStockAlert}
                    onChange={(e) => setMedForm({ ...medForm, minimumStockAlert: Number(e.target.value) })}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 font-mono font-bold"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">N° de lot :</label>
                  <input
                    type="text"
                    placeholder="ex: LOT-2026-90"
                    value={medForm.batchNumber}
                    onChange={(e) => setMedForm({ ...medForm, batchNumber: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 font-mono"
                  />
                </div>

                <div>
                  <label className="font-bold text-slate-700 block mb-1">Date péremption :</label>
                  <input
                    type="date"
                    required
                    value={medForm.expiryDate}
                    onChange={(e) => setMedForm({ ...medForm, expiryDate: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 font-mono"
                  />
                </div>
              </div>

              <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-200 text-[11px] text-emerald-900 flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-700 flex-shrink-0" />
                <span>Enregistrement certifié sous la responsabilité du vétérinaire M. Ndour.</span>
              </div>

              <div className="pt-3 border-t border-slate-200 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowAddMedModal(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 font-bold rounded-xl text-slate-700"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white font-bold rounded-xl shadow"
                >
                  Enregistrer
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: MOUVEMENT STOCK MÉDICAMENT */}
      {showMedMovementModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95">
            <div className="flex justify-between items-center pb-3 border-b border-slate-200">
              <h3 className="font-extrabold text-base text-slate-900">
                Mouvement Stock : {selectedMedForMovement?.name}
              </h3>
              <button onClick={() => setShowMedMovementModal(false)} className="text-slate-400 hover:text-slate-700">✕</button>
            </div>

            <form onSubmit={handleAddMovement} className="space-y-3 mt-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Type de mouvement :</label>
                  <select
                    value={movForm.type}
                    onChange={(e) => setMovForm({ ...movForm, type: e.target.value as any })}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 font-bold"
                  >
                    <option value="SORTIE_TRAITEMENT">Sortie pour Traitement</option>
                    <option value="ENTREE">Entrée / Réapprovisionnement</option>
                    <option value="PERIME_REBUT">Rebut Périmé</option>
                    <option value="AJUSTEMENT">Ajustement inventaire</option>
                  </select>
                </div>

                <div>
                  <label className="font-bold text-slate-700 block mb-1">Quantité :</label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={movForm.quantity}
                    onChange={(e) => setMovForm({ ...movForm, quantity: Number(e.target.value) })}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 font-mono font-bold"
                  />
                </div>
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Bâtiment / Secteur concerné :</label>
                <select
                  value={movForm.sector}
                  onChange={(e) => setMovForm({ ...movForm, sector: e.target.value as any })}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 font-semibold"
                >
                  <option value="G3">Secteur G3</option>
                  <option value="G4">Secteur G4</option>
                  <option value="G5">Secteur G5</option>
                  <option value="G6">Secteur G6</option>
                  <option value="TOUS">Tous les secteurs</option>
                  <option value="CENTRAL">Stock Central Pharmacie</option>
                </select>
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Motif de l'opération :</label>
                <input
                  type="text"
                  required
                  placeholder="ex: Traitement préventif picage / infection respiratoire"
                  value={movForm.reason}
                  onChange={(e) => setMovForm({ ...movForm, reason: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5"
                />
              </div>

              {movForm.type === 'SORTIE_TRAITEMENT' && (
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Posologie / Dosage prescrit :</label>
                  <input
                    type="text"
                    required
                    placeholder="ex: 1g/litre d'eau de boisson pendant 3 jours"
                    value={movForm.dosagePrescrit}
                    onChange={(e) => setMovForm({ ...movForm, dosagePrescrit: e.target.value })}
                    className="w-full bg-purple-50 border border-purple-200 rounded-xl p-2.5 font-medium text-purple-950"
                  />
                  <span className="text-[10px] text-slate-500 mt-0.5 block">
                    Conformément aux instructions du vétérinaire M. Ndour
                  </span>
                </div>
              )}

              <div className="pt-3 border-t border-slate-200 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowMedMovementModal(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 font-bold rounded-xl text-slate-700"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white font-bold rounded-xl shadow"
                >
                  Valider le mouvement
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 3: AJOUTER LOT DE VACCINS */}
      {showAddVaccineModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95">
            <div className="flex justify-between items-center pb-3 border-b border-slate-200">
              <h3 className="font-extrabold text-base text-slate-900 flex items-center gap-2">
                <Syringe className="w-5 h-5 text-emerald-700" />
                <span>Réception d'un Lot de Vaccins</span>
              </h3>
              <button onClick={() => setShowAddVaccineModal(false)} className="text-slate-400 hover:text-slate-700">✕</button>
            </div>

            <form onSubmit={handleCreateVaccine} className="space-y-3 mt-4 text-xs">
              <div>
                <label className="font-bold text-slate-700 block mb-1">Nom commercial du vaccin :</label>
                <input
                  type="text"
                  required
                  placeholder="ex: Nobilis Newcastle LaSota"
                  value={vacForm.name}
                  onChange={(e) => setVacForm({ ...vacForm, name: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 font-bold"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Maladie / Pathologie ciblée :</label>
                <input
                  type="text"
                  required
                  placeholder="ex: Maladie de Newcastle, Gumboro IBD, Variole..."
                  value={vacForm.targetDisease}
                  onChange={(e) => setVacForm({ ...vacForm, targetDisease: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 font-semibold text-emerald-900"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Nombre de doses reçues :</label>
                  <input
                    type="number"
                    min="100"
                    step="100"
                    required
                    value={vacForm.quantityReceived}
                    onChange={(e) => setVacForm({ ...vacForm, quantityReceived: Number(e.target.value) })}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 font-mono font-bold"
                  />
                </div>

                <div>
                  <label className="font-bold text-slate-700 block mb-1">Seuil alerte doses :</label>
                  <input
                    type="number"
                    min="500"
                    step="500"
                    required
                    value={vacForm.minimumStockAlert}
                    onChange={(e) => setVacForm({ ...vacForm, minimumStockAlert: Number(e.target.value) })}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 font-mono font-bold"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">N° de lot fabricant :</label>
                  <input
                    type="text"
                    placeholder="ex: LOT-VAC-5541"
                    value={vacForm.batchNumber}
                    onChange={(e) => setVacForm({ ...vacForm, batchNumber: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 font-mono"
                  />
                </div>

                <div>
                  <label className="font-bold text-slate-700 block mb-1">Date péremption :</label>
                  <input
                    type="date"
                    required
                    value={vacForm.expiryDate}
                    onChange={(e) => setVacForm({ ...vacForm, expiryDate: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 font-mono"
                  />
                </div>
              </div>

              <div className="pt-3 border-t border-slate-200 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowAddVaccineModal(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 font-bold rounded-xl text-slate-700"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white font-bold rounded-xl shadow"
                >
                  Enregistrer le vaccin
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 4: PROGRAMMER VACCINATION */}
      {showScheduleVaccinationModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95">
            <div className="flex justify-between items-center pb-3 border-b border-slate-200">
              <h3 className="font-extrabold text-base text-slate-900 flex items-center gap-2">
                <Calendar className="w-5 h-5 text-emerald-700" />
                <span>Programmer une Vaccination</span>
              </h3>
              <button onClick={() => setShowScheduleVaccinationModal(false)} className="text-slate-400 hover:text-slate-700">✕</button>
            </div>

            <form onSubmit={handleScheduleVaccination} className="space-y-3 mt-4 text-xs">
              <div>
                <label className="font-bold text-slate-700 block mb-1">Nom du vaccin / Protocole :</label>
                <input
                  type="text"
                  required
                  placeholder="ex: Newcastle Rappel B1 / LaSota"
                  value={campForm.vaccineName}
                  onChange={(e) => setCampForm({ ...campForm, vaccineName: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 font-bold"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Secteur cible :</label>
                  <select
                    value={campForm.sector}
                    onChange={(e) => setCampForm({ ...campForm, sector: e.target.value as SectorId })}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 font-bold text-emerald-900"
                  >
                    {ALL_SECTORS.map(s => (
                      <option key={s} value={s}>Secteur {s}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="font-bold text-slate-700 block mb-1">Date prévue :</label>
                  <input
                    type="date"
                    required
                    value={campForm.scheduledDate}
                    onChange={(e) => setCampForm({ ...campForm, scheduledDate: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Effectif cible (poules) :</label>
                  <input
                    type="number"
                    min="100"
                    required
                    value={campForm.targetBirdCount}
                    onChange={(e) => setCampForm({ ...campForm, targetBirdCount: Number(e.target.value) })}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 font-mono font-bold"
                  />
                </div>

                <div>
                  <label className="font-bold text-slate-700 block mb-1">Voie d'administration :</label>
                  <select
                    value={campForm.administrationRoute}
                    onChange={(e) => setCampForm({ ...campForm, administrationRoute: e.target.value as any })}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 font-semibold"
                  >
                    <option value="EAU_BOISSON">Eau de boisson</option>
                    <option value="GEL">Goutte oculaire / Nasale</option>
                    <option value="NEBULISATION">Nébulisation / Spray</option>
                    <option value="INJECTION">Injection sous-cutanée</option>
                    <option value="TRANSLUCIDE_AILE">Transfixion alaire (Variole)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Consignes & Observations :</label>
                <textarea
                  rows={2}
                  placeholder="ex: Soif préalable de 2h avant distribution dans les abreuvoirs."
                  value={campForm.observations}
                  onChange={(e) => setCampForm({ ...campForm, observations: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5"
                />
              </div>

              <div className="pt-3 border-t border-slate-200 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowScheduleVaccinationModal(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 font-bold rounded-xl text-slate-700"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white font-bold rounded-xl shadow"
                >
                  Planifier la vaccination
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 5: VALIDER RÉALISATION VACCINATION */}
      {showRealizeVaccinationModal && campaignToRealize && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95">
            <div className="flex justify-between items-center pb-3 border-b border-slate-200">
              <h3 className="font-extrabold text-base text-slate-900 flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-emerald-700" />
                <span>Certification Vaccinale : Secteur {campaignToRealize.sector}</span>
              </h3>
              <button onClick={() => setShowRealizeVaccinationModal(false)} className="text-slate-400 hover:text-slate-700">✕</button>
            </div>

            <form onSubmit={handleRealizeVaccination} className="space-y-3 mt-4 text-xs">
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl">
                <span className="text-slate-500 block text-[11px]">Vaccin planifié :</span>
                <strong className="text-slate-900 text-sm block">{campaignToRealize.vaccineName}</strong>
                <span className="text-[11px] text-slate-500">Date prévue initiale : {campaignToRealize.scheduledDate}</span>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Date réelle de réalisation :</label>
                  <input
                    type="date"
                    required
                    value={realizeForm.realizedDate}
                    onChange={(e) => setRealizeForm({ ...realizeForm, realizedDate: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 font-mono font-bold"
                  />
                </div>

                <div>
                  <label className="font-bold text-slate-700 block mb-1">Doses administrées :</label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={realizeForm.dosesAdministered}
                    onChange={(e) => setRealizeForm({ ...realizeForm, dosesAdministered: Number(e.target.value) })}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 font-mono font-bold"
                  />
                </div>
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Observations vétérinaires :</label>
                <textarea
                  rows={2}
                  value={realizeForm.observations}
                  onChange={(e) => setRealizeForm({ ...realizeForm, observations: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5"
                />
              </div>

              <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-[11px] text-emerald-950 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-700 flex-shrink-0" />
                <span>Certification sous visa de <strong>M. Ndour</strong> (Vétérinaire & Gérant).</span>
              </div>

              <div className="pt-3 border-t border-slate-200 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowRealizeVaccinationModal(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 font-bold rounded-xl text-slate-700"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white font-bold rounded-xl shadow"
                >
                  Certifier la vaccination
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 6: NOUVEAU TRAITEMENT SANITAIRE */}
      {showAddTreatmentModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95">
            <div className="flex justify-between items-center pb-3 border-b border-slate-200">
              <h3 className="font-extrabold text-base text-slate-900 flex items-center gap-2">
                <Stethoscope className="w-5 h-5 text-emerald-700" />
                <span>Prescription & Traitement Sanitaire</span>
              </h3>
              <button onClick={() => setShowAddTreatmentModal(false)} className="text-slate-400 hover:text-slate-700">✕</button>
            </div>

            <form onSubmit={handleCreateTreatment} className="space-y-3 mt-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Bâtiment / Secteur :</label>
                  <select
                    value={treatForm.sector}
                    onChange={(e) => setTreatForm({ ...treatForm, sector: e.target.value as SectorId })}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 font-bold text-emerald-950"
                  >
                    {ALL_SECTORS.map(s => (
                      <option key={s} value={s}>Secteur {s}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="font-bold text-slate-700 block mb-1">Type de soin :</label>
                  <select
                    value={treatForm.treatmentType}
                    onChange={(e) => setTreatForm({ ...treatForm, treatmentType: e.target.value as any })}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 font-semibold"
                  >
                    <option value="MEDICAMENT">Médicamenteux / Curatif</option>
                    <option value="PREVENTIF">Préventif / Vitamines</option>
                    <option value="VACCINATION">Intervention Vaccinale</option>
                    <option value="DESINFECTION">Désinfection / Pédiluve</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Symptôme / Motif sanitaire / Diagnostic :</label>
                <input
                  type="text"
                  required
                  placeholder="ex: Baisse d'appétit, fientes anormales, stress thermique..."
                  value={treatForm.diagnosis}
                  onChange={(e) => setTreatForm({ ...treatForm, diagnosis: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 font-bold"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Produit ou Molécule prescrite :</label>
                <input
                  type="text"
                  required
                  placeholder="ex: Oxytétracycline 20% + Vitamines AD3E"
                  value={treatForm.productName}
                  onChange={(e) => setTreatForm({ ...treatForm, productName: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 font-bold text-slate-900"
                />
              </div>

              <div>
                <label className="font-bold text-purple-900 block mb-1">
                  Posologie et Dosage précis (Validé par M. Ndour) :
                </label>
                <input
                  type="text"
                  required
                  placeholder="ex: 10 ml par 10 litres d'eau de boisson pendant 5 jours consécutifs"
                  value={treatForm.dosage}
                  onChange={(e) => setTreatForm({ ...treatForm, dosage: e.target.value })}
                  className="w-full bg-purple-50 border border-purple-300 rounded-xl p-2.5 font-bold text-purple-950"
                />
                <span className="text-[10px] text-slate-500 mt-0.5 block">
                  Exigence réglementaire : le praticien valide le dosage exact sans approximation.
                </span>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Date début :</label>
                  <input
                    type="date"
                    required
                    value={treatForm.startDate}
                    onChange={(e) => setTreatForm({ ...treatForm, startDate: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2 font-mono"
                  />
                </div>

                <div>
                  <label className="font-bold text-slate-700 block mb-1">Durée (jours) :</label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={treatForm.durationDays}
                    onChange={(e) => setTreatForm({ ...treatForm, durationDays: Number(e.target.value) })}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2 font-mono font-bold"
                  />
                </div>

                <div>
                  <label className="font-bold text-slate-700 block mb-1">Délai attente œufs (j) :</label>
                  <input
                    type="number"
                    min="0"
                    value={treatForm.withdrawalPeriodDays}
                    onChange={(e) => setTreatForm({ ...treatForm, withdrawalPeriodDays: Number(e.target.value) })}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2 font-mono font-bold"
                  />
                </div>
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Remarques & Suivi :</label>
                <textarea
                  rows={2}
                  placeholder="ex: Surveiller l'abreuvement et noter l'évolution de la ponte."
                  value={treatForm.observations}
                  onChange={(e) => setTreatForm({ ...treatForm, observations: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5"
                />
              </div>

              <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-[11px] text-emerald-950 flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-700 flex-shrink-0" />
                <span>Validé et certifié sous la responsabilité de <strong>M. Ndour (Vétérinaire & Gérant)</strong>.</span>
              </div>

              <div className="pt-3 border-t border-slate-200 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowAddTreatmentModal(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 font-bold rounded-xl text-slate-700"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white font-bold rounded-xl shadow"
                >
                  Valider la prescription
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};
