import { 
  AuditLogEntry,
  AuthResponse,
  CollectionRecord, 
  DailySummary, 
  LiveSyncStatus,
  MedicationItem, 
  MedicationMovement, 
  SanitaryTreatmentRecord, 
  SectorId, 
  SyncEvent,
  User, 
  VaccinationCampaign, 
  VaccineItem, 
  VeterinaryAlerts 
} from '../types/index.js';

const OFFLINE_QUEUE_KEY = 'poulailler_campement_offline_queue_v3';
const AUTH_TOKEN_KEY = 'poulailler_campement_auth_token_v3';
const USER_ID_KEY = 'poulailler_campement_user_id_v3';

export interface OfflineAction {
  id: string; // client actionId
  type: 'upsert_collection' | 'add_stock' | 'add_mortality' | 'add_sale' | 'create_invoice';
  payload: any;
  timestamp: string;
  retryCount: number;
}

class ApiClient {
  private currentUserId: string = 'usr_admin';
  private sessionToken: string | null = null;
  private isOnlineStatus: boolean = typeof navigator !== 'undefined' ? navigator.onLine : true;
  private syncStatus: LiveSyncStatus = 'online';
  private eventSource: EventSource | null = null;
  private syncEventListeners: Set<(event: SyncEvent) => void> = new Set();
  private syncStatusListeners: Set<(status: LiveSyncStatus, pendingCount: number) => void> = new Set();
  private reconnectTimeout: any = null;

  constructor() {
    if (typeof window !== 'undefined') {
      const savedUserId = localStorage.getItem(USER_ID_KEY) || localStorage.getItem('avipo_current_user_id');
      const savedToken = localStorage.getItem(AUTH_TOKEN_KEY);
      if (savedUserId) this.currentUserId = savedUserId;
      if (savedToken) this.sessionToken = savedToken;

      window.addEventListener('online', () => {
        this.isOnlineStatus = true;
        this.setSyncStatus('syncing');
        this.connectLiveSync();
        this.syncOfflineQueue();
      });

      window.addEventListener('offline', () => {
        this.isOnlineStatus = false;
        this.setSyncStatus('offline');
      });

      // Initialize SSE stream
      this.connectLiveSync();
    }
  }

  public setSyncStatus(status: LiveSyncStatus) {
    this.syncStatus = status;
    const pendingCount = this.getOfflineQueue().length;
    for (const listener of this.syncStatusListeners) {
      try {
        listener(status, pendingCount);
      } catch (err) {
        console.error('Error in syncStatusListener:', err);
      }
    }
  }

  public getSyncStatus(): { status: LiveSyncStatus; isOnline: boolean; pendingCount: number } {
    return {
      status: this.syncStatus,
      isOnline: this.isOnlineStatus,
      pendingCount: this.getOfflineQueue().length,
    };
  }

  public onSyncStatusChange(callback: (status: LiveSyncStatus, pendingCount: number) => void): () => void {
    this.syncStatusListeners.add(callback);
    callback(this.syncStatus, this.getOfflineQueue().length);
    return () => {
      this.syncStatusListeners.delete(callback);
    };
  }

  public onSyncEvent(callback: (event: SyncEvent) => void): () => void {
    this.syncEventListeners.add(callback);
    return () => {
      this.syncEventListeners.delete(callback);
    };
  }

  private connectLiveSync() {
    if (typeof window === 'undefined' || typeof EventSource === 'undefined') return;
    if (this.eventSource) {
      this.eventSource.close();
      this.eventSource = null;
    }

    try {
      this.eventSource = new EventSource('/api/sync/events');

      this.eventSource.onopen = () => {
        this.isOnlineStatus = true;
        this.setSyncStatus('online');
      };

      this.eventSource.onmessage = (e) => {
        try {
          const event: SyncEvent = JSON.parse(e.data);
          for (const listener of this.syncEventListeners) {
            try {
              listener(event);
            } catch (err) {
              console.error('Error in syncEventListener:', err);
            }
          }
        } catch {}
      };

      this.eventSource.onerror = () => {
        if (this.eventSource) {
          this.eventSource.close();
          this.eventSource = null;
        }
        this.setSyncStatus('offline');
        // Reconnect after 4s
        if (!this.reconnectTimeout) {
          this.reconnectTimeout = setTimeout(() => {
            this.reconnectTimeout = null;
            if (typeof navigator === 'undefined' || navigator.onLine) {
              this.connectLiveSync();
            }
          }, 4000);
        }
      };
    } catch (err) {
      console.warn('Live sync SSE connection error:', err);
      this.setSyncStatus('offline');
    }
  }

  public setSession(token: string | null, userId: string) {
    this.sessionToken = token;
    this.currentUserId = userId;
    if (typeof localStorage !== 'undefined') {
      if (token) {
        localStorage.setItem(AUTH_TOKEN_KEY, token);
      } else {
        localStorage.removeItem(AUTH_TOKEN_KEY);
      }
      localStorage.setItem(USER_ID_KEY, userId);
      localStorage.setItem('avipo_current_user_id', userId);
    }
  }

  public getSessionToken(): string | null {
    return this.sessionToken;
  }

  public setUserId(userId: string) {
    this.currentUserId = userId;
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(USER_ID_KEY, userId);
      localStorage.setItem('avipo_current_user_id', userId);
    }
  }

  public getUserId(): string {
    return this.currentUserId;
  }

  public isOnline(): boolean {
    return this.isOnlineStatus;
  }

  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'x-user-id': this.currentUserId,
      ...(options.headers as any),
    };

    if (this.sessionToken) {
      headers['Authorization'] = `Bearer ${this.sessionToken}`;
      headers['x-session-token'] = this.sessionToken;
    }

    try {
      const response = await fetch(`/api${endpoint}`, {
        ...options,
        headers,
      });

      if (!response.ok) {
        let errorData: any = {};
        try {
          errorData = await response.json();
        } catch {
          errorData = { error: `Erreur HTTP ${response.status}` };
        }
        throw new Error(errorData.error || `Erreur serveur (${response.status})`);
      }

      this.isOnlineStatus = true;
      if (this.syncStatus === 'offline') this.setSyncStatus('online');
      return (await response.json()) as T;
    } catch (err: any) {
      if (!navigator.onLine || err.message?.includes('Failed to fetch') || err.message?.includes('NetworkError')) {
        this.isOnlineStatus = false;
        this.setSyncStatus('offline');
      }
      throw err;
    }
  }

  // --- Multi-User Auth ---
  public async login(userId: string, pin: string): Promise<AuthResponse> {
    const res = await this.request<AuthResponse>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ userId, pin }),
    });
    if (res.success && res.token) {
      this.setSession(res.token, res.user.id);
      this.connectLiveSync();
      this.syncOfflineQueue();
    }
    return res;
  }

  public async logout(): Promise<void> {
    try {
      await this.request('/auth/logout', { method: 'POST' });
    } catch {}
    this.setSession(null, 'usr_admin');
  }

  public async getTeam(): Promise<Array<{ id: string; name: string; role: string; phone?: string; sectors: SectorId[]; hasPin?: boolean }>> {
    return this.request('/auth/team');
  }

  public async changePin(oldPin: string, newPin: string): Promise<{ success: boolean; message: string }> {
    return this.request('/auth/change-pin', {
      method: 'POST',
      body: JSON.stringify({ oldPin, newPin }),
    });
  }

  public async getAuditLogs(): Promise<AuditLogEntry[]> {
    return this.request('/sync/audit-logs');
  }

  public async getMe(): Promise<{ user: User; allowedSectors: SectorId[]; allUsers: any[] }> {
    return this.request('/auth/me');
  }

  public async switchUser(userId: string, pin?: string): Promise<{ success: boolean; user: User; allowedSectors: SectorId[]; token?: string }> {
    const res = await this.request<{ success: boolean; user: User; allowedSectors: SectorId[]; token?: string }>('/auth/switch-user', {
      method: 'POST',
      body: JSON.stringify({ userId, pin }),
    });
    if (res.token) {
      this.setSession(res.token, userId);
    } else {
      this.setUserId(userId);
    }
    return res;
  }

  // --- Users ---
  public async getUsers(): Promise<User[]> {
    return this.request('/users');
  }

  public async createUser(data: { name: string; email: string; role: string; phone?: string; sectors?: SectorId[] }): Promise<User> {
    return this.request('/users', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  public async updateUser(id: string, data: any): Promise<User> {
    return this.request(`/users/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  public async setUserPassword(targetUserId: string, password: string, operatorPassword?: string): Promise<{ success: boolean; message: string }> {
    return this.request(`/admin/users/${targetUserId}/password`, {
      method: 'POST',
      body: JSON.stringify({ password, operatorPassword }),
    });
  }

  public async deleteUser(id: string, reason: string, operatorPassword?: string): Promise<{ success: boolean; user: User }> {
    return this.request(`/users/${id}`, {
      method: 'DELETE',
      body: JSON.stringify({ reason, operatorPassword }),
    });
  }

  // --- Security & Policy Settings ---
  public async getSecuritySettings(): Promise<{ sessionDurationHours: number; requireReauthForSensitiveOps: boolean; requirePasswordOnAppOpen: boolean }> {
    return this.request('/admin/security-settings');
  }

  public async updateSecuritySettings(
    settings: { sessionDurationHours?: number; requireReauthForSensitiveOps?: boolean; requirePasswordOnAppOpen?: boolean },
    operatorPassword?: string
  ): Promise<{ sessionDurationHours: number; requireReauthForSensitiveOps: boolean; requirePasswordOnAppOpen: boolean }> {
    return this.request('/admin/security-settings', {
      method: 'PUT',
      body: JSON.stringify({ ...settings, operatorPassword }),
    });
  }

  // --- Deletion (Boubacar Sene Admin Principal) ---
  public async deleteCollection(idOrKey: string, reason: string, operatorPassword?: string): Promise<{ success: boolean }> {
    return this.request(`/collections/${encodeURIComponent(idOrKey)}`, {
      method: 'DELETE',
      body: JSON.stringify({ reason, operatorPassword }),
    });
  }

  public async deleteStockMovement(id: string, reason: string, operatorPassword?: string): Promise<{ success: boolean }> {
    return this.request(`/stocks/movements/${id}`, {
      method: 'DELETE',
      body: JSON.stringify({ reason, operatorPassword }),
    });
  }

  public async deleteSale(id: string, reason: string, operatorPassword?: string): Promise<{ success: boolean }> {
    return this.request(`/sales/${id}`, {
      method: 'DELETE',
      body: JSON.stringify({ reason, operatorPassword }),
    });
  }

  public async deleteInvoice(id: string, reason: string, permanent?: boolean, operatorPassword?: string): Promise<{ success: boolean }> {
    return this.request(`/invoices/${id}`, {
      method: 'DELETE',
      body: JSON.stringify({ reason, permanent, operatorPassword }),
    });
  }

  public async deleteMortality(id: string, reason: string, operatorPassword?: string): Promise<{ success: boolean }> {
    return this.request(`/mortality/${id}`, {
      method: 'DELETE',
      body: JSON.stringify({ reason, operatorPassword }),
    });
  }

  public async deleteTreatment(id: string, reason: string, operatorPassword?: string): Promise<{ success: boolean }> {
    return this.request(`/veterinaire/treatments/${id}`, {
      method: 'DELETE',
      body: JSON.stringify({ reason, operatorPassword }),
    });
  }

  public async deleteVaccination(id: string, reason: string, operatorPassword?: string): Promise<{ success: boolean }> {
    return this.request(`/veterinaire/vaccinations/${id}`, {
      method: 'DELETE',
      body: JSON.stringify({ reason, operatorPassword }),
    });
  }

  public async getDeletedRecords(): Promise<any[]> {
    return this.request('/admin/deleted-records');
  }

  public async restoreDeletedRecord(id: string, operatorPassword?: string): Promise<{ success: boolean; entityType: string; restored: any }> {
    return this.request(`/admin/deleted-records/${id}/restore`, {
      method: 'POST',
      body: JSON.stringify({ operatorPassword }),
    });
  }

  // --- Collections ---
  public async getCollections(date?: string, sector?: SectorId): Promise<CollectionRecord[]> {
    const query = new URLSearchParams();
    if (date) query.set('date', date);
    if (sector) query.set('sector', sector);
    return this.request(`/collections?${query.toString()}`);
  }

  public async getDailySummary(date?: string): Promise<DailySummary & { isCompleteForUser?: boolean }> {
    const query = new URLSearchParams();
    if (date) query.set('date', date);
    return this.request(`/collections/summary?${query.toString()}`);
  }

  public async saveCollection(data: { 
    date: string; 
    slot: string; 
    sector: SectorId; 
    trays?: number;
    brokenEggs?: number;
    doubleYolkEggs?: number;
    depositTrays?: number;
    quantity?: number; 
    cracked?: number; 
    deposit?: number;
    actionId?: string;
    lastKnownUpdatedAt?: string;
    force?: boolean;
  }): Promise<{ collection: CollectionRecord; dailySummary: DailySummary }> {
    const trays = data.trays !== undefined ? data.trays : (data.quantity || 0);
    const brokenEggs = data.brokenEggs !== undefined ? data.brokenEggs : (data.cracked || 0);
    const doubleYolkEggs = data.doubleYolkEggs !== undefined ? data.doubleYolkEggs : 0;
    const depositTrays = data.depositTrays !== undefined ? data.depositTrays : (data.deposit !== undefined ? data.deposit : trays);
    const actionId = data.actionId || `act_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

    if (!this.isOnlineStatus) {
      // Queue offline
      this.enqueueOfflineAction({
        id: actionId,
        type: 'upsert_collection',
        payload: {
          ...data,
          actionId,
          trays,
          brokenEggs,
          doubleYolkEggs,
          depositTrays,
          quantity: trays,
          cracked: brokenEggs,
          deposit: depositTrays,
        },
        timestamp: new Date().toISOString(),
        retryCount: 0,
      });

      // Construct optimistic local record
      const optimisticCollection: CollectionRecord = {
        id: `opt_${Date.now()}`,
        date: data.date,
        slot: data.slot as any,
        sector: data.sector,
        trays,
        brokenEggs,
        doubleYolkEggs,
        depositTrays,
        quantity: trays,
        cracked: brokenEggs,
        deposit: depositTrays,
        recordedBy: this.currentUserId,
        recordedByName: 'Vous (hors connexion)',
        updatedAt: new Date().toISOString(),
      };

      return {
        collection: optimisticCollection,
        dailySummary: {
          date: data.date,
          isComplete: false,
          completedAt: null,
          totalTrays: trays,
          totalBrokenEggs: brokenEggs,
          totalDoubleYolkEggs: doubleYolkEggs,
          totalDepositedTrays: depositTrays,
          totalEggs: trays,
          totalCracked: brokenEggs,
          totalDeposited: depositTrays,
          bySector: { [data.sector]: { trays, brokenEggs, doubleYolkEggs, depositTrays, total: trays, cracked: brokenEggs, deposit: depositTrays } } as any,
          bySlot: { [data.slot]: trays } as any,
          emailSent: false,
          emailSentAt: null,
          emailRecipient: 'boubacarsene8@gmail.com',
          emailStatus: 'pending',
        },
      };
    }

    return this.request('/collections', {
      method: 'POST',
      body: JSON.stringify({
        ...data,
        actionId,
        trays,
        brokenEggs,
        doubleYolkEggs,
        depositTrays,
        quantity: trays,
        cracked: brokenEggs,
        deposit: depositTrays,
        lastKnownUpdatedAt: data.lastKnownUpdatedAt,
        force: data.force,
      }),
    });
  }

  public async triggerEmail(date: string, force?: boolean): Promise<any> {
    return this.request('/collections/trigger-email', {
      method: 'POST',
      body: JSON.stringify({ date, force }),
    });
  }

  // --- Stocks ---
  public async getStockBalances(): Promise<any> {
    return this.request('/stocks/balances');
  }

  public async getStockMovements(sector?: SectorId | 'CENTRAL'): Promise<any[]> {
    const query = new URLSearchParams();
    if (sector) query.set('sector', sector);
    return this.request(`/stocks/movements?${query.toString()}`);
  }

  public async addStockMovement(data: any): Promise<any> {
    return this.request('/stocks/movements', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  // --- Mortality ---
  public async getMortality(sector?: SectorId): Promise<any[]> {
    const query = new URLSearchParams();
    if (sector) query.set('sector', sector);
    return this.request(`/mortality?${query.toString()}`);
  }

  public async addMortality(data: any): Promise<any> {
    return this.request('/mortality', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  // --- Clients & Sales ---
  public async getClients(): Promise<any[]> {
    return this.request('/clients');
  }

  public async addClient(data: any): Promise<any> {
    return this.request('/clients', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  public async getSales(sector?: SectorId | 'CENTRAL'): Promise<any[]> {
    const query = new URLSearchParams();
    if (sector) query.set('sector', sector);
    return this.request(`/sales?${query.toString()}`);
  }

  public async addSale(data: any): Promise<any> {
    return this.request('/sales', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  // --- Invoices ---
  public async getInvoices(): Promise<any[]> {
    return this.request('/invoices');
  }

  public async getInvoice(id: string): Promise<any> {
    return this.request(`/invoices/${id}`);
  }

  public async createInvoice(data: any): Promise<any> {
    return this.request('/invoices', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  public async updateInvoice(id: string, data: any): Promise<any> {
    return this.request(`/invoices/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  public async sendInvoiceEmail(id: string, recipient?: string): Promise<any> {
    return this.request(`/invoices/${id}/send-email`, {
      method: 'POST',
      body: JSON.stringify({ recipient }),
    });
  }

  // --- Settings & Logs ---
  public async getSettings(): Promise<any> {
    return this.request('/settings');
  }

  public async updateSettings(data: any): Promise<any> {
    return this.request('/settings', {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  public async getEmailLogs(): Promise<any[]> {
    return this.request('/email-logs');
  }

  public async testEmail(recipient?: string): Promise<any> {
    return this.request('/settings/test-email', {
      method: 'POST',
      body: JSON.stringify({ recipient }),
    });
  }

  // --- Suivi Vétérinaire & Pharmacie ---
  public async getMedications(): Promise<MedicationItem[]> {
    return this.request('/veterinaire/medications');
  }

  public async saveMedication(data: Partial<MedicationItem> & { name: string }): Promise<MedicationItem> {
    return this.request('/veterinaire/medications', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  public async getMedicationMovements(medicationId?: string): Promise<MedicationMovement[]> {
    const query = new URLSearchParams();
    if (medicationId) query.set('medicationId', medicationId);
    return this.request(`/veterinaire/medications/movements?${query.toString()}`);
  }

  public async addMedicationMovement(data: any): Promise<MedicationMovement> {
    return this.request('/veterinaire/medications/movements', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  public async getVaccines(): Promise<VaccineItem[]> {
    return this.request('/veterinaire/vaccines');
  }

  public async saveVaccine(data: Partial<VaccineItem> & { name: string; targetDisease: string }): Promise<VaccineItem> {
    return this.request('/veterinaire/vaccines', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  public async getVaccinations(sector?: SectorId): Promise<VaccinationCampaign[]> {
    const query = new URLSearchParams();
    if (sector) query.set('sector', sector);
    return this.request(`/veterinaire/vaccinations?${query.toString()}`);
  }

  public async saveVaccination(data: any): Promise<VaccinationCampaign> {
    return this.request('/veterinaire/vaccinations', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  public async realizeVaccination(id: string, data: { realizedDate: string; dosesAdministered: number; observations?: string }): Promise<VaccinationCampaign> {
    return this.request(`/veterinaire/vaccinations/${id}/realize`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  public async getSanitaryTreatments(sector?: SectorId): Promise<SanitaryTreatmentRecord[]> {
    const query = new URLSearchParams();
    if (sector) query.set('sector', sector);
    return this.request(`/veterinaire/treatments?${query.toString()}`);
  }

  public async addSanitaryTreatment(data: any): Promise<SanitaryTreatmentRecord> {
    return this.request('/veterinaire/treatments', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  public async getVeterinaryAlerts(): Promise<VeterinaryAlerts> {
    return this.request('/veterinaire/alerts');
  }

  // --- Offline Queue Handling ---
  public getOfflineQueue(): OfflineAction[] {
    try {
      const stored = localStorage.getItem(OFFLINE_QUEUE_KEY);
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  }

  private enqueueOfflineAction(action: OfflineAction) {
    const queue = this.getOfflineQueue();
    queue.push(action);
    localStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(queue));
  }

  public async syncOfflineQueue(): Promise<{ syncedCount: number; errors: any[] }> {
    const queue = this.getOfflineQueue();
    if (!queue.length) {
      if (this.isOnlineStatus) this.setSyncStatus('online');
      return { syncedCount: 0, errors: [] };
    }

    this.setSyncStatus('syncing');
    const remainingQueue: OfflineAction[] = [];
    let syncedCount = 0;
    const errors: any[] = [];

    for (const item of queue) {
      try {
        const payloadWithActionId = { ...item.payload, actionId: item.id };
        if (item.type === 'upsert_collection') {
          await this.request('/collections', {
            method: 'POST',
            body: JSON.stringify(payloadWithActionId),
          });
          syncedCount++;
        } else if (item.type === 'add_stock') {
          await this.request('/stocks/movements', {
            method: 'POST',
            body: JSON.stringify(payloadWithActionId),
          });
          syncedCount++;
        } else if (item.type === 'add_mortality') {
          await this.request('/mortality', {
            method: 'POST',
            body: JSON.stringify(payloadWithActionId),
          });
          syncedCount++;
        } else if (item.type === 'add_sale') {
          await this.request('/sales', {
            method: 'POST',
            body: JSON.stringify(payloadWithActionId),
          });
          syncedCount++;
        } else if (item.type === 'create_invoice') {
          await this.request('/invoices', {
            method: 'POST',
            body: JSON.stringify(payloadWithActionId),
          });
          syncedCount++;
        }
      } catch (err: any) {
        console.error('Failed to sync offline item:', item, err);
        errors.push({ item, error: err?.message });
        if (item.retryCount < 5) {
          remainingQueue.push({ ...item, retryCount: item.retryCount + 1 });
        }
      }
    }

    localStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(remainingQueue));
    this.setSyncStatus(remainingQueue.length > 0 ? 'offline' : 'online');
    return { syncedCount, errors };
  }
}

export const api = new ApiClient();
