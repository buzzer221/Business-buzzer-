export type SectorId = 'G3' | 'G4' | 'G5' | 'G6';

export const ALL_SECTORS: SectorId[] = ['G3', 'G4', 'G5', 'G6'];

export type UserRole = 'admin' | 'manager' | 'employee' | 'veterinaire';

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  active: boolean;
  phone?: string;
  assignedSectors: SectorId[];
  createdAt: string;
  lastLoginAt?: string;
  hasPin?: boolean;
}

export interface UserSession {
  token: string;
  userId: string;
  userName: string;
  userRole: UserRole;
  createdAt: string;
  lastSeenAt: string;
  expiresAt?: string;
}

export interface AuthResponse {
  success: boolean;
  token: string;
  user: User;
  allowedSectors: SectorId[];
}

export type SyncEventType = 
  | 'collection' 
  | 'stock' 
  | 'sale' 
  | 'invoice' 
  | 'mortality' 
  | 'medication' 
  | 'vaccination' 
  | 'treatment' 
  | 'user' 
  | 'settings';

export interface SyncEvent {
  id: string;
  type: SyncEventType;
  action: 'create' | 'update' | 'delete';
  entityId: string;
  userId: string;
  userName: string;
  timestamp: string;
  data?: any;
}

export type LiveSyncStatus = 'online' | 'syncing' | 'offline' | 'error';

export interface AuditLogEntry {
  id: string;
  timestamp: string;
  userId: string;
  userName: string;
  userRole: UserRole;
  action: string;
  sector?: SectorId | 'CENTRAL' | 'TOUS';
  details: string;
  entityId?: string;
}

export interface UserSectorAssignment {
  id: string;
  userId: string;
  sector: SectorId;
  assignedAt: string;
  assignedBy: string;
  active: boolean;
}

// --- Suivi Vétérinaire & Sanitaire (M. Ndour) ---
export type MedicationCategory = 'antibiotique' | 'vitamine' | 'antiparasitaire' | 'desinfectant' | 'autre';

export interface MedicationItem {
  id: string;
  name: string;
  category: MedicationCategory;
  unit: string; // ex: flacon 100ml, sachet 100g, litre, boîte
  currentStock: number;
  minimumStockAlert: number;
  expiryDate: string; // YYYY-MM-DD
  batchNumber: string;
  validatedByVet: boolean;
  vetName?: string;
  createdAt: string;
  updatedAt: string;
}

export type MedicationMovementType = 'ENTREE' | 'SORTIE_TRAITEMENT' | 'PERIME_REBUT' | 'AJUSTEMENT';

export interface MedicationMovement {
  id: string;
  medicationId: string;
  medicationName: string;
  type: MedicationMovementType;
  quantity: number;
  previousStock: number;
  newStock: number;
  date: string; // YYYY-MM-DD
  sector: SectorId | 'TOUS' | 'CENTRAL';
  reason: string;
  dosagePrescrit?: string;
  performedBy: string;
  performedByName: string;
  validatedByVet: boolean;
  validatedByVetName?: string;
  timestamp: string;
}

export interface VaccineItem {
  id: string;
  name: string;
  targetDisease: string;
  unit: string; // ex: Doses, Flacon 1000 doses
  quantityReceived: number;
  currentStock: number;
  minimumStockAlert: number;
  receptionDate: string; // YYYY-MM-DD
  expiryDate: string; // YYYY-MM-DD
  batchNumber: string;
  validatedByVet: boolean;
  vetName?: string;
  createdAt: string;
}

export type VaccinationStatus = 'PROGRAMMEE' | 'REALISEE' | 'EN_RETARD' | 'REPORTEE' | 'ANNULEE';
export type VaccinationRoute = 'EAU_BOISSON' | 'GEL' | 'INJECTION' | 'NEBULISATION' | 'TRANSLUCIDE_AILE' | 'AUTRE';

export interface VaccinationCampaign {
  id: string;
  vaccineId: string;
  vaccineName: string;
  sector: SectorId;
  scheduledDate: string; // YYYY-MM-DD (vaccination prévue)
  targetBirdCount: number;
  status: VaccinationStatus;
  realizedDate?: string; // YYYY-MM-DD (vaccination réalisée)
  dosesAdministered?: number;
  administrationRoute: VaccinationRoute;
  observations?: string;
  validatedByVet: boolean;
  vetId?: string;
  vetName?: string;
  recordedBy: string;
  recordedByName: string;
  createdAt: string;
  updatedAt: string;
}

export interface SanitaryTreatmentRecord {
  id: string;
  date: string; // YYYY-MM-DD
  sector: SectorId;
  diagnosis: string; // Symptôme / Diagnostic
  treatmentType: 'MEDICAMENT' | 'VACCINATION' | 'DESINFECTION' | 'PREVENTIF';
  productName: string;
  dosage: string; // Posologie et dosage validé par M. Ndour
  durationDays: number;
  startDate: string;
  endDate: string;
  withdrawalPeriodDays: number; // Temps d'attente (délai avant consommation œufs)
  status: 'EN_COURS' | 'TERMINE' | 'ARRETE';
  observations: string;
  validatedByVet: boolean;
  vetId: string;
  vetName: string;
  recordedBy: string;
  recordedByName: string;
  createdAt: string;
}

export interface VeterinaryAlerts {
  lowStockMedications: MedicationItem[];
  lowStockVaccines: VaccineItem[];
  expiringMedications: MedicationItem[]; // périmé ou dans les 30 jours
  expiringVaccines: VaccineItem[];
  upcomingVaccinations: VaccinationCampaign[]; // 7 prochains jours
  overdueVaccinations: VaccinationCampaign[]; // programmée mais dépassée
  totalAlertsCount: number;
}

export type SlotTime = '10H' | '13H' | '16H';
export const SLOTS: SlotTime[] = ['10H', '13H', '16H'];

export interface CollectionRecord {
  id: string;
  date: string; // YYYY-MM-DD
  slot: SlotTime;
  sector: SectorId;
  trays: number; // Collecte principale en NOMBRE DE PLATEAUX
  brokenEggs: number; // Œufs cassés / fêlés (comptabilisés individuellement en unités d'œufs)
  doubleYolkEggs: number; // Œufs à double jaune (comptabilisés individuellement en unités d'œufs)
  depositTrays: number; // Dépôt en stock (en nombre de plateaux)
  quantity: number; // alias de compatibilité (plateaux)
  cracked: number; // alias de compatibilité (cassés)
  deposit: number; // alias de compatibilité (dépôt plateaux)
  recordedBy: string;
  recordedByName?: string;
  updatedAt: string;
}

export interface DailySummary {
  date: string;
  isComplete: boolean;
  completedAt: string | null;
  totalTrays: number; // Total général en nombre de plateaux
  totalBrokenEggs: number; // Total général œufs cassés (unités)
  totalDoubleYolkEggs: number; // Total général œufs à double jaune (unités)
  totalDepositedTrays: number; // Total général dépôts en stock (plateaux)
  totalEggs: number; // alias pour compatibilité
  totalCracked: number; // alias pour compatibilité
  totalDeposited: number; // alias pour compatibilité
  bySector: Record<SectorId, {
    trays: number;
    brokenEggs: number;
    doubleYolkEggs: number;
    depositTrays: number;
    total: number;
    cracked: number;
    deposit: number;
  }>;
  bySlot: Record<SlotTime, number | {
    trays: number;
    brokenEggs: number;
    doubleYolkEggs: number;
  }>;
  bySlotDetailed?: Record<SlotTime, {
    trays: number;
    brokenEggs: number;
    doubleYolkEggs: number;
  }>;
  emailSent: boolean;
  emailSentAt: string | null;
  emailRecipient: string;
  emailMessageId?: string;
  emailStatus: 'pending' | 'sent' | 'non_configure' | 'error';
  emailError?: string;
}

export type StockItemType = 'OEFS_STANDARDS' | 'OEFS_FELES' | 'PLATEAUX_VIDES' | 'ALIMENT';

export type MovementType = 'ENTREE' | 'SORTIE' | 'DEPOT_RAMASSAGE' | 'VENTE' | 'AJUSTEMENT';

export interface StockMovement {
  id: string;
  date: string;
  sector: SectorId | 'CENTRAL';
  itemType: StockItemType;
  quantity: number;
  movementType: MovementType;
  reason: string;
  performedBy: string;
  performedByName?: string;
  timestamp: string;
  notes?: string;
}

export interface StockBalance {
  sector: SectorId | 'CENTRAL';
  oefsStandards: number; // en œufs
  oefsFeles: number; // en œufs
  plateauxVides: number; // alvéoles
  alimentKg: number; // kg
}

export interface MortalityRecord {
  id: string;
  date: string;
  sector: SectorId;
  count: number;
  cause: string;
  recordedBy: string;
  recordedByName?: string;
  notes?: string;
  timestamp: string;
}

export interface Client {
  id: string;
  name: string;
  phone: string;
  email?: string;
  address?: string;
  balanceDue: number;
  createdAt: string;
}

export interface SaleRecord {
  id: string;
  date: string;
  clientId: string;
  clientName: string;
  sector: SectorId | 'CENTRAL';
  itemType: string;
  quantity: number;
  unitPrice: number;
  totalAmount: number;
  status: 'validee' | 'en_attente' | 'annulee';
  invoiceId?: string;
  recordedBy: string;
  recordedByName?: string;
  createdAt: string;
}

export interface InvoiceItem {
  id: string;
  description: string;
  quantity: number;
  unitPrice: number;
  total: number;
}

export type InvoiceStatus = 'brouillon' | 'envoyee' | 'partiellement_payee' | 'payee' | 'annulee';

export interface Invoice {
  id: string;
  number: string; // e.g. FAC-2026-0001
  date: string;
  clientId: string;
  clientName: string;
  clientPhone: string;
  clientAddress?: string;
  sector?: SectorId | 'CENTRAL';
  items: InvoiceItem[];
  subtotal: number;
  discount: number;
  total: number;
  amountPaid: number;
  balanceDue: number;
  status: InvoiceStatus;
  notes?: string;
  createdBy: string;
  createdByName?: string;
  createdAt: string;
}

export interface EmailLog {
  id: string;
  recipient: string;
  subject: string;
  type: 'ramassage_quotidien' | 'facture' | 'test';
  status: 'sent' | 'non_configure' | 'error';
  messageId?: string;
  previewHtml?: string;
  error?: string;
  timestamp: string;
}

export interface FarmSettings {
  farmName: string;
  address: string;
  phone: string;
  email: string;
  managerEmail: string;
  currency: string;
  sectorFlocks: Record<SectorId, number>; // poules pondeuses actuelles
  smtpHost: string;
  smtpPort: number;
  smtpSecure: boolean;
  smtpUser: string;
  smtpPass: string;
  smtpFrom: string;
  sessionDurationHours?: number;
  requireReauthForSensitiveOps?: boolean;
  requirePasswordOnAppOpen?: boolean;
}

export interface DeletedRecord {
  id: string;
  entityType: 'collection' | 'stock' | 'sale' | 'invoice' | 'mortality' | 'treatment' | 'vaccination' | 'user';
  entityId: string;
  data: any;
  deletedAt: string;
  deletedBy: string;
  deletedByName: string;
  reason: string;
}
