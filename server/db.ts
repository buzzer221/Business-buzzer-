import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import {
  ALL_SECTORS,
  AuditLogEntry,
  Client,
  CollectionRecord,
  DailySummary,
  EmailLog,
  FarmSettings,
  Invoice,
  MedicationItem,
  MedicationMovement,
  MortalityRecord,
  SaleRecord,
  SanitaryTreatmentRecord,
  SectorId,
  SLOTS,
  SlotTime,
  StockMovement,
  SyncEvent,
  User,
  UserRole,
  UserSectorAssignment,
  UserSession,
  VaccinationCampaign,
  VaccineItem,
  VeterinaryAlerts
} from '../src/types/index.js';

type SyncListener = (event: SyncEvent) => void;

export class SyncBroadcastHub {
  private listeners: Set<SyncListener> = new Set();

  public subscribe(listener: SyncListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  public broadcast(event: SyncEvent) {
    for (const listener of this.listeners) {
      try {
        listener(event);
      } catch (err) {
        console.error('Error broadcasting sync event:', err);
      }
    }
  }
}

export const syncHub = new SyncBroadcastHub();

export function hashPin(pin: string, salt: string): string {
  return crypto.pbkdf2Sync(pin, salt, 1000, 32, 'sha256').toString('hex');
}

interface DatabaseSchema {
  users: User[];
  sectorAssignments: UserSectorAssignment[];
  collections: CollectionRecord[];
  dailySummaries: Record<string, DailySummary>;
  stockMovements: StockMovement[];
  mortality: MortalityRecord[];
  clients: Client[];
  sales: SaleRecord[];
  invoices: Invoice[];
  emailLogs: EmailLog[];
  settings: FarmSettings;
  medications: MedicationItem[];
  medicationMovements: MedicationMovement[];
  vaccines: VaccineItem[];
  vaccinations: VaccinationCampaign[];
  sanitaryTreatments: SanitaryTreatmentRecord[];
  userCredentials?: Record<string, { salt: string; hash: string }>;
  sessions?: Record<string, UserSession>;
  processedActions?: Record<string, { processedAt: string; entityId: string }>;
  auditLogs?: AuditLogEntry[];
  deletedRecords?: Array<{
    id: string;
    entityType: string;
    entityId: string;
    data: any;
    deletedAt: string;
    deletedBy: string;
    deletedByName: string;
    reason: string;
  }>;
}

const DATA_DIR = path.resolve(process.cwd(), 'data');
const DB_FILE = path.resolve(DATA_DIR, 'avipo_db.json');

const INITIAL_SETTINGS: FarmSettings = {
  farmName: 'POULAILLER CAMPEMENT — Domaine Avicole',
  address: 'Zone Agro-Industrielle, Pout, Sénégal',
  phone: '+221 77 123 45 67',
  email: 'contact@poulaillercampement.sn',
  managerEmail: process.env.NOTIFICATION_EMAIL || 'boubacarsene8@gmail.com',
  currency: 'FCFA',
  sectorFlocks: {
    G3: 2500,
    G4: 2500,
    G5: 2200,
    G6: 2800,
  },
  smtpHost: process.env.SMTP_HOST || 'smtp.gmail.com',
  smtpPort: parseInt(process.env.SMTP_PORT || '587', 10),
  smtpSecure: process.env.SMTP_SECURE === 'true',
  smtpUser: process.env.SMTP_USER || '',
  smtpPass: process.env.SMTP_PASS || '',
  smtpFrom: process.env.SMTP_FROM || 'POULAILLER CAMPEMENT <notifications@poulaillercampement.sn>',
  sessionDurationHours: 24,
  requireReauthForSensitiveOps: true,
  requirePasswordOnAppOpen: true,
};

const INITIAL_USERS: User[] = [
  {
    id: 'usr_admin',
    name: 'Boubacar Sene (Admin Principal)',
    email: 'boubacarsene8@gmail.com',
    role: 'admin',
    active: true,
    phone: '+221 77 800 00 01',
    assignedSectors: ['G3', 'G4', 'G5', 'G6'],
    createdAt: '2026-01-01T08:00:00Z',
    lastLoginAt: new Date().toISOString(),
  },
  {
    id: 'usr_awa_gassama',
    name: 'Awa Gassama (Gérante)',
    email: 'awa.gassama@poulaillercampement.sn',
    role: 'manager',
    active: true,
    phone: '+221 77 810 00 02',
    assignedSectors: ['G3', 'G4', 'G5', 'G6'],
    createdAt: '2026-01-05T08:00:00Z',
    lastLoginAt: new Date().toISOString(),
  },
  {
    id: 'usr_dr_ndour',
    name: 'M. Ndour (Vétérinaire & Gérant)',
    email: 'ndour.veterinaire@poulaillercampement.sn',
    role: 'veterinaire',
    active: true,
    phone: '+221 77 870 00 08',
    assignedSectors: ['G3', 'G4', 'G5', 'G6'],
    createdAt: '2026-01-05T08:00:00Z',
    lastLoginAt: new Date().toISOString(),
  },
  {
    id: 'usr_saliou',
    name: 'Saliou (Secteur G3)',
    email: 'saliou.g3@poulaillercampement.sn',
    role: 'employee',
    active: true,
    phone: '+221 77 820 00 03',
    assignedSectors: ['G3'],
    createdAt: '2026-01-10T08:00:00Z',
    lastLoginAt: new Date().toISOString(),
  },
  {
    id: 'usr_moustapha',
    name: 'Moustapha (Secteur G4)',
    email: 'moustapha.g4@poulaillercampement.sn',
    role: 'employee',
    active: true,
    phone: '+221 77 830 00 04',
    assignedSectors: ['G4'],
    createdAt: '2026-01-10T08:00:00Z',
    lastLoginAt: new Date().toISOString(),
  },
  {
    id: 'usr_faty',
    name: 'Faty (Secteur G5)',
    email: 'faty.g5@poulaillercampement.sn',
    role: 'employee',
    active: true,
    phone: '+221 77 840 00 05',
    assignedSectors: ['G5'],
    createdAt: '2026-01-10T08:00:00Z',
    lastLoginAt: new Date().toISOString(),
  },
  {
    id: 'usr_cherif',
    name: 'Cherif (Secteur G5)',
    email: 'cherif.g5@poulaillercampement.sn',
    role: 'employee',
    active: true,
    phone: '+221 77 850 00 06',
    assignedSectors: ['G5'],
    createdAt: '2026-01-10T08:00:00Z',
    lastLoginAt: new Date().toISOString(),
  },
  {
    id: 'usr_boubacar_keita',
    name: 'Boubacar Keita (Secteur G6)',
    email: 'boubacar.keita.g6@poulaillercampement.sn',
    role: 'employee',
    active: true,
    phone: '+221 77 860 00 07',
    assignedSectors: ['G6'],
    createdAt: '2026-01-10T08:00:00Z',
    lastLoginAt: new Date().toISOString(),
  },
];

const INITIAL_ASSIGNMENTS: UserSectorAssignment[] = [
  // Sector G3: Saliou
  { id: 'asgn_saliou_g3', userId: 'usr_saliou', sector: 'G3', assignedAt: '2026-01-10T08:00:00Z', assignedBy: 'usr_admin', active: true },
  // Sector G4: Moustapha
  { id: 'asgn_moustapha_g4', userId: 'usr_moustapha', sector: 'G4', assignedAt: '2026-01-10T08:00:00Z', assignedBy: 'usr_admin', active: true },
  // Sector G5: Faty et Cherif
  { id: 'asgn_faty_g5', userId: 'usr_faty', sector: 'G5', assignedAt: '2026-01-10T08:00:00Z', assignedBy: 'usr_admin', active: true },
  { id: 'asgn_cherif_g5', userId: 'usr_cherif', sector: 'G5', assignedAt: '2026-01-10T08:00:00Z', assignedBy: 'usr_admin', active: true },
  // Sector G6: Boubacar Keita et Boubacar Sene
  { id: 'asgn_bkeita_g6', userId: 'usr_boubacar_keita', sector: 'G6', assignedAt: '2026-01-10T08:00:00Z', assignedBy: 'usr_admin', active: true },
  { id: 'asgn_bsene_g6', userId: 'usr_admin', sector: 'G6', assignedAt: '2026-01-10T08:00:00Z', assignedBy: 'usr_admin', active: true },
];

function getTodayString(): string {
  const d = new Date();
  return d.toISOString().split('T')[0];
}

function getYesterdayString(): string {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return d.toISOString().split('T')[0];
}

function createInitialDatabase(): DatabaseSchema {
  const cleanClients: Client[] = [
    { id: 'clt_1', name: 'Supermarché Dakar Frais', phone: '+221 77 555 11 22', email: 'achats@dakarfrais.sn', address: 'Almadies, Dakar', balanceDue: 0, createdAt: '2026-01-05T10:00:00Z' },
    { id: 'clt_2', name: 'Boulangerie Les Épis d\'Or', phone: '+221 78 444 33 22', email: 'patisserie.epis@gmail.com', address: 'Plateau, Dakar', balanceDue: 0, createdAt: '2026-01-08T11:00:00Z' },
    { id: 'clt_3', name: 'Grossiste Marché Sandaga (Diallo & Frères)', phone: '+221 76 333 99 88', address: 'Sandaga, Dakar', balanceDue: 0, createdAt: '2026-01-12T09:30:00Z' },
    { id: 'clt_4', name: 'Hôtel Terrou-Bi Restauration', phone: '+221 77 222 00 11', email: 'economat@terroubi.com', address: 'Boulevard Martin Luther King', balanceDue: 0, createdAt: '2026-01-15T14:00:00Z' },
  ];

  const defaultCreds: Record<string, { salt: string; hash: string }> = {};
  for (const u of INITIAL_USERS) {
    const salt = crypto.randomBytes(16).toString('hex');
    defaultCreds[u.id] = { salt, hash: hashPin('2026', salt) };
  }

  return {
    users: INITIAL_USERS.map(u => ({ ...u, hasPin: true })),
    sectorAssignments: INITIAL_ASSIGNMENTS,
    collections: [],
    dailySummaries: {},
    stockMovements: [],
    mortality: [],
    clients: cleanClients,
    sales: [],
    invoices: [],
    emailLogs: [],
    settings: INITIAL_SETTINGS,
    medications: [],
    medicationMovements: [],
    vaccines: [],
    vaccinations: [],
    sanitaryTreatments: [],
    userCredentials: defaultCreds,
    sessions: {},
    processedActions: {},
    auditLogs: [],
  };
}

class Database {
  private data: DatabaseSchema;

  constructor() {
    this.data = this.load();
    this.ensureConfiguredTeamAndSectors();
    this.syncUserAssignedSectors();
    this.recalculateAllDailySummaries();
  }

  private ensureConfiguredTeamAndSectors() {
    if (!this.data.medications) this.data.medications = [];
    if (!this.data.medicationMovements) this.data.medicationMovements = [];
    if (!this.data.vaccines) this.data.vaccines = [];
    if (!this.data.vaccinations) this.data.vaccinations = [];
    if (!this.data.sanitaryTreatments) this.data.sanitaryTreatments = [];
    if (!this.data.userCredentials) this.data.userCredentials = {};
    if (!this.data.sessions) this.data.sessions = {};
    if (!this.data.processedActions) this.data.processedActions = {};
    if (!this.data.auditLogs) this.data.auditLogs = [];

    // Filter out legacy users and assignments
    const legacyUserIds = ['usr_manager', 'usr_emp_g3', 'usr_emp_g4', 'usr_emp_g56'];
    this.data.users = this.data.users.filter(u => !legacyUserIds.includes(u.id));
    this.data.sectorAssignments = this.data.sectorAssignments.filter(a => !legacyUserIds.includes(a.userId));

    // Ensure company name is POULAILLER CAMPEMENT
    if (!this.data.settings) {
      this.data.settings = { ...INITIAL_SETTINGS };
    } else {
      if (this.data.settings.farmName.includes('AVIPO')) {
        this.data.settings.farmName = 'POULAILLER CAMPEMENT — Domaine Avicole';
      }
      if (this.data.settings.smtpFrom?.includes('AVIPO')) {
        this.data.settings.smtpFrom = 'POULAILLER CAMPEMENT <notifications@poulaillercampement.sn>';
      }
    }

    // Update Boubacar Sene name
    const adminUser = this.data.users.find(u => u.id === 'usr_admin');
    if (adminUser) {
      adminUser.name = 'Boubacar Sene (Admin Principal)';
      adminUser.email = 'boubacarsene8@gmail.com';
      adminUser.assignedSectors = [...ALL_SECTORS];
      adminUser.hasPin = true;
    }

    // Merge in configured users if not already present
    for (const initialUser of INITIAL_USERS) {
      const exists = this.data.users.some(u => u.id === initialUser.id || (u.email && u.email.toLowerCase() === initialUser.email.toLowerCase()));
      if (!exists) {
        this.data.users.push({ ...initialUser, hasPin: true });
      } else {
        // If user exists, ensure roles and sectors are up to date
        const target = this.data.users.find(u => u.id === initialUser.id || (u.email && u.email.toLowerCase() === initialUser.email.toLowerCase()));
        if (target && target.id !== 'usr_admin') {
          target.role = initialUser.role;
          target.name = initialUser.name;
          target.active = true;
          target.assignedSectors = [...initialUser.assignedSectors];
          target.hasPin = true;
        }
      }

      // Initialize default PIN (2026) if not already set
      if (!this.data.userCredentials[initialUser.id]) {
        const salt = crypto.randomBytes(16).toString('hex');
        this.data.userCredentials[initialUser.id] = { salt, hash: hashPin('2026', salt) };
      }
    }

    // Merge in sector assignments
    for (const initAsgn of INITIAL_ASSIGNMENTS) {
      const exists = this.data.sectorAssignments.some(a => a.userId === initAsgn.userId && a.sector === initAsgn.sector && a.active);
      if (!exists) {
        this.data.sectorAssignments.push(initAsgn);
      }
    }

    this.saveDirect(this.data);
  }

  private load(): DatabaseSchema {
    const backupDir = path.resolve(DATA_DIR, 'backups');
    const backupFile = path.resolve(backupDir, 'avipo_db_backup.json');

    try {
      if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
      }
      if (!fs.existsSync(backupDir)) {
        fs.mkdirSync(backupDir, { recursive: true });
      }

      if (fs.existsSync(DB_FILE)) {
        const raw = fs.readFileSync(DB_FILE, 'utf-8');
        if (raw.trim().length > 0) {
          const parsed = JSON.parse(raw);
          try {
            fs.writeFileSync(backupFile, raw, 'utf-8');
          } catch {}
          return {
            ...createInitialDatabase(),
            ...parsed,
            settings: { ...INITIAL_SETTINGS, ...(parsed.settings || {}) },
            medications: parsed.medications || [],
            medicationMovements: parsed.medicationMovements || [],
            vaccines: parsed.vaccines || [],
            vaccinations: parsed.vaccinations || [],
            sanitaryTreatments: parsed.sanitaryTreatments || [],
            userCredentials: parsed.userCredentials || {},
            sessions: parsed.sessions || {},
            processedActions: parsed.processedActions || {},
            auditLogs: parsed.auditLogs || [],
            deletedRecords: parsed.deletedRecords || [],
          };
        }
      }

      if (fs.existsSync(backupFile)) {
        const rawBackup = fs.readFileSync(backupFile, 'utf-8');
        if (rawBackup.trim().length > 0) {
          const parsedBackup = JSON.parse(rawBackup);
          fs.writeFileSync(DB_FILE, rawBackup, 'utf-8');
          return {
            ...createInitialDatabase(),
            ...parsedBackup,
            settings: { ...INITIAL_SETTINGS, ...(parsedBackup.settings || {}) },
            medications: parsedBackup.medications || [],
            medicationMovements: parsedBackup.medicationMovements || [],
            vaccines: parsedBackup.vaccines || [],
            vaccinations: parsedBackup.vaccinations || [],
            sanitaryTreatments: parsedBackup.sanitaryTreatments || [],
            userCredentials: parsedBackup.userCredentials || {},
            sessions: parsedBackup.sessions || {},
            processedActions: parsedBackup.processedActions || {},
            auditLogs: parsedBackup.auditLogs || [],
            deletedRecords: parsedBackup.deletedRecords || [],
          };
        }
      }
    } catch (err) {
      console.error('Error loading database file, initializing fresh database:', err);
    }
    const fresh = createInitialDatabase();
    this.saveDirect(fresh);
    return fresh;
  }

  private saveDirect(dataToSave: DatabaseSchema) {
    try {
      const backupDir = path.resolve(DATA_DIR, 'backups');
      if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
      }
      if (!fs.existsSync(backupDir)) {
        fs.mkdirSync(backupDir, { recursive: true });
      }

      const serialized = JSON.stringify(dataToSave, null, 2);
      const tempFile = path.resolve(DATA_DIR, `avipo_db_${Date.now()}.tmp`);
      const backupFile = path.resolve(backupDir, 'avipo_db_backup.json');

      fs.writeFileSync(tempFile, serialized, 'utf-8');
      fs.renameSync(tempFile, DB_FILE);
      try {
        fs.writeFileSync(backupFile, serialized, 'utf-8');
      } catch {}
    } catch (err) {
      console.error('Error saving database to file:', err);
    }
  }

  public save() {
    this.saveDirect(this.data);
  }

  private syncUserAssignedSectors() {
    for (const user of this.data.users) {
      if (user.role === 'admin' || user.role === 'manager' || user.role === 'veterinaire') {
        user.assignedSectors = [...ALL_SECTORS];
      } else {
        const activeAssigned = this.data.sectorAssignments
          .filter(a => a.userId === user.id && a.active)
          .map(a => a.sector);
        user.assignedSectors = Array.from(new Set(activeAssigned));
      }
    }
  }

  // --- Multi-User Authentication & Sessions ---
  public authenticateUser(identifier: string, pin: string): { success: boolean; token?: string; user?: User; allowedSectors?: SectorId[]; error?: string } {
    const cleanId = identifier.trim().toLowerCase();
    const user = this.data.users.find(u => 
      u.id === identifier || 
      (u.email && u.email.toLowerCase() === cleanId) ||
      u.name.toLowerCase() === cleanId ||
      u.name.toLowerCase().startsWith(cleanId)
    );

    if (!user || !user.active) {
      return { success: false, error: 'Compte introuvable ou désactivé.' };
    }

    if (!this.data.userCredentials) this.data.userCredentials = {};
    let creds = this.data.userCredentials[user.id];
    if (!creds) {
      const salt = crypto.randomBytes(16).toString('hex');
      const hash = hashPin('2026', salt);
      creds = { salt, hash };
      this.data.userCredentials[user.id] = creds;
      this.save();
    }

    const testHash = hashPin(String(pin).trim(), creds.salt);
    if (testHash !== creds.hash) {
      return { success: false, error: 'Code PIN incorrect.' };
    }

    const sessionDurationHours = this.data.settings.sessionDurationHours || 24;
    const expiresAt = new Date(Date.now() + sessionDurationHours * 3600 * 1000).toISOString();

    const token = `tok_${crypto.randomBytes(24).toString('hex')}`;
    const session: UserSession = {
      token,
      userId: user.id,
      userName: user.name,
      userRole: user.role,
      createdAt: new Date().toISOString(),
      lastSeenAt: new Date().toISOString(),
      expiresAt,
    };

    if (!this.data.sessions) this.data.sessions = {};
    this.data.sessions[token] = session;
    user.lastLoginAt = new Date().toISOString();
    this.save();

    this.logAudit({
      userId: user.id,
      userName: user.name,
      userRole: user.role,
      action: 'CONNEXION',
      details: `Connexion multi-utilisateurs réussie (${user.role})`,
    });

    return {
      success: true,
      token,
      user,
      allowedSectors: this.getUserAllowedSectors(user.id),
    };
  }

  public getUserBySessionToken(token: string): User | undefined {
    if (!token) return undefined;
    if (!this.data.sessions) return undefined;
    const session = this.data.sessions[token];
    if (!session) return undefined;

    // Check session duration expiration
    if (session.expiresAt && new Date(session.expiresAt).getTime() < Date.now()) {
      delete this.data.sessions[token];
      this.save();
      return undefined;
    }

    session.lastSeenAt = new Date().toISOString();
    return this.getUser(session.userId);
  }

  public destroySession(token: string): boolean {
    if (this.data.sessions && this.data.sessions[token]) {
      delete this.data.sessions[token];
      this.save();
      return true;
    }
    return false;
  }

  // --- Password & Security Management (Admin Boubacar Sene & Gérante Awa Gassama) ---
  public verifyUserPassword(userId: string, passwordAttempt: string): boolean {
    if (!this.data.userCredentials) return false;
    const creds = this.data.userCredentials[userId];
    if (!creds) return false;
    const testHash = hashPin(String(passwordAttempt).trim(), creds.salt);
    return testHash === creds.hash;
  }

  public setUserPassword(
    operatorUserId: string,
    targetUserId: string,
    newPassword: string
  ): { success: boolean; error?: string } {
    const operator = this.getUser(operatorUserId);
    if (!operator || (operator.role !== 'admin' && operator.role !== 'manager')) {
      return {
        success: false,
        error: "Accès interdit : Seuls l'Administrateur principal (Boubacar Sene) et la Gérante (Awa Gassama) sont autorisés à définir ou réinitialiser les mots de passe.",
      };
    }

    const targetUser = this.getUser(targetUserId);
    if (!targetUser) {
      return { success: false, error: 'Utilisateur cible introuvable.' };
    }

    const cleanPass = String(newPassword).trim();
    if (cleanPass.length < 4) {
      return { success: false, error: 'Le mot de passe doit comporter au moins 4 caractères.' };
    }

    const newSalt = crypto.randomBytes(16).toString('hex');
    const newHash = hashPin(cleanPass, newSalt);

    if (!this.data.userCredentials) this.data.userCredentials = {};
    this.data.userCredentials[targetUserId] = { salt: newSalt, hash: newHash };
    targetUser.hasPin = true;
    this.save();

    // NEVER log plain password in audit trails!
    this.logAudit({
      userId: operator.id,
      userName: operator.name,
      userRole: operator.role,
      action: 'MODIFICATION_MOT_DE_PASSE',
      details: `Définition / réinitialisation du mot de passe pour le compte ${targetUser.name} (${targetUser.role}) par ${operator.name} (${operator.role})`,
    });

    return { success: true };
  }

  public changePin(userId: string, oldPin: string, newPin: string): { success: boolean; error?: string } {
    // Employees and vet cannot modify passwords autonomously
    const user = this.getUser(userId);
    if (!user || (user.role !== 'admin' && user.role !== 'manager')) {
      return {
        success: false,
        error: "Accès interdit : Les employés et le vétérinaire ne peuvent pas modifier leur mot de passe. Veuillez vous adresser à l'Administrateur principal ou à la Gérante.",
      };
    }
    return this.setUserPassword(userId, userId, newPin);
  }

  public resetPin(operatorUserId: string, targetUserId: string, newPin: string): { success: boolean; error?: string } {
    return this.setUserPassword(operatorUserId, targetUserId, newPin);
  }

  // --- Security Policy Settings ---
  public updateSecuritySettings(
    settings: Partial<FarmSettings>,
    adminUserId: string
  ): FarmSettings {
    const admin = this.getUser(adminUserId);
    if (!admin || admin.role !== 'admin') {
      throw new Error("Accès interdit : Seul l'Administrateur principal (Boubacar Sene) est habilité à modifier la politique de sécurité.");
    }

    if (settings.sessionDurationHours !== undefined) {
      this.data.settings.sessionDurationHours = Math.max(1, Number(settings.sessionDurationHours) || 24);
    }
    if (settings.requireReauthForSensitiveOps !== undefined) {
      this.data.settings.requireReauthForSensitiveOps = Boolean(settings.requireReauthForSensitiveOps);
    }
    if (settings.requirePasswordOnAppOpen !== undefined) {
      this.data.settings.requirePasswordOnAppOpen = Boolean(settings.requirePasswordOnAppOpen);
    }
    this.save();

    this.logAudit({
      userId: admin.id,
      userName: admin.name,
      userRole: admin.role,
      action: 'CONFIGURATION_SECURITE',
      details: `Mise à jour politique de sécurité : validité session = ${this.data.settings.sessionDurationHours}h, réauth sensible = ${this.data.settings.requireReauthForSensitiveOps}, réauth réouverture = ${this.data.settings.requirePasswordOnAppOpen}`,
    });

    return this.data.settings;
  }

  // --- Deletion & Archiving (Strictly Boubacar Sene / role admin only) ---
  private checkAdminPermission(adminUserId: string, actionLabel: string): User {
    const user = this.getUser(adminUserId);
    if (!user || user.role !== 'admin') {
      throw new Error(`Accès strictement interdit : Seul l'Administrateur principal (Boubacar Sene) est habilité à ${actionLabel}.`);
    }
    return user;
  }

  private archiveDeletedRecord(
    entityType: 'collection' | 'stock' | 'sale' | 'invoice' | 'mortality' | 'treatment' | 'vaccination' | 'user',
    entityId: string,
    data: any,
    admin: User,
    reason: string
  ) {
    if (!this.data.deletedRecords) this.data.deletedRecords = [];
    this.data.deletedRecords.push({
      id: `del_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      entityType,
      entityId,
      data,
      deletedAt: new Date().toISOString(),
      deletedBy: admin.id,
      deletedByName: admin.name,
      reason: reason || 'Erreur de saisie / Correction administrative',
    });
  }

  public deleteCollection(idOrKey: string, adminUserId: string, reason: string): { success: boolean; deleted: CollectionRecord } {
    const admin = this.checkAdminPermission(adminUserId, 'supprimer un ramassage');
    const idx = this.data.collections.findIndex(c => c.id === idOrKey || `${c.date}_${c.sector}_${c.slot}` === idOrKey);
    if (idx < 0) throw new Error('Enregistrement de ramassage introuvable.');

    const deleted = this.data.collections.splice(idx, 1)[0];
    this.archiveDeletedRecord('collection', deleted.id, deleted, admin, reason);
    this.recalculateDailySummary(deleted.date);
    this.save();

    this.logAudit({
      userId: admin.id,
      userName: admin.name,
      userRole: admin.role,
      action: 'SUPPRESSION_RAMASSAGE',
      sector: deleted.sector,
      details: `Suppression du ramassage ${deleted.sector} - ${deleted.slot} du ${deleted.date} (${deleted.trays} plateaux). Motif : ${reason}`,
      entityId: deleted.id,
    });

    syncHub.broadcast({
      id: `evt_del_${Date.now()}`,
      type: 'collection',
      action: 'delete',
      entityId: deleted.id,
      userId: admin.id,
      userName: admin.name,
      timestamp: new Date().toISOString(),
      data: { date: deleted.date, sector: deleted.sector, slot: deleted.slot },
    });

    return { success: true, deleted };
  }

  public deleteStockMovement(id: string, adminUserId: string, reason: string): { success: boolean; deleted: StockMovement } {
    const admin = this.checkAdminPermission(adminUserId, 'supprimer une ligne de stock');
    const idx = this.data.stockMovements.findIndex(s => s.id === id);
    if (idx < 0) throw new Error('Mouvement de stock introuvable.');

    const deleted = this.data.stockMovements.splice(idx, 1)[0];
    this.archiveDeletedRecord('stock', deleted.id, deleted, admin, reason);
    this.save();

    this.logAudit({
      userId: admin.id,
      userName: admin.name,
      userRole: admin.role,
      action: 'SUPPRESSION_STOCK',
      sector: deleted.sector,
      details: `Suppression ligne de stock ${deleted.movementType} (${deleted.quantity} ${deleted.itemType}, secteur ${deleted.sector}). Motif : ${reason}`,
      entityId: deleted.id,
    });

    syncHub.broadcast({
      id: `evt_del_${Date.now()}`,
      type: 'stock',
      action: 'delete',
      entityId: deleted.id,
      userId: admin.id,
      userName: admin.name,
      timestamp: new Date().toISOString(),
      data: { id: deleted.id },
    });

    return { success: true, deleted };
  }

  public deleteSale(id: string, adminUserId: string, reason: string): { success: boolean; deleted: SaleRecord } {
    const admin = this.checkAdminPermission(adminUserId, 'supprimer une vente');
    const idx = this.data.sales.findIndex(s => s.id === id);
    if (idx < 0) throw new Error('Vente introuvable.');

    const deleted = this.data.sales.splice(idx, 1)[0];
    this.archiveDeletedRecord('sale', deleted.id, deleted, admin, reason);
    this.save();

    this.logAudit({
      userId: admin.id,
      userName: admin.name,
      userRole: admin.role,
      action: 'SUPPRESSION_VENTE',
      sector: deleted.sector,
      details: `Suppression vente client ${deleted.clientName} (${deleted.totalAmount} FCFA, secteur ${deleted.sector}). Motif : ${reason}`,
      entityId: deleted.id,
    });

    syncHub.broadcast({
      id: `evt_del_${Date.now()}`,
      type: 'sale',
      action: 'delete',
      entityId: deleted.id,
      userId: admin.id,
      userName: admin.name,
      timestamp: new Date().toISOString(),
      data: { id: deleted.id },
    });

    return { success: true, deleted };
  }

  public deleteInvoice(id: string, adminUserId: string, reason: string, permanent: boolean = false): { success: boolean; invoice: Invoice } {
    const admin = this.checkAdminPermission(adminUserId, 'supprimer ou annuler une facture');
    const idx = this.data.invoices.findIndex(i => i.id === id);
    if (idx < 0) throw new Error('Facture introuvable.');

    const inv = this.data.invoices[idx];

    if (!permanent) {
      // Annulation traçable privilégiée pour préserver l'historique financier
      inv.status = 'annulee';
      inv.notes = `${inv.notes ? inv.notes + ' | ' : ''}Annulée le ${new Date().toLocaleDateString('fr-FR')} par ${admin.name}. Motif: ${reason}`;
      inv.balanceDue = 0;
      this.save();

      this.logAudit({
        userId: admin.id,
        userName: admin.name,
        userRole: admin.role,
        action: 'ANNULATION_FACTURE',
        details: `Annulation traçable de la facture ${inv.number} (${inv.clientName}, montant: ${inv.total} FCFA). Motif : ${reason}`,
        entityId: inv.id,
      });

      syncHub.broadcast({
        id: `evt_inv_${Date.now()}`,
        type: 'invoice',
        action: 'update',
        entityId: inv.id,
        userId: admin.id,
        userName: admin.name,
        timestamp: new Date().toISOString(),
        data: { id: inv.id, status: 'annulee' },
      });

      return { success: true, invoice: inv };
    } else {
      // Suppression définitive avec archivage de sécurité
      const deleted = this.data.invoices.splice(idx, 1)[0];
      this.archiveDeletedRecord('invoice', deleted.id, deleted, admin, reason);
      this.save();

      this.logAudit({
        userId: admin.id,
        userName: admin.name,
        userRole: admin.role,
        action: 'SUPPRESSION_FACTURE',
        details: `Suppression définitive de la facture ${deleted.number} (${deleted.clientName}). Motif : ${reason}`,
        entityId: deleted.id,
      });

      syncHub.broadcast({
        id: `evt_inv_del_${Date.now()}`,
        type: 'invoice',
        action: 'delete',
        entityId: deleted.id,
        userId: admin.id,
        userName: admin.name,
        timestamp: new Date().toISOString(),
        data: { id: deleted.id },
      });

      return { success: true, invoice: deleted };
    }
  }

  public deleteMortalityRecord(id: string, adminUserId: string, reason: string): { success: boolean; deleted: MortalityRecord } {
    const admin = this.checkAdminPermission(adminUserId, 'supprimer un enregistrement de mortalité');
    const idx = this.data.mortality.findIndex(m => m.id === id);
    if (idx < 0) throw new Error('Enregistrement de mortalité introuvable.');

    const deleted = this.data.mortality.splice(idx, 1)[0];
    this.archiveDeletedRecord('mortality', deleted.id, deleted, admin, reason);
    this.save();

    this.logAudit({
      userId: admin.id,
      userName: admin.name,
      userRole: admin.role,
      action: 'SUPPRESSION_MORTALITE',
      sector: deleted.sector,
      details: `Suppression enregistrement mortalité ${deleted.count} sujets (${deleted.sector}, ${deleted.cause}). Motif : ${reason}`,
      entityId: deleted.id,
    });

    syncHub.broadcast({
      id: `evt_del_${Date.now()}`,
      type: 'mortality',
      action: 'delete',
      entityId: deleted.id,
      userId: admin.id,
      userName: admin.name,
      timestamp: new Date().toISOString(),
      data: { id: deleted.id },
    });

    return { success: true, deleted };
  }

  public deleteSanitaryTreatment(id: string, adminUserId: string, reason: string): { success: boolean } {
    const admin = this.checkAdminPermission(adminUserId, 'supprimer un traitement sanitaire');
    const idx = this.data.sanitaryTreatments.findIndex(t => t.id === id);
    if (idx < 0) throw new Error('Traitement sanitaire introuvable.');

    const deleted = this.data.sanitaryTreatments.splice(idx, 1)[0];
    this.archiveDeletedRecord('treatment', deleted.id, deleted, admin, reason);
    this.save();

    this.logAudit({
      userId: admin.id,
      userName: admin.name,
      userRole: admin.role,
      action: 'SUPPRESSION_TRAITEMENT',
      sector: deleted.sector,
      details: `Suppression traitement ${deleted.productName} (${deleted.sector}). Motif : ${reason}`,
      entityId: deleted.id,
    });

    return { success: true };
  }

  public deleteVaccination(id: string, adminUserId: string, reason: string): { success: boolean } {
    const admin = this.checkAdminPermission(adminUserId, 'supprimer une vaccination');
    const idx = this.data.vaccinations.findIndex(v => v.id === id);
    if (idx < 0) throw new Error('Campagne de vaccination introuvable.');

    const deleted = this.data.vaccinations.splice(idx, 1)[0];
    this.archiveDeletedRecord('vaccination', deleted.id, deleted, admin, reason);
    this.save();

    this.logAudit({
      userId: admin.id,
      userName: admin.name,
      userRole: admin.role,
      action: 'SUPPRESSION_VACCINATION',
      sector: deleted.sector,
      details: `Suppression vaccination ${deleted.vaccineName} (${deleted.sector}). Motif : ${reason}`,
      entityId: deleted.id,
    });

    return { success: true };
  }

  public deleteUser(targetUserId: string, adminUserId: string, reason: string): { success: boolean; user: User } {
    const admin = this.checkAdminPermission(adminUserId, 'supprimer un compte utilisateur');
    if (targetUserId === 'usr_admin') {
      throw new Error("Impossible de supprimer le compte de l'Administrateur principal.");
    }
    const idx = this.data.users.findIndex(u => u.id === targetUserId);
    if (idx < 0) throw new Error('Utilisateur introuvable.');

    const deleted = this.data.users.splice(idx, 1)[0];
    // Remove credentials & sessions
    if (this.data.userCredentials) delete this.data.userCredentials[targetUserId];
    if (this.data.sessions) {
      for (const [tok, sess] of Object.entries(this.data.sessions)) {
        if (sess.userId === targetUserId) delete this.data.sessions[tok];
      }
    }
    this.archiveDeletedRecord('user', deleted.id, deleted, admin, reason);
    this.save();

    this.logAudit({
      userId: admin.id,
      userName: admin.name,
      userRole: admin.role,
      action: 'SUPPRESSION_UTILISATEUR',
      details: `Suppression définitive du compte utilisateur ${deleted.name} (${deleted.role}). Motif : ${reason}`,
      entityId: deleted.id,
    });

    return { success: true, user: deleted };
  }

  public getDeletedRecords(adminUserId: string): any[] {
    this.checkAdminPermission(adminUserId, 'consulter les archives des suppressions');
    return this.data.deletedRecords || [];
  }

  public restoreDeletedRecord(archiveId: string, adminUserId: string): { success: boolean; entityType: string; restored: any } {
    const admin = this.checkAdminPermission(adminUserId, 'restaurer un enregistrement archivé');
    if (!this.data.deletedRecords) throw new Error('Aucun enregistrement archivé.');
    const idx = this.data.deletedRecords.findIndex(r => r.id === archiveId);
    if (idx < 0) throw new Error('Archive introuvable.');

    const record = this.data.deletedRecords.splice(idx, 1)[0];
    const data = record.data;

    switch (record.entityType) {
      case 'collection':
        this.data.collections.push(data);
        this.recalculateDailySummary(data.date);
        break;
      case 'stock':
        this.data.stockMovements.push(data);
        break;
      case 'sale':
        this.data.sales.push(data);
        break;
      case 'invoice':
        this.data.invoices.push(data);
        break;
      case 'mortality':
        this.data.mortality.push(data);
        break;
      case 'treatment':
        this.data.sanitaryTreatments.push(data);
        break;
      case 'vaccination':
        this.data.vaccinations.push(data);
        break;
      case 'user':
        this.data.users.push(data);
        if (!this.data.userCredentials) this.data.userCredentials = {};
        if (!this.data.userCredentials[data.id]) {
          const salt = crypto.randomBytes(16).toString('hex');
          this.data.userCredentials[data.id] = { salt, hash: hashPin('2026', salt) };
        }
        break;
      default:
        throw new Error(`Type d'entité non pris en charge pour la restauration: ${record.entityType}`);
    }

    this.save();

    this.logAudit({
      userId: admin.id,
      userName: admin.name,
      userRole: admin.role,
      action: 'RESTAURATION_DONNEE',
      details: `Restauration de l'élément archivé ${record.entityType} (${record.entityId}) initialement supprimé par ${record.deletedByName}.`,
      entityId: record.entityId,
    });

    syncHub.broadcast({
      id: `evt_rst_${Date.now()}`,
      type: (record.entityType === 'treatment' || record.entityType === 'vaccination' ? 'system' : record.entityType) as any,
      action: 'create',
      entityId: record.entityId,
      userId: admin.id,
      userName: admin.name,
      timestamp: new Date().toISOString(),
      data,
    });

    return { success: true, entityType: record.entityType, restored: data };
  }

  // --- Deduplication & Idempotency ---
  public isActionProcessed(actionId: string): boolean {
    if (!actionId) return false;
    return Boolean(this.data.processedActions && this.data.processedActions[actionId]);
  }

  public recordProcessedAction(actionId: string, entityId: string) {
    if (!actionId) return;
    if (!this.data.processedActions) this.data.processedActions = {};
    this.data.processedActions[actionId] = {
      processedAt: new Date().toISOString(),
      entityId,
    };
    const keys = Object.keys(this.data.processedActions);
    if (keys.length > 2000) {
      for (const k of keys.slice(0, 500)) delete this.data.processedActions[k];
    }
  }

  // --- Audit Logging ---
  public logAudit(entry: Omit<AuditLogEntry, 'id' | 'timestamp'>) {
    if (!this.data.auditLogs) this.data.auditLogs = [];
    const logItem: AuditLogEntry = {
      ...entry,
      id: `adt_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      timestamp: new Date().toISOString(),
    };
    this.data.auditLogs.unshift(logItem);
    if (this.data.auditLogs.length > 1000) {
      this.data.auditLogs = this.data.auditLogs.slice(0, 1000);
    }
  }

  public getAuditLogs(): AuditLogEntry[] {
    return this.data.auditLogs || [];
  }

  // --- Users & RBAC ---
  public getUsers(): User[] {
    this.syncUserAssignedSectors();
    return this.data.users;
  }

  public getUser(userId: string): User | undefined {
    this.syncUserAssignedSectors();
    return this.data.users.find(u => u.id === userId);
  }

  public getUserAllowedSectors(userId: string): SectorId[] {
    const user = this.getUser(userId);
    if (!user) return [];
    if (user.role === 'admin' || user.role === 'manager' || user.role === 'veterinaire') {
      return [...ALL_SECTORS];
    }
    return user.assignedSectors || [];
  }

  public canAccessSector(userId: string, sector: SectorId): boolean {
    const allowed = this.getUserAllowedSectors(userId);
    return allowed.includes(sector);
  }

  public createUser(userData: { name: string; email: string; role: UserRole; phone?: string; sectors?: SectorId[] }, createdBy: string): User {
    const newUser: User = {
      id: `usr_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      name: userData.name,
      email: userData.email,
      role: userData.role,
      active: true,
      phone: userData.phone || '',
      assignedSectors: userData.sectors || (userData.role === 'employee' ? [] : [...ALL_SECTORS]),
      createdAt: new Date().toISOString(),
    };
    this.data.users.push(newUser);

    if (userData.role === 'employee' && userData.sectors) {
      for (const sec of userData.sectors) {
        this.data.sectorAssignments.push({
          id: `asgn_${Date.now()}_${sec}`,
          userId: newUser.id,
          sector: sec,
          assignedAt: new Date().toISOString(),
          assignedBy: createdBy,
          active: true,
        });
      }
    }

    this.syncUserAssignedSectors();
    this.save();
    return newUser;
  }

  public updateUser(userId: string, updates: Partial<User>, assignedSectors?: SectorId[], updatedBy?: string): User {
    const user = this.data.users.find(u => u.id === userId);
    if (!user) throw new Error('Utilisateur introuvable');

    if (updates.name !== undefined) user.name = updates.name;
    if (updates.email !== undefined) user.email = updates.email;
    if (updates.role !== undefined) user.role = updates.role;
    if (updates.phone !== undefined) user.phone = updates.phone;
    if (updates.active !== undefined) user.active = updates.active;

    if (assignedSectors !== undefined) {
      // deactivate existing assignments
      for (const asgn of this.data.sectorAssignments) {
        if (asgn.userId === userId) {
          asgn.active = false;
        }
      }
      // add or reactivate
      for (const sec of assignedSectors) {
        const existing = this.data.sectorAssignments.find(a => a.userId === userId && a.sector === sec);
        if (existing) {
          existing.active = true;
          existing.assignedAt = new Date().toISOString();
        } else {
          this.data.sectorAssignments.push({
            id: `asgn_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
            userId,
            sector: sec,
            assignedAt: new Date().toISOString(),
            assignedBy: updatedBy || 'admin',
            active: true,
          });
        }
      }
    }

    this.syncUserAssignedSectors();
    this.save();
    return user;
  }

  public getSectorAssignments(): UserSectorAssignment[] {
    return this.data.sectorAssignments;
  }

  // --- Collections (Ramassage) ---
  public getCollections(date?: string, sector?: SectorId): CollectionRecord[] {
    let list = this.data.collections;
    if (date) {
      list = list.filter(c => c.date === date);
    }
    if (sector) {
      list = list.filter(c => c.sector === sector);
    }
    return list;
  }

  public upsertCollection(
    record: { 
      date: string; 
      slot: SlotTime; 
      sector: SectorId; 
      trays?: number;
      brokenEggs?: number;
      doubleYolkEggs?: number;
      depositTrays?: number;
      quantity?: number; 
      cracked?: number; 
      deposit?: number;
    },
    userId: string,
    options?: {
      lastKnownUpdatedAt?: string;
      force?: boolean;
    }
  ): { collection: CollectionRecord; dailySummary: DailySummary } {
    const user = this.getUser(userId);
    if (!user) throw new Error('Utilisateur non authentifié');

    // Server-side sector permission check
    if (!this.canAccessSector(userId, record.sector)) {
      throw new Error(`Accès refusé : vous n'avez pas l'autorisation pour le secteur ${record.sector}`);
    }

    const existingIdx = this.data.collections.findIndex(
      c => c.date === record.date && c.slot === record.slot && c.sector === record.sector
    );

    // Concurrency & optimistic locking check
    if (existingIdx >= 0 && options?.lastKnownUpdatedAt && !options?.force) {
      const existing = this.data.collections[existingIdx];
      if (existing.updatedAt && existing.updatedAt !== options.lastKnownUpdatedAt) {
        if (existing.recordedBy !== userId) {
          const conflictErr: any = new Error(
            `Conflit de modification simultanée : cette fiche (${record.sector} - ${record.slot}) a été enregistrée par ${existing.recordedByName || 'un autre collaborateur'} (${existing.updatedAt}). Rechargez les données pour ne pas écraser son travail.`
          );
          conflictErr.code = 'CONFLICT';
          conflictErr.currentRecord = existing;
          throw conflictErr;
        }
      }
    }

    const trays = Math.max(0, Number(record.trays !== undefined ? record.trays : record.quantity) || 0);
    const brokenEggs = Math.max(0, Number(record.brokenEggs !== undefined ? record.brokenEggs : record.cracked) || 0);
    const doubleYolkEggs = Math.max(0, Number(record.doubleYolkEggs) || 0);
    const depositTrays = Math.max(0, Number(record.depositTrays !== undefined ? record.depositTrays : (record.deposit !== undefined ? record.deposit : trays)) || 0);

    const updatedRecord: CollectionRecord = {
      id: existingIdx >= 0 ? this.data.collections[existingIdx].id : `col_${Date.now()}_${record.sector}_${record.slot}`,
      date: record.date,
      slot: record.slot,
      sector: record.sector,
      trays,
      brokenEggs,
      doubleYolkEggs,
      depositTrays,
      quantity: trays,
      cracked: brokenEggs,
      deposit: depositTrays,
      recordedBy: userId,
      recordedByName: user.name,
      updatedAt: new Date().toISOString(),
    };

    if (existingIdx >= 0) {
      this.data.collections[existingIdx] = updatedRecord;
    } else {
      this.data.collections.push(updatedRecord);
    }

    // Also record stock movement for the deposit (in plateaux)
    const movementId = `sm_ram_${record.date}_${record.sector}_${record.slot}`;
    const existSmIdx = this.data.stockMovements.findIndex(sm => sm.id === movementId);
    const stockMov: StockMovement = {
      id: movementId,
      date: record.date,
      sector: record.sector,
      itemType: 'OEFS_STANDARDS',
      quantity: updatedRecord.depositTrays,
      movementType: 'DEPOT_RAMASSAGE',
      reason: `Ramassage ${record.slot} secteur ${record.sector} (${updatedRecord.depositTrays} plateaux)`,
      performedBy: userId,
      performedByName: user.name,
      timestamp: new Date().toISOString(),
    };
    if (existSmIdx >= 0) {
      this.data.stockMovements[existSmIdx] = stockMov;
    } else {
      this.data.stockMovements.push(stockMov);
    }

    const summary = this.recalculateDailySummary(record.date);
    this.save();

    this.logAudit({
      userId,
      userName: user.name,
      userRole: user.role,
      action: 'RAMASSAGE',
      sector: record.sector,
      details: `Ramassage ${record.slot} secteur ${record.sector} : ${updatedRecord.trays} plateaux (${updatedRecord.brokenEggs} cassés, ${updatedRecord.doubleYolkEggs} doubles)`,
      entityId: `${record.date}_${record.sector}_${record.slot}`,
    });

    syncHub.broadcast({
      id: `evt_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      type: 'collection',
      action: 'update',
      entityId: `${record.date}_${record.sector}_${record.slot}`,
      userId,
      userName: user.name,
      timestamp: new Date().toISOString(),
      data: { date: record.date, sector: record.sector, slot: record.slot, trays: updatedRecord.trays },
    });

    return { collection: updatedRecord, dailySummary: summary };
  }

  // Calculate day completeness
  // The day is complete only when all 3 slots (10H, 13H, 16H) are filled for all 4 sectors G3, G4, G5, G6
  public recalculateDailySummary(date: string): DailySummary {
    const dayCollections = this.data.collections.filter(c => c.date === date);

    const bySector: Record<SectorId, { 
      trays: number; 
      brokenEggs: number; 
      doubleYolkEggs: number; 
      depositTrays: number;
      total: number; 
      cracked: number; 
      deposit: number;
    }> = {
      G3: { trays: 0, brokenEggs: 0, doubleYolkEggs: 0, depositTrays: 0, total: 0, cracked: 0, deposit: 0 },
      G4: { trays: 0, brokenEggs: 0, doubleYolkEggs: 0, depositTrays: 0, total: 0, cracked: 0, deposit: 0 },
      G5: { trays: 0, brokenEggs: 0, doubleYolkEggs: 0, depositTrays: 0, total: 0, cracked: 0, deposit: 0 },
      G6: { trays: 0, brokenEggs: 0, doubleYolkEggs: 0, depositTrays: 0, total: 0, cracked: 0, deposit: 0 },
    };

    const bySlot: Record<SlotTime, number> = {
      '10H': 0,
      '13H': 0,
      '16H': 0,
    };

    const bySlotDetailed: Record<SlotTime, { trays: number; brokenEggs: number; doubleYolkEggs: number }> = {
      '10H': { trays: 0, brokenEggs: 0, doubleYolkEggs: 0 },
      '13H': { trays: 0, brokenEggs: 0, doubleYolkEggs: 0 },
      '16H': { trays: 0, brokenEggs: 0, doubleYolkEggs: 0 },
    };

    let totalTrays = 0;
    let totalBrokenEggs = 0;
    let totalDoubleYolkEggs = 0;
    let totalDepositedTrays = 0;

    for (const c of dayCollections) {
      const cTrays = c.trays !== undefined ? c.trays : (c.quantity || 0);
      const cBroken = c.brokenEggs !== undefined ? c.brokenEggs : (c.cracked || 0);
      const cDouble = c.doubleYolkEggs !== undefined ? c.doubleYolkEggs : 0;
      const cDepositTrays = c.depositTrays !== undefined ? c.depositTrays : (c.deposit !== undefined ? c.deposit : cTrays);

      if (bySector[c.sector]) {
        bySector[c.sector].trays += cTrays;
        bySector[c.sector].brokenEggs += cBroken;
        bySector[c.sector].doubleYolkEggs += cDouble;
        bySector[c.sector].depositTrays += cDepositTrays;
        bySector[c.sector].total += cTrays;
        bySector[c.sector].cracked += cBroken;
        bySector[c.sector].deposit += cDepositTrays;
      }
      if (bySlot[c.slot] !== undefined) {
        bySlot[c.slot] += cTrays;
        bySlotDetailed[c.slot].trays += cTrays;
        bySlotDetailed[c.slot].brokenEggs += cBroken;
        bySlotDetailed[c.slot].doubleYolkEggs += cDouble;
      }
      totalTrays += cTrays;
      totalBrokenEggs += cBroken;
      totalDoubleYolkEggs += cDouble;
      totalDepositedTrays += cDepositTrays;
    }

    // Verification: all 3 slots must be present for all 4 sectors G3, G4, G5, G6
    let complete = true;
    for (const sec of ALL_SECTORS) {
      for (const slot of SLOTS) {
        const hasSlot = dayCollections.some(c => c.sector === sec && c.slot === slot && ((c.trays !== undefined ? c.trays : c.quantity) > 0));
        if (!hasSlot) {
          complete = false;
          break;
        }
      }
      if (!complete) break;
    }

    const existingSummary = this.data.dailySummaries[date];

    const newSummary: DailySummary = {
      date,
      isComplete: complete,
      completedAt: complete ? (existingSummary?.completedAt || new Date().toISOString()) : null,
      totalTrays,
      totalBrokenEggs,
      totalDoubleYolkEggs,
      totalDepositedTrays,
      totalEggs: totalTrays,
      totalCracked: totalBrokenEggs,
      totalDeposited: totalDepositedTrays,
      bySector,
      bySlot,
      bySlotDetailed,
      emailSent: existingSummary?.emailSent || false,
      emailSentAt: existingSummary?.emailSentAt || null,
      emailRecipient: existingSummary?.emailRecipient || this.data.settings.managerEmail,
      emailMessageId: existingSummary?.emailMessageId,
      emailStatus: existingSummary?.emailStatus || 'pending',
      emailError: existingSummary?.emailError,
    };

    this.data.dailySummaries[date] = newSummary;
    return newSummary;
  }

  public recalculateAllDailySummaries() {
    const dates = Array.from(new Set(this.data.collections.map(c => c.date)));
    for (const d of dates) {
      this.recalculateDailySummary(d);
    }
  }

  public getDailySummary(date: string): DailySummary {
    if (!this.data.dailySummaries[date]) {
      return this.recalculateDailySummary(date);
    }
    return this.data.dailySummaries[date];
  }

  public updateDailySummaryEmailStatus(
    date: string,
    status: { emailSent: boolean; emailSentAt: string | null; emailMessageId?: string; emailStatus: 'pending' | 'sent' | 'non_configure' | 'error'; emailError?: string }
  ) {
    const s = this.getDailySummary(date);
    s.emailSent = status.emailSent;
    s.emailSentAt = status.emailSentAt;
    s.emailMessageId = status.emailMessageId;
    s.emailStatus = status.emailStatus;
    s.emailError = status.emailError;
    this.data.dailySummaries[date] = s;
    this.save();
  }

  // --- Stocks ---
  public getStockMovements(sector?: SectorId | 'CENTRAL'): StockMovement[] {
    let list = this.data.stockMovements;
    if (sector) {
      list = list.filter(m => m.sector === sector);
    }
    return [...list].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }

  public getStockBalances(): Record<SectorId | 'CENTRAL', { oefsStandards: number; oefsFeles: number; plateauxVides: number; alimentKg: number }> {
    const sectors: (SectorId | 'CENTRAL')[] = [...ALL_SECTORS, 'CENTRAL'];
    const balances: any = {};

    for (const sec of sectors) {
      balances[sec] = {
        oefsStandards: 0,
        oefsFeles: 0,
        plateauxVides: 0,
        alimentKg: 0,
      };
    }

    // Add up collection deposits & subtractions from movements
    for (const m of this.data.stockMovements) {
      const sec = m.sector;
      if (!balances[sec]) continue;

      const isPositive = m.movementType === 'ENTREE' || m.movementType === 'DEPOT_RAMASSAGE';
      const factor = isPositive ? 1 : -1;

      if (m.itemType === 'OEFS_STANDARDS') {
        balances[sec].oefsStandards += factor * m.quantity;
      } else if (m.itemType === 'OEFS_FELES') {
        balances[sec].oefsFeles += factor * m.quantity;
      } else if (m.itemType === 'PLATEAUX_VIDES') {
        balances[sec].plateauxVides += factor * m.quantity;
      } else if (m.itemType === 'ALIMENT') {
        balances[sec].alimentKg += factor * m.quantity;
      }
    }

    return balances;
  }

  public addStockMovement(movement: Omit<StockMovement, 'id' | 'timestamp' | 'performedBy' | 'date'> & { performedBy?: string; date?: string }, userId: string): StockMovement {
    const user = this.getUser(userId);
    if (!user) throw new Error('Utilisateur non authentifié');

    if (movement.sector !== 'CENTRAL' && !this.canAccessSector(userId, movement.sector as SectorId)) {
      throw new Error(`Accès refusé pour le secteur ${movement.sector}`);
    }

    const newMov: StockMovement = {
      ...movement,
      date: movement.date || new Date().toISOString().split('T')[0],
      id: `sm_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      performedBy: userId,
      performedByName: user.name,
      timestamp: new Date().toISOString(),
    };

    this.data.stockMovements.push(newMov);
    this.save();

    this.logAudit({
      userId,
      userName: user.name,
      userRole: user.role,
      action: 'MOUVEMENT_STOCK',
      sector: newMov.sector,
      details: `${newMov.movementType} : ${newMov.quantity} ${newMov.itemType} (${newMov.reason})`,
      entityId: newMov.id,
    });

    syncHub.broadcast({
      id: `evt_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      type: 'stock',
      action: 'create',
      entityId: newMov.id,
      userId,
      userName: user.name,
      timestamp: new Date().toISOString(),
      data: newMov,
    });

    return newMov;
  }

  // --- Mortality ---
  public getMortalityRecords(sector?: SectorId): MortalityRecord[] {
    let list = this.data.mortality;
    if (sector) {
      list = list.filter(m => m.sector === sector);
    }
    return [...list].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }

  public addMortalityRecord(record: Omit<MortalityRecord, 'id' | 'timestamp' | 'recordedBy'> & { recordedBy?: string }, userId: string): MortalityRecord {
    const user = this.getUser(userId);
    if (!user) throw new Error('Utilisateur non authentifié');

    if (!this.canAccessSector(userId, record.sector)) {
      throw new Error(`Accès refusé pour le secteur ${record.sector}`);
    }

    const newMor: MortalityRecord = {
      ...record,
      id: `mor_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      recordedBy: userId,
      recordedByName: user.name,
      timestamp: new Date().toISOString(),
    };

    this.data.mortality.push(newMor);
    this.save();

    this.logAudit({
      userId,
      userName: user.name,
      userRole: user.role,
      action: 'MORTALITE',
      sector: record.sector,
      details: `Mortalité : ${record.count} sujets perdus (Secteur ${record.sector}, Cause: ${record.cause})`,
      entityId: newMor.id,
    });

    syncHub.broadcast({
      id: `evt_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      type: 'mortality',
      action: 'create',
      entityId: newMor.id,
      userId,
      userName: user.name,
      timestamp: new Date().toISOString(),
      data: newMor,
    });

    return newMor;
  }

  // --- Clients ---
  public getClients(): Client[] {
    return this.data.clients;
  }

  public addClient(client: Omit<Client, 'id' | 'createdAt'>): Client {
    const newClient: Client = {
      ...client,
      id: `clt_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      balanceDue: Number(client.balanceDue) || 0,
      createdAt: new Date().toISOString(),
    };
    this.data.clients.push(newClient);
    this.save();
    return newClient;
  }

  // --- Sales ---
  public getSales(sector?: SectorId | 'CENTRAL'): SaleRecord[] {
    let list = this.data.sales;
    if (sector) {
      list = list.filter(s => s.sector === sector);
    }
    return [...list].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  public addSale(sale: Omit<SaleRecord, 'id' | 'createdAt'>, userId: string): SaleRecord {
    const user = this.getUser(userId);
    if (!user) throw new Error('Utilisateur non authentifié');

    if (sale.sector !== 'CENTRAL' && !this.canAccessSector(userId, sale.sector as SectorId)) {
      throw new Error(`Accès refusé pour le secteur ${sale.sector}`);
    }

    const newSale: SaleRecord = {
      ...sale,
      id: `sale_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      recordedBy: userId,
      recordedByName: user.name,
      createdAt: new Date().toISOString(),
    };
    this.data.sales.push(newSale);

    const trayQty = Number(newSale.quantity) || 0;
    // deduct from stock
    this.data.stockMovements.push({
      id: `sm_sale_${newSale.id}`,
      date: newSale.date,
      sector: newSale.sector,
      itemType: 'OEFS_STANDARDS',
      quantity: trayQty * 30, // in eggs (1 tray = 30 eggs)
      movementType: 'VENTE',
      reason: `Vente client ${newSale.clientName} (${trayQty} plateaux)`,
      performedBy: userId,
      performedByName: user.name,
      timestamp: new Date().toISOString(),
    });

    this.save();

    this.logAudit({
      userId,
      userName: user.name,
      userRole: user.role,
      action: 'VENTE',
      sector: newSale.sector,
      details: `Vente : ${newSale.quantity} plateaux à ${newSale.clientName} (${newSale.totalAmount} FCFA)`,
      entityId: newSale.id,
    });

    syncHub.broadcast({
      id: `evt_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      type: 'sale',
      action: 'create',
      entityId: newSale.id,
      userId,
      userName: user.name,
      timestamp: new Date().toISOString(),
      data: newSale,
    });

    return newSale;
  }

  // --- Invoices ---
  public normalizeInvoice(inv: Invoice): Invoice {
    const items = (inv.items || []).map(it => {
      const q = Number(it.quantity) || 0;
      const u = Number(it.unitPrice) || 0;
      const t = it.total !== undefined ? Number(it.total) : q * u;
      return {
        ...it,
        quantity: q,
        unitPrice: u,
        total: t,
      };
    });
    const subtotal = inv.subtotal !== undefined 
      ? Number(inv.subtotal) 
      : items.reduce((sum, it) => sum + it.total, 0);
    const discount = Number(inv.discount) || 0;
    const total = inv.total !== undefined 
      ? Number(inv.total) 
      : Math.max(0, subtotal - discount);
    const amountPaid = Number(inv.amountPaid) || 0;
    const balanceDue = inv.balanceDue !== undefined 
      ? Number(inv.balanceDue) 
      : Math.max(0, total - amountPaid);

    return {
      ...inv,
      items,
      subtotal,
      discount,
      total,
      amountPaid,
      balanceDue,
    };
  }

  public getInvoices(): Invoice[] {
    return this.data.invoices
      .map(i => this.normalizeInvoice(i))
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  public getInvoice(id: string): Invoice | undefined {
    const inv = this.data.invoices.find(i => i.id === id || i.number === id);
    return inv ? this.normalizeInvoice(inv) : undefined;
  }

  public getNextInvoiceNumber(): string {
    const year = new Date().getFullYear();
    const count = this.data.invoices.length + 1;
    return `FAC-${year}-${count.toString().padStart(4, '0')}`;
  }

  public createInvoice(
    invoiceData: Omit<Invoice, 'id' | 'number' | 'createdAt' | 'createdBy' | 'subtotal' | 'total' | 'balanceDue'> & { 
      subtotal?: number; 
      total?: number; 
      balanceDue?: number; 
    }, 
    userId: string
  ): Invoice {
    const user = this.getUser(userId);
    const subtotal = invoiceData.subtotal !== undefined 
      ? invoiceData.subtotal 
      : invoiceData.items.reduce((sum, it) => sum + (it.total !== undefined ? it.total : it.quantity * it.unitPrice), 0);
    const discount = invoiceData.discount || 0;
    const total = invoiceData.total !== undefined ? invoiceData.total : Math.max(0, subtotal - discount);
    const amountPaid = invoiceData.amountPaid || 0;
    const balanceDue = invoiceData.balanceDue !== undefined ? invoiceData.balanceDue : Math.max(0, total - amountPaid);

    const newInvoice: Invoice = {
      ...invoiceData,
      subtotal,
      discount,
      total,
      amountPaid,
      balanceDue,
      id: `inv_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      number: this.getNextInvoiceNumber(),
      createdBy: userId,
      createdByName: user?.name || 'Administrateur',
      createdAt: new Date().toISOString(),
    };

    this.data.invoices.push(newInvoice);
    this.save();

    this.logAudit({
      userId,
      userName: user?.name || 'Direction',
      userRole: user?.role || 'admin',
      action: 'FACTURE_CREATION',
      details: `Création facture ${newInvoice.number} pour ${newInvoice.clientName} (Total: ${newInvoice.total} FCFA)`,
      entityId: newInvoice.id,
    });

    syncHub.broadcast({
      id: `evt_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      type: 'invoice',
      action: 'create',
      entityId: newInvoice.id,
      userId,
      userName: user?.name || 'Direction',
      timestamp: new Date().toISOString(),
      data: newInvoice,
    });

    return newInvoice;
  }

  public updateInvoice(id: string, updates: Partial<Invoice>): Invoice {
    const invIndex = this.data.invoices.findIndex(i => i.id === id);
    if (invIndex === -1) throw new Error('Facture introuvable');
    const merged = { ...this.data.invoices[invIndex], ...updates };
    const updated = this.normalizeInvoice(merged);
    this.data.invoices[invIndex] = updated;
    this.save();

    this.logAudit({
      userId: updated.createdBy,
      userName: updated.createdByName || 'Direction',
      userRole: 'admin',
      action: 'FACTURE_MODIFICATION',
      details: `Mise à jour facture ${updated.number} (Statut: ${updated.status}, Reste: ${updated.balanceDue} FCFA)`,
      entityId: updated.id,
    });

    syncHub.broadcast({
      id: `evt_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      type: 'invoice',
      action: 'update',
      entityId: updated.id,
      userId: updated.createdBy,
      userName: updated.createdByName || 'Direction',
      timestamp: new Date().toISOString(),
      data: updated,
    });

    return updated;
  }

  // --- Email Logs ---
  public getEmailLogs(): EmailLog[] {
    return [...this.data.emailLogs].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }

  public logEmail(log: Omit<EmailLog, 'id' | 'timestamp'>): EmailLog {
    const newLog: EmailLog = {
      ...log,
      id: `eml_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      timestamp: new Date().toISOString(),
    };
    this.data.emailLogs.push(newLog);
    this.save();
    return newLog;
  }

  // --- Settings ---
  public getSettings(): FarmSettings {
    return this.data.settings;
  }

  public updateSettings(updates: Partial<FarmSettings>): FarmSettings {
    Object.assign(this.data.settings, updates);
    this.save();
    return this.data.settings;
  }

  // --- Suivi Vétérinaire & Pharmacie (M. Ndour) ---
  public getMedications(): MedicationItem[] {
    return this.data.medications || [];
  }

  public getMedication(id: string): MedicationItem | undefined {
    return (this.data.medications || []).find(m => m.id === id);
  }

  public upsertMedication(item: Partial<MedicationItem> & { name: string }, userId: string): MedicationItem {
    const user = this.getUser(userId);
    if (!this.data.medications) this.data.medications = [];

    const now = new Date().toISOString();
    let existing = item.id ? this.data.medications.find(m => m.id === item.id) : undefined;

    if (existing) {
      Object.assign(existing, {
        name: item.name,
        category: item.category || existing.category,
        unit: item.unit || existing.unit,
        currentStock: item.currentStock !== undefined ? Number(item.currentStock) : existing.currentStock,
        minimumStockAlert: item.minimumStockAlert !== undefined ? Number(item.minimumStockAlert) : existing.minimumStockAlert,
        expiryDate: item.expiryDate || existing.expiryDate,
        batchNumber: item.batchNumber || existing.batchNumber,
        validatedByVet: user?.role === 'veterinaire' || user?.role === 'admin' ? true : existing.validatedByVet,
        vetName: user?.role === 'veterinaire' ? user.name : (existing.vetName || user?.name),
        updatedAt: now,
      });
      this.save();
      return existing;
    } else {
      const newMed: MedicationItem = {
        id: `med_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        name: item.name,
        category: item.category || 'autre',
        unit: item.unit || 'Unités',
        currentStock: Number(item.currentStock) || 0,
        minimumStockAlert: Number(item.minimumStockAlert) || 5,
        expiryDate: item.expiryDate || new Date(Date.now() + 180 * 24 * 3600 * 1000).toISOString().split('T')[0],
        batchNumber: item.batchNumber || `LOT-${Date.now().toString().slice(-6)}`,
        validatedByVet: user?.role === 'veterinaire' || user?.role === 'admin',
        vetName: user?.role === 'veterinaire' ? user.name : (user?.name || 'M. Ndour'),
        createdAt: now,
        updatedAt: now,
      };
      this.data.medications.push(newMed);
      this.save();
      return newMed;
    }
  }

  public getMedicationMovements(medicationId?: string): MedicationMovement[] {
    const movs = this.data.medicationMovements || [];
    if (medicationId) {
      return movs.filter(m => m.medicationId === medicationId).sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    }
    return [...movs].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }

  public addMedicationMovement(
    movement: {
      medicationId: string;
      type: any;
      quantity: number;
      date?: string;
      sector?: SectorId | 'TOUS' | 'CENTRAL';
      reason: string;
      dosagePrescrit?: string;
    },
    userId: string
  ): MedicationMovement {
    const user = this.getUser(userId);
    const med = this.getMedication(movement.medicationId);
    if (!med) throw new Error('Médicament introuvable dans la pharmacie');

    const qty = Number(movement.quantity);
    if (isNaN(qty) || qty <= 0) throw new Error('La quantité doit être un nombre strictement positif');

    const prevStock = med.currentStock;
    let newStock = prevStock;

    if (movement.type === 'ENTREE') {
      newStock = prevStock + qty;
    } else {
      if (prevStock < qty && movement.type === 'SORTIE_TRAITEMENT') {
        throw new Error(`Stock insuffisant : ${prevStock} ${med.unit} disponibles, demande de ${qty}`);
      }
      newStock = Math.max(0, prevStock - qty);
    }

    med.currentStock = newStock;
    med.updatedAt = new Date().toISOString();

    const isVet = user?.role === 'veterinaire' || user?.role === 'admin';
    const now = new Date().toISOString();

    const newMov: MedicationMovement = {
      id: `mmov_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      medicationId: med.id,
      medicationName: med.name,
      type: movement.type,
      quantity: qty,
      previousStock: prevStock,
      newStock,
      date: movement.date || now.split('T')[0],
      sector: movement.sector || 'CENTRAL',
      reason: movement.reason,
      dosagePrescrit: movement.dosagePrescrit,
      performedBy: userId,
      performedByName: user?.name || 'Utilisateur',
      validatedByVet: isVet,
      validatedByVetName: isVet ? (user?.name || 'M. Ndour') : undefined,
      timestamp: now,
    };

    if (!this.data.medicationMovements) this.data.medicationMovements = [];
    this.data.medicationMovements.push(newMov);
    this.save();

    this.logAudit({
      userId,
      userName: user?.name || 'M. Ndour',
      userRole: user?.role || 'veterinaire',
      action: 'MOUVEMENT_MEDICAMENT',
      details: `${newMov.type} : ${newMov.quantity} ${med.unit} de ${med.name} (Secteur: ${newMov.sector})`,
      entityId: newMov.id,
    });

    syncHub.broadcast({
      id: `evt_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      type: 'medication',
      action: 'create',
      entityId: newMov.id,
      userId,
      userName: user?.name || 'M. Ndour',
      timestamp: new Date().toISOString(),
      data: newMov,
    });

    return newMov;
  }

  // --- Vaccins & Campagnes ---
  public getVaccines(): VaccineItem[] {
    return this.data.vaccines || [];
  }

  public getVaccine(id: string): VaccineItem | undefined {
    return (this.data.vaccines || []).find(v => v.id === id);
  }

  public upsertVaccine(item: Partial<VaccineItem> & { name: string; targetDisease: string }, userId: string): VaccineItem {
    const user = this.getUser(userId);
    if (!this.data.vaccines) this.data.vaccines = [];

    const now = new Date().toISOString();
    let existing = item.id ? this.data.vaccines.find(v => v.id === item.id) : undefined;

    if (existing) {
      Object.assign(existing, {
        name: item.name,
        targetDisease: item.targetDisease,
        unit: item.unit || existing.unit,
        quantityReceived: item.quantityReceived !== undefined ? Number(item.quantityReceived) : existing.quantityReceived,
        currentStock: item.currentStock !== undefined ? Number(item.currentStock) : existing.currentStock,
        minimumStockAlert: item.minimumStockAlert !== undefined ? Number(item.minimumStockAlert) : existing.minimumStockAlert,
        receptionDate: item.receptionDate || existing.receptionDate,
        expiryDate: item.expiryDate || existing.expiryDate,
        batchNumber: item.batchNumber || existing.batchNumber,
        validatedByVet: user?.role === 'veterinaire' || user?.role === 'admin' ? true : existing.validatedByVet,
      });
      this.save();
      return existing;
    } else {
      const qty = Number(item.quantityReceived) || 0;
      const newVac: VaccineItem = {
        id: `vac_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        name: item.name,
        targetDisease: item.targetDisease,
        unit: item.unit || 'Doses',
        quantityReceived: qty,
        currentStock: item.currentStock !== undefined ? Number(item.currentStock) : qty,
        minimumStockAlert: Number(item.minimumStockAlert) || 2000,
        receptionDate: item.receptionDate || now.split('T')[0],
        expiryDate: item.expiryDate || new Date(Date.now() + 120 * 24 * 3600 * 1000).toISOString().split('T')[0],
        batchNumber: item.batchNumber || `LOT-VAC-${Date.now().toString().slice(-6)}`,
        validatedByVet: user?.role === 'veterinaire' || user?.role === 'admin',
        vetName: user?.role === 'veterinaire' ? user.name : 'M. Ndour',
        createdAt: now,
      };
      this.data.vaccines.push(newVac);
      this.save();
      return newVac;
    }
  }

  public getVaccinations(sector?: SectorId): VaccinationCampaign[] {
    const list = this.data.vaccinations || [];
    if (sector) {
      return list.filter(v => v.sector === sector).sort((a, b) => b.scheduledDate.localeCompare(a.scheduledDate));
    }
    return [...list].sort((a, b) => b.scheduledDate.localeCompare(a.scheduledDate));
  }

  public upsertVaccination(campaign: Partial<VaccinationCampaign> & { vaccineName: string; sector: SectorId; scheduledDate: string }, userId: string): VaccinationCampaign {
    const user = this.getUser(userId);
    if (!this.data.vaccinations) this.data.vaccinations = [];

    const now = new Date().toISOString();
    let existing = campaign.id ? this.data.vaccinations.find(v => v.id === campaign.id) : undefined;
    const isVet = user?.role === 'veterinaire' || user?.role === 'admin';

    if (existing) {
      Object.assign(existing, {
        vaccineId: campaign.vaccineId || existing.vaccineId,
        vaccineName: campaign.vaccineName,
        sector: campaign.sector,
        scheduledDate: campaign.scheduledDate,
        targetBirdCount: Number(campaign.targetBirdCount) || existing.targetBirdCount,
        status: campaign.status || existing.status,
        realizedDate: campaign.realizedDate || existing.realizedDate,
        dosesAdministered: campaign.dosesAdministered !== undefined ? Number(campaign.dosesAdministered) : existing.dosesAdministered,
        administrationRoute: campaign.administrationRoute || existing.administrationRoute,
        observations: campaign.observations !== undefined ? campaign.observations : existing.observations,
        validatedByVet: isVet ? true : existing.validatedByVet,
        vetId: isVet ? user?.id : existing.vetId,
        vetName: isVet ? user?.name : existing.vetName,
        updatedAt: now,
      });
      this.save();
      return existing;
    } else {
      const newCamp: VaccinationCampaign = {
        id: `vcamp_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        vaccineId: campaign.vaccineId || '',
        vaccineName: campaign.vaccineName,
        sector: campaign.sector,
        scheduledDate: campaign.scheduledDate,
        targetBirdCount: Number(campaign.targetBirdCount) || this.data.settings.sectorFlocks[campaign.sector] || 2500,
        status: campaign.status || 'PROGRAMMEE',
        realizedDate: campaign.realizedDate,
        dosesAdministered: campaign.dosesAdministered ? Number(campaign.dosesAdministered) : undefined,
        administrationRoute: campaign.administrationRoute || 'EAU_BOISSON',
        observations: campaign.observations || '',
        validatedByVet: isVet,
        vetId: isVet ? user?.id : undefined,
        vetName: isVet ? user?.name : 'M. Ndour',
        recordedBy: userId,
        recordedByName: user?.name || 'Utilisateur',
        createdAt: now,
        updatedAt: now,
      };
      this.data.vaccinations.push(newCamp);
      this.save();
      return newCamp;
    }
  }

  public markVaccinationRealized(id: string, data: { realizedDate: string; dosesAdministered: number; observations?: string }, userId: string): VaccinationCampaign {
    const user = this.getUser(userId);
    const camp = (this.data.vaccinations || []).find(v => v.id === id);
    if (!camp) throw new Error('Campagne de vaccination introuvable');

    const isVet = user?.role === 'veterinaire' || user?.role === 'admin';
    if (!isVet) {
      throw new Error('Validation vétérinaire requise pour certifier la réalisation du protocole de vaccination.');
    }

    camp.status = 'REALISEE';
    camp.realizedDate = data.realizedDate || new Date().toISOString().split('T')[0];
    camp.dosesAdministered = Number(data.dosesAdministered);
    if (data.observations) camp.observations = data.observations;
    camp.validatedByVet = true;
    camp.vetId = user.id;
    camp.vetName = user.name;
    camp.updatedAt = new Date().toISOString();

    // Deduct from corresponding vaccine stock if linked
    if (camp.vaccineId) {
      const vac = this.getVaccine(camp.vaccineId);
      if (vac) {
        vac.currentStock = Math.max(0, vac.currentStock - Number(data.dosesAdministered));
      }
    }

    this.save();

    this.logAudit({
      userId,
      userName: user.name,
      userRole: user.role,
      action: 'VACCINATION_REALISATION',
      sector: camp.sector,
      details: `Vaccination réalisée secteur ${camp.sector} : ${data.dosesAdministered} doses (${camp.vaccineName})`,
      entityId: camp.id,
    });

    syncHub.broadcast({
      id: `evt_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      type: 'vaccination',
      action: 'update',
      entityId: camp.id,
      userId,
      userName: user.name,
      timestamp: new Date().toISOString(),
      data: camp,
    });

    return camp;
  }

  // --- Suivi Sanitaire & Traitements ---
  public getSanitaryTreatments(sector?: SectorId): SanitaryTreatmentRecord[] {
    const list = this.data.sanitaryTreatments || [];
    if (sector) {
      return list.filter(t => t.sector === sector).sort((a, b) => b.date.localeCompare(a.date));
    }
    return [...list].sort((a, b) => b.date.localeCompare(a.date));
  }

  public addSanitaryTreatment(
    treatment: {
      date?: string;
      sector: SectorId;
      diagnosis: string;
      treatmentType: 'MEDICAMENT' | 'VACCINATION' | 'DESINFECTION' | 'PREVENTIF';
      productName: string;
      dosage: string;
      durationDays: number;
      startDate: string;
      endDate?: string;
      withdrawalPeriodDays?: number;
      status?: 'EN_COURS' | 'TERMINE' | 'ARRETE';
      observations?: string;
    },
    userId: string
  ): SanitaryTreatmentRecord {
    const user = this.getUser(userId);
    const isVet = user?.role === 'veterinaire' || user?.role === 'admin';
    if (!isVet) {
      throw new Error('Action refusée : Seul le vétérinaire (M. Ndour) ou l\'administrateur peut valider et prescrire des protocoles et dosages.');
    }

    if (!treatment.dosage || treatment.dosage.trim().length === 0) {
      throw new Error('Le dosage et la posologie validés par le praticien sont obligatoires.');
    }

    const now = new Date().toISOString();
    const duration = Number(treatment.durationDays) || 3;
    const start = treatment.startDate || treatment.date || now.split('T')[0];
    const end = treatment.endDate || new Date(new Date(start).getTime() + (duration - 1) * 24 * 3600 * 1000).toISOString().split('T')[0];

    const newRecord: SanitaryTreatmentRecord = {
      id: `treat_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      date: treatment.date || start,
      sector: treatment.sector,
      diagnosis: treatment.diagnosis,
      treatmentType: treatment.treatmentType || 'MEDICAMENT',
      productName: treatment.productName,
      dosage: treatment.dosage,
      durationDays: duration,
      startDate: start,
      endDate: end,
      withdrawalPeriodDays: Number(treatment.withdrawalPeriodDays) || 0,
      status: treatment.status || 'EN_COURS',
      observations: treatment.observations || '',
      validatedByVet: true,
      vetId: user.id,
      vetName: user.name,
      recordedBy: userId,
      recordedByName: user.name,
      createdAt: now,
    };

    if (!this.data.sanitaryTreatments) this.data.sanitaryTreatments = [];
    this.data.sanitaryTreatments.push(newRecord);
    this.save();

    this.logAudit({
      userId,
      userName: user.name,
      userRole: user.role,
      action: 'TRAITEMENT_SANITAIRE',
      sector: newRecord.sector,
      details: `Prescription traitement secteur ${newRecord.sector} : ${newRecord.productName} (Posologie : ${newRecord.dosage})`,
      entityId: newRecord.id,
    });

    syncHub.broadcast({
      id: `evt_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      type: 'treatment',
      action: 'create',
      entityId: newRecord.id,
      userId,
      userName: user.name,
      timestamp: new Date().toISOString(),
      data: newRecord,
    });

    return newRecord;
  }

  // --- Alertes Vétérinaires & Sanitaires Calculées ---
  public getVeterinaryAlerts(): VeterinaryAlerts {
    const today = new Date().toISOString().split('T')[0];
    const in30Days = new Date(Date.now() + 30 * 24 * 3600 * 1000).toISOString().split('T')[0];
    const in7Days = new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString().split('T')[0];

    const meds = this.data.medications || [];
    const vacs = this.data.vaccines || [];
    const camps = this.data.vaccinations || [];

    const lowStockMedications = meds.filter(m => m.currentStock <= m.minimumStockAlert);
    const lowStockVaccines = vacs.filter(v => v.currentStock <= v.minimumStockAlert);

    const expiringMedications = meds.filter(m => m.expiryDate <= in30Days);
    const expiringVaccines = vacs.filter(v => v.expiryDate <= in30Days);

    const upcomingVaccinations = camps.filter(c => c.status === 'PROGRAMMEE' && c.scheduledDate >= today && c.scheduledDate <= in7Days);
    const overdueVaccinations = camps.filter(c => c.status === 'PROGRAMMEE' && c.scheduledDate < today);

    const totalAlertsCount = 
      lowStockMedications.length + 
      lowStockVaccines.length + 
      expiringMedications.length + 
      expiringVaccines.length + 
      upcomingVaccinations.length + 
      overdueVaccinations.length;

    return {
      lowStockMedications,
      lowStockVaccines,
      expiringMedications,
      expiringVaccines,
      upcomingVaccinations,
      overdueVaccinations,
      totalAlertsCount,
    };
  }
}

export const db = new Database();
