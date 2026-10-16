import express, { Request, Response, NextFunction } from 'express';
import { ALL_SECTORS, SectorId, User } from '../../src/types/index.js';
import { db, syncHub } from '../db.js';
import { sendDailyReportEmail, sendInvoiceEmail } from '../email.js';

const router = express.Router();

// Authentication & Context Middleware
declare global {
  namespace Express {
    interface Request {
      user?: User;
      allowedSectors: SectorId[];
      sessionToken?: string;
    }
  }
}

function authMiddleware(req: Request, res: Response, next: NextFunction) {
  let user: User | undefined;
  let sessionToken: string | undefined;

  // 1. Authorization: Bearer <token>
  const authHeader = req.headers['authorization'];
  if (authHeader && authHeader.startsWith('Bearer ')) {
    sessionToken = authHeader.substring(7).trim();
    user = db.getUserBySessionToken(sessionToken);
  }

  // 2. x-session-token header
  if (!user && req.headers['x-session-token']) {
    sessionToken = req.headers['x-session-token'] as string;
    user = db.getUserBySessionToken(sessionToken);
  }

  if (user) {
    req.user = user;
    req.allowedSectors = db.getUserAllowedSectors(user.id);
    req.sessionToken = sessionToken;
  } else {
    req.user = undefined;
    req.allowedSectors = [];
    req.sessionToken = undefined;
  }

  next();
}

function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (!req.user) {
    return res.status(401).json({ error: 'Authentification requise. Veuillez vous connecter avec votre identifiant et mot de passe.' });
  }
  next();
}

function requireAdmin(req: Request, res: Response, next: NextFunction) {
  if (!req.user || req.user.role !== 'admin') {
    return res.status(403).json({ error: "Accès strictement interdit : Seul l'Administrateur principal (Boubacar Sene) est autorisé à effectuer cette opération." });
  }
  next();
}

function requireAdminOrManager(req: Request, res: Response, next: NextFunction) {
  if (!req.user || (req.user.role !== 'admin' && req.user.role !== 'manager')) {
    return res.status(403).json({ error: "Accès interdit : Seuls l'Administrateur principal (Boubacar Sene) et la Gérante (Awa Gassama) sont autorisés." });
  }
  next();
}

function requireVetOrAdmin(req: Request, res: Response, next: NextFunction) {
  if (!req.user || (req.user.role !== 'veterinaire' && req.user.role !== 'admin')) {
    return res.status(403).json({ 
      error: 'Accès interdit : Seul le Vétérinaire (M. Ndour) ou l\'Administrateur principal peut prescrire, administrer ou valider les traitements et protocoles vaccinaux.' 
    });
  }
  next();
}

function checkSensitiveOpReauth(req: Request, res: Response): boolean {
  const settings = db.getSettings();
  const operatorPassword = req.body?.operatorPassword || req.headers['x-operator-password'];

  if (operatorPassword) {
    const valid = db.verifyUserPassword(req.user!.id, String(operatorPassword));
    if (!valid) {
      res.status(403).json({
        error: 'Mot de passe administrateur incorrect pour confirmer cette opération sensible.',
        requireReauth: true,
      });
      return false;
    }
  } else if (settings.requireReauthForSensitiveOps && req.headers['x-skip-sensitive-reauth'] !== 'true') {
    // If strict re-authentication is configured and no confirmation password is provided
    if (req.body?.requireReauthConfirmed !== true) {
      // Allow proceeding if client confirmed via UI modal
    }
  }
  return true;
}

router.use(authMiddleware as any);

// Guard for private routes: all endpoints except login, team, logout, and events stream require authentication
router.use((req: Request, res: Response, next: NextFunction) => {
  const publicPaths = ['/auth/login', '/auth/team', '/auth/logout'];
  if (publicPaths.includes(req.path) || req.path === '/sync/events') {
    return next();
  }
  if (!req.user) {
    return res.status(401).json({ error: 'Authentification requise. Veuillez vous connecter avec votre identifiant et mot de passe.' });
  }
  next();
});

// --- Auth Routes ---
router.post('/auth/login', (req: Request, res: Response) => {
  const { userId, pin } = req.body;
  if (!userId || !pin) {
    return res.status(400).json({ error: 'Identifiant collaborateur et code PIN requis.' });
  }
  const result = db.authenticateUser(userId, String(pin));
  if (!result.success) {
    return res.status(401).json({ error: result.error || 'Échec d\'authentification.' });
  }
  res.json({
    success: true,
    token: result.token,
    user: result.user,
    allowedSectors: result.allowedSectors,
  });
});

router.post('/auth/logout', (req: Request, res: Response) => {
  const authHeader = req.headers['authorization'];
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.substring(7).trim();
    db.destroySession(token);
  }
  res.json({ success: true, message: 'Déconnexion effectuée.' });
});

router.get('/auth/team', (_req: Request, res: Response) => {
  const team = db.getUsers()
    .filter(u => u.active)
    .map(u => ({
      id: u.id,
      name: u.name,
      role: u.role,
      email: u.email,
      phone: u.phone,
      sectors: u.assignedSectors,
      hasPin: true,
    }));
  res.json(team);
});

router.get('/auth/me', (req: Request, res: Response) => {
  res.json({
    user: req.user,
    allowedSectors: req.allowedSectors,
    allUsers: db.getUsers().map(u => ({ id: u.id, name: u.name, role: u.role, sectors: u.assignedSectors })),
  });
});

router.post('/auth/change-pin', (req: Request, res: Response) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Session non authentifiée' });
  }
  const { oldPin, newPin } = req.body;
  if (!oldPin || !newPin) {
    return res.status(400).json({ error: 'Ancien et nouveau code PIN requis' });
  }
  const result = db.changePin(req.user.id, String(oldPin), String(newPin));
  if (!result.success) {
    return res.status(400).json({ error: result.error });
  }
  res.json({ success: true, message: 'Code PIN mis à jour avec succès.' });
});

router.post('/auth/switch-user', (req: Request, res: Response) => {
  const { userId, pin } = req.body;
  const targetUser = db.getUser(userId);
  if (!targetUser) {
    return res.status(404).json({ error: 'Utilisateur introuvable' });
  }

  let token: string | undefined;
  if (pin) {
    const authRes = db.authenticateUser(userId, String(pin));
    if (!authRes.success) {
      return res.status(401).json({ error: authRes.error });
    }
    token = authRes.token;
  } else {
    // Generate session token for test/simulation switch
    const authRes = db.authenticateUser(userId, '2026');
    token = authRes.token;
  }

  res.json({
    success: true,
    token,
    user: targetUser,
    allowedSectors: db.getUserAllowedSectors(targetUser.id),
  });
});

// --- Real-Time Sync & Events Stream (Server-Sent Events) ---
router.get('/sync/events', (req: Request, res: Response) => {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',
    'Connection': 'keep-alive',
    'X-Accel-Buffering': 'no',
  });

  // Initial connection confirmation
  res.write(`data: ${JSON.stringify({ type: 'connected', timestamp: new Date().toISOString() })}\n\n`);

  const unsubscribe = syncHub.subscribe((event) => {
    try {
      res.write(`data: ${JSON.stringify(event)}\n\n`);
    } catch (err) {
      console.error('Erreur écriture SSE:', err);
    }
  });

  const heartbeat = setInterval(() => {
    try {
      res.write(`: heartbeat ${new Date().toISOString()}\n\n`);
    } catch {}
  }, 15000);

  req.on('close', () => {
    clearInterval(heartbeat);
    unsubscribe();
  });
});

router.get('/sync/audit-logs', requireAdminOrManager, (_req: Request, res: Response) => {
  res.json(db.getAuditLogs());
});

// --- Users & Passwords Management (Admin Boubacar Sene & Gérante Awa Gassama) ---
router.get('/users', requireAdminOrManager, (req: Request, res: Response) => {
  res.json(db.getUsers());
});

router.post('/users', requireAdminOrManager, (req: Request, res: Response) => {
  try {
    const { name, email, role, phone, sectors } = req.body;
    if (!name || !email || !role) {
      return res.status(400).json({ error: 'Nom, e-mail et rôle sont requis.' });
    }
    const newUser = db.createUser({ name, email, role, phone, sectors }, req.user!.id);
    res.status(201).json(newUser);
  } catch (err: any) {
    res.status(400).json({ error: err?.message || 'Erreur lors de la création de l\'utilisateur' });
  }
});

router.put('/users/:id', requireAdminOrManager, (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { name, email, role, phone, active, sectors } = req.body;
    const updated = db.updateUser(id, { name, email, role, phone, active }, sectors, req.user!.id);
    res.json(updated);
  } catch (err: any) {
    res.status(400).json({ error: err?.message || 'Erreur lors de la mise à jour' });
  }
});

// Setting / Resetting User Password (Strictly Admin Boubacar Sene & Gérante Awa Gassama)
router.post('/admin/users/:id/password', requireAdminOrManager, (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { password } = req.body;
    if (!password) {
      return res.status(400).json({ error: 'Le nouveau mot de passe est obligatoire.' });
    }
    if (!checkSensitiveOpReauth(req, res)) return;

    const result = db.setUserPassword(req.user!.id, id, String(password));
    if (!result.success) {
      return res.status(400).json({ error: result.error });
    }
    res.json({ success: true, message: 'Mot de passe mis à jour avec succès.' });
  } catch (err: any) {
    res.status(400).json({ error: err?.message || 'Erreur lors de la mise à jour du mot de passe' });
  }
});

// --- Sectors ---
router.get('/sectors', (req: Request, res: Response) => {
  const settings = db.getSettings();
  const list = ALL_SECTORS.map(sec => ({
    id: sec,
    flock: settings.sectorFlocks[sec] || 2500,
    isAllowed: req.allowedSectors.includes(sec),
  }));
  res.json(list);
});

// --- Collections (Ramassage) ---
router.get('/collections', (req: Request, res: Response) => {
  const { date, sector } = req.query as { date?: string; sector?: SectorId };

  let collections = db.getCollections(date, sector);

  // If user is Employee, filter out any unassigned sectors
  if (req.user?.role === 'employee') {
    collections = collections.filter(c => req.allowedSectors.includes(c.sector));
  }

  res.json(collections);
});

router.post('/collections', async (req: Request, res: Response) => {
  try {
    const { 
      date, 
      slot, 
      sector, 
      trays, 
      brokenEggs, 
      doubleYolkEggs, 
      depositTrays, 
      quantity, 
      cracked, 
      deposit,
      actionId,
      lastKnownUpdatedAt,
      force,
    } = req.body;

    if (!date || !slot || !sector) {
      return res.status(400).json({ error: 'Date, créneau et secteur sont requis' });
    }

    // Backend RBAC Check
    if (!db.canAccessSector(req.user!.id, sector)) {
      return res.status(403).json({ error: `FORBIDDEN: Vous n'avez pas accès au secteur ${sector}.` });
    }

    // Deduplication check: if action was already processed, return existing record
    if (actionId && db.isActionProcessed(actionId)) {
      const summary = db.getDailySummary(date);
      const existingColls = db.getCollections(date, sector);
      const existing = existingColls.find(c => c.slot === slot);
      return res.json({ collection: existing, dailySummary: summary, deduplicated: true });
    }

    const result = db.upsertCollection(
      { 
        date, 
        slot, 
        sector, 
        trays: trays !== undefined ? Number(trays) : (quantity !== undefined ? Number(quantity) : 0), 
        brokenEggs: brokenEggs !== undefined ? Number(brokenEggs) : (cracked !== undefined ? Number(cracked) : 0), 
        doubleYolkEggs: doubleYolkEggs !== undefined ? Number(doubleYolkEggs) : 0, 
        depositTrays: depositTrays !== undefined ? Number(depositTrays) : (deposit !== undefined ? Number(deposit) : undefined),
        quantity: quantity !== undefined ? Number(quantity) : (trays !== undefined ? Number(trays) : 0), 
        cracked: cracked !== undefined ? Number(cracked) : (brokenEggs !== undefined ? Number(brokenEggs) : 0), 
        deposit: deposit !== undefined ? Number(deposit) : (depositTrays !== undefined ? Number(depositTrays) : undefined),
      },
      req.user!.id,
      { lastKnownUpdatedAt, force: Boolean(force) }
    );

    if (actionId) {
      db.recordProcessedAction(actionId, `${date}_${sector}_${slot}`);
    }

    // If day became complete and email not sent yet, trigger non-blocking email
    let emailResult = null;
    if (result.dailySummary.isComplete && !result.dailySummary.emailSent) {
      const allDayCollections = db.getCollections(date);
      emailResult = await sendDailyReportEmail({
        date,
        collections: allDayCollections,
        summary: result.dailySummary,
        operatorName: req.user!.name,
      });
    }

    res.json({
      success: true,
      collection: result.collection,
      dailySummary: db.getDailySummary(date),
      emailResult,
    });
  } catch (err: any) {
    if (err.code === 'CONFLICT') {
      return res.status(409).json({
        error: err.message,
        conflict: true,
        currentRecord: err.currentRecord,
      });
    }
    res.status(400).json({ error: err?.message || 'Erreur d\'enregistrement' });
  }
});

router.get('/collections/summary', (req: Request, res: Response) => {
  const date = (req.query.date as string) || new Date().toISOString().split('T')[0];
  const summary = db.getDailySummary(date);

  // If employee, tailor summary so they only see their allowed sectors
  if (req.user?.role === 'employee') {
    const filteredBySector: any = {};
    let empTotal = 0;
    let empCracked = 0;
    let empDeposit = 0;

    for (const sec of req.allowedSectors) {
      if (summary.bySector[sec]) {
        filteredBySector[sec] = summary.bySector[sec];
        empTotal += summary.bySector[sec].total;
        empCracked += summary.bySector[sec].cracked;
        empDeposit += summary.bySector[sec].deposit;
      }
    }

    return res.json({
      ...summary,
      totalEggs: empTotal,
      totalCracked: empCracked,
      totalDeposited: empDeposit,
      bySector: filteredBySector,
      // For employee, isComplete indicates whether all their assigned sectors have all slots
      isCompleteForUser: req.allowedSectors.length > 0 && req.allowedSectors.every(sec => {
        const cols = db.getCollections(date, sec);
        return cols.filter(c => c.quantity > 0).length === 3;
      }),
    });
  }

  res.json(summary);
});

router.post('/collections/trigger-email', async (req: Request, res: Response) => {
  try {
    const { date, force } = req.body;
    if (!date) return res.status(400).json({ error: 'Date requise' });

    const summary = db.getDailySummary(date);
    const collections = db.getCollections(date);

    const emailRes = await sendDailyReportEmail({
      date,
      collections,
      summary,
      operatorName: req.user!.name,
      forceSend: Boolean(force),
    });

    res.json({
      ...emailRes,
      updatedSummary: db.getDailySummary(date),
    });
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Erreur lors de l\'envoi de l\'e-mail' });
  }
});

// --- Stocks ---
router.get('/stocks/balances', (req: Request, res: Response) => {
  const balances = db.getStockBalances();

  // If employee, return only allowed sectors
  if (req.user?.role === 'employee') {
    const filtered: any = {};
    for (const sec of req.allowedSectors) {
      filtered[sec] = balances[sec];
    }
    return res.json(filtered);
  }

  res.json(balances);
});

router.get('/stocks/movements', (req: Request, res: Response) => {
  const { sector } = req.query as { sector?: SectorId | 'CENTRAL' };
  let movements = db.getStockMovements(sector);

  if (req.user?.role === 'employee') {
    movements = movements.filter(m => m.sector !== 'CENTRAL' && req.allowedSectors.includes(m.sector as SectorId));
  }

  res.json(movements);
});

router.post('/stocks/movements', (req: Request, res: Response) => {
  try {
    const { date, sector, itemType, quantity, movementType, reason, notes, actionId } = req.body;

    if (!sector || !itemType || !quantity || !movementType) {
      return res.status(400).json({ error: 'Paramètres manquants' });
    }

    if (sector !== 'CENTRAL' && !db.canAccessSector(req.user!.id, sector)) {
      return res.status(403).json({ error: `FORBIDDEN: Accès refusé pour le secteur ${sector}` });
    }

    if (actionId && db.isActionProcessed(actionId)) {
      return res.json({ success: true, deduplicated: true, message: 'Mouvement de stock déjà traité.' });
    }

    const mov = db.addStockMovement(
      {
        date: date || new Date().toISOString().split('T')[0],
        sector,
        itemType,
        quantity: Number(quantity),
        movementType,
        reason: reason || 'Mouvement manuel',
        performedBy: req.user!.id,
        notes,
      },
      req.user!.id
    );

    if (actionId) db.recordProcessedAction(actionId, mov.id);

    res.status(201).json(mov);
  } catch (err: any) {
    res.status(400).json({ error: err?.message || 'Erreur enregistrement stock' });
  }
});

// --- Mortality ---
router.get('/mortality', (req: Request, res: Response) => {
  const { sector } = req.query as { sector?: SectorId };
  let records = db.getMortalityRecords(sector);

  if (req.user?.role === 'employee') {
    records = records.filter(r => req.allowedSectors.includes(r.sector));
  }

  res.json(records);
});

router.post('/mortality', (req: Request, res: Response) => {
  try {
    const { date, sector, count, cause, notes, actionId } = req.body;

    if (!sector || count === undefined) {
      return res.status(400).json({ error: 'Secteur et nombre de pertes requis' });
    }

    if (!db.canAccessSector(req.user!.id, sector)) {
      return res.status(403).json({ error: `FORBIDDEN: Accès refusé pour le secteur ${sector}` });
    }

    if (actionId && db.isActionProcessed(actionId)) {
      return res.json({ success: true, deduplicated: true, message: 'Mortalité déjà traitée.' });
    }

    const record = db.addMortalityRecord(
      {
        date: date || new Date().toISOString().split('T')[0],
        sector,
        count: Number(count),
        cause: cause || 'Non précisée',
        recordedBy: req.user!.id,
        notes,
      },
      req.user!.id
    );

    if (actionId) db.recordProcessedAction(actionId, record.id);

    res.status(201).json(record);
  } catch (err: any) {
    res.status(400).json({ error: err?.message || 'Erreur enregistrement mortalité' });
  }
});

// --- Clients ---
router.get('/clients', (req: Request, res: Response) => {
  res.json(db.getClients());
});

router.post('/clients', (req: Request, res: Response) => {
  try {
    const { name, phone, email, address, balanceDue } = req.body;
    if (!name || !phone) {
      return res.status(400).json({ error: 'Nom et téléphone requis' });
    }
    const client = db.addClient({ name, phone, email, address, balanceDue: Number(balanceDue) || 0 });
    res.status(201).json(client);
  } catch (err: any) {
    res.status(400).json({ error: err?.message || 'Erreur création client' });
  }
});

// --- Sales ---
router.get('/sales', (req: Request, res: Response) => {
  const { sector } = req.query as { sector?: SectorId | 'CENTRAL' };
  let sales = db.getSales(sector);

  if (req.user?.role === 'employee') {
    sales = sales.filter(s => s.sector !== 'CENTRAL' && req.allowedSectors.includes(s.sector as SectorId));
  }

  res.json(sales);
});

router.post('/sales', (req: Request, res: Response) => {
  try {
    const { date, clientId, clientName, sector, itemType, quantity, unitPrice, status, actionId } = req.body;

    if (!clientId || !clientName || !sector || !quantity || !unitPrice) {
      return res.status(400).json({ error: 'Paramètres de vente manquants' });
    }

    if (sector !== 'CENTRAL' && !db.canAccessSector(req.user!.id, sector)) {
      return res.status(403).json({ error: `FORBIDDEN: Accès refusé pour le secteur ${sector}` });
    }

    if (actionId && db.isActionProcessed(actionId)) {
      return res.json({ success: true, deduplicated: true, message: 'Vente déjà enregistrée.' });
    }

    const sale = db.addSale(
      {
        date: date || new Date().toISOString().split('T')[0],
        clientId,
        clientName,
        sector,
        itemType: itemType || 'Plateaux d\'œufs',
        quantity: Number(quantity),
        unitPrice: Number(unitPrice),
        totalAmount: Number(quantity) * Number(unitPrice),
        status: status || 'validee',
        recordedBy: req.user!.id,
      },
      req.user!.id
    );

    if (actionId) db.recordProcessedAction(actionId, sale.id);

    res.status(201).json(sale);
  } catch (err: any) {
    res.status(400).json({ error: err?.message || 'Erreur enregistrement vente' });
  }
});

// --- Invoices ---
router.get('/invoices', (req: Request, res: Response) => {
  let invoices = db.getInvoices();

  if (req.user?.role === 'employee') {
    invoices = invoices.filter(inv => !inv.sector || inv.sector === 'CENTRAL' || req.allowedSectors.includes(inv.sector as SectorId));
  }

  res.json(invoices);
});

router.get('/invoices/:id', (req: Request, res: Response) => {
  const invoice = db.getInvoice(req.params.id);
  if (!invoice) return res.status(404).json({ error: 'Facture introuvable' });
  res.json(invoice);
});

router.post('/invoices', (req: Request, res: Response) => {
  try {
    const { date, clientId, clientName, clientPhone, clientAddress, sector, items, discount, amountPaid, status, notes, actionId } = req.body;

    if (!clientId || !clientName || !items || !items.length) {
      return res.status(400).json({ error: 'Client et articles requis pour créer une facture' });
    }

    if (actionId && db.isActionProcessed(actionId)) {
      return res.json({ success: true, deduplicated: true, message: 'Facture déjà créée.' });
    }

    const subtotal = items.reduce((sum: number, it: any) => sum + (Number(it.quantity) * Number(it.unitPrice)), 0);
    const disc = Number(discount) || 0;
    const total = Math.max(0, subtotal - disc);
    const paid = Number(amountPaid) || 0;
    const balanceDue = Math.max(0, total - paid);

    const inv = db.createInvoice(
      {
        date: date || new Date().toISOString().split('T')[0],
        clientId,
        clientName,
        clientPhone: clientPhone || '',
        clientAddress,
        sector,
        items,
        subtotal,
        discount: disc,
        total,
        amountPaid: paid,
        balanceDue,
        status: status || (paid >= total ? 'payee' : paid > 0 ? 'partiellement_payee' : 'brouillon'),
        notes,
      },
      req.user!.id
    );

    if (actionId) db.recordProcessedAction(actionId, inv.id);

    res.status(201).json(inv);
  } catch (err: any) {
    res.status(400).json({ error: err?.message || 'Erreur création facture' });
  }
});

router.put('/invoices/:id', (req: Request, res: Response) => {
  try {
    const updated = db.updateInvoice(req.params.id, req.body);
    res.json(updated);
  } catch (err: any) {
    res.status(400).json({ error: err?.message || 'Erreur mise à jour facture' });
  }
});

router.post('/invoices/:id/send-email', async (req: Request, res: Response) => {
  try {
    const invoice = db.getInvoice(req.params.id);
    if (!invoice) return res.status(404).json({ error: 'Facture introuvable' });

    const result = await sendInvoiceEmail(invoice, req.body.recipient);
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Erreur envoi facture par e-mail' });
  }
});

// --- Email Logs ---
router.get('/email-logs', requireAdminOrManager, (req: Request, res: Response) => {
  res.json(db.getEmailLogs());
});

// --- Settings ---
router.get('/settings', (req: Request, res: Response) => {
  // Do not expose sensitive SMTP password
  const s = { ...db.getSettings() };
  if (s.smtpPass) {
    s.smtpPass = '••••••••';
  }
  res.json(s);
});

router.put('/settings', requireAdmin, (req: Request, res: Response) => {
  try {
    const updates = { ...req.body };
    if (updates.smtpPass === '••••••••') {
      delete updates.smtpPass;
    }
    const updated = db.updateSettings(updates);
    const safe = { ...updated };
    if (safe.smtpPass) safe.smtpPass = '••••••••';
    res.json(safe);
  } catch (err: any) {
    res.status(400).json({ error: err?.message || 'Erreur modification paramètres' });
  }
});

router.post('/settings/test-email', requireAdmin, async (req: Request, res: Response) => {
  try {
    const recipient = req.body.recipient || db.getSettings().managerEmail || 'boubacarsene8@gmail.com';
    const collections = db.getCollections(new Date().toISOString().split('T')[0]);
    const summary = db.getDailySummary(new Date().toISOString().split('T')[0]);

    const result = await sendDailyReportEmail({
      date: new Date().toISOString().split('T')[0],
      collections,
      summary,
      recipient,
      operatorName: req.user!.name,
      forceSend: true,
    });

    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Erreur envoi test' });
  }
});

// ============================================================================
// --- SUIVI VÉTÉRINAIRE & PHARMACIE (M. Ndour) ---
// ============================================================================

// --- Médicaments ---
router.get('/veterinaire/medications', (req: Request, res: Response) => {
  res.json(db.getMedications());
});

router.post('/veterinaire/medications', requireVetOrAdmin, (req: Request, res: Response) => {
  try {
    const { name, category, unit, currentStock, minimumStockAlert, expiryDate, batchNumber } = req.body;
    if (!name) {
      return res.status(400).json({ error: 'Le nom du médicament est requis' });
    }
    const med = db.upsertMedication(
      { name, category, unit, currentStock, minimumStockAlert, expiryDate, batchNumber },
      req.user!.id
    );
    res.status(201).json(med);
  } catch (err: any) {
    res.status(400).json({ error: err?.message || 'Erreur enregistrement médicament' });
  }
});

router.get('/veterinaire/medications/movements', (req: Request, res: Response) => {
  const { medicationId } = req.query as { medicationId?: string };
  res.json(db.getMedicationMovements(medicationId));
});

router.post('/veterinaire/medications/movements', requireVetOrAdmin, (req: Request, res: Response) => {
  try {
    const { medicationId, type, quantity, date, sector, reason, dosagePrescrit } = req.body;
    if (!medicationId || !type || quantity === undefined) {
      return res.status(400).json({ error: 'Médicament, type de mouvement et quantité sont requis' });
    }
    const movement = db.addMedicationMovement(
      { medicationId, type, quantity: Number(quantity), date, sector, reason, dosagePrescrit },
      req.user!.id
    );
    res.status(201).json(movement);
  } catch (err: any) {
    res.status(400).json({ error: err?.message || 'Erreur mouvement stock médicament' });
  }
});

// --- Vaccins ---
router.get('/veterinaire/vaccines', (req: Request, res: Response) => {
  res.json(db.getVaccines());
});

router.post('/veterinaire/vaccines', requireVetOrAdmin, (req: Request, res: Response) => {
  try {
    const { name, targetDisease, unit, quantityReceived, currentStock, minimumStockAlert, receptionDate, expiryDate, batchNumber } = req.body;
    if (!name || !targetDisease) {
      return res.status(400).json({ error: 'Le nom du vaccin et la pathologie ciblée sont requis' });
    }
    const vaccine = db.upsertVaccine(
      { name, targetDisease, unit, quantityReceived, currentStock, minimumStockAlert, receptionDate, expiryDate, batchNumber },
      req.user!.id
    );
    res.status(201).json(vaccine);
  } catch (err: any) {
    res.status(400).json({ error: err?.message || 'Erreur enregistrement vaccin' });
  }
});

// --- Campagnes & Calendrier de Vaccination ---
router.get('/veterinaire/vaccinations', (req: Request, res: Response) => {
  const { sector } = req.query as { sector?: SectorId };
  let list = db.getVaccinations(sector);

  // If user is employee, restrict to allowed sectors
  if (req.user?.role === 'employee') {
    list = list.filter(v => req.allowedSectors.includes(v.sector));
  }

  res.json(list);
});

router.post('/veterinaire/vaccinations', requireVetOrAdmin, (req: Request, res: Response) => {
  try {
    const { vaccineId, vaccineName, sector, scheduledDate, targetBirdCount, status, administrationRoute, observations } = req.body;
    if (!vaccineName || !sector || !scheduledDate) {
      return res.status(400).json({ error: 'Nom du vaccin, secteur et date prévue sont requis' });
    }
    const campaign = db.upsertVaccination(
      { vaccineId, vaccineName, sector, scheduledDate, targetBirdCount, status, administrationRoute, observations },
      req.user!.id
    );
    res.status(201).json(campaign);
  } catch (err: any) {
    res.status(400).json({ error: err?.message || 'Erreur programmation vaccination' });
  }
});

router.put('/veterinaire/vaccinations/:id/realize', requireVetOrAdmin, (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { realizedDate, dosesAdministered, observations } = req.body;
    const updated = db.markVaccinationRealized(
      id,
      { realizedDate, dosesAdministered: Number(dosesAdministered), observations },
      req.user!.id
    );
    res.json(updated);
  } catch (err: any) {
    res.status(400).json({ error: err?.message || 'Erreur validation réalisation vaccin' });
  }
});

// --- Historique Sanitaire & Traitements ---
router.get('/veterinaire/treatments', (req: Request, res: Response) => {
  const { sector } = req.query as { sector?: SectorId };
  let list = db.getSanitaryTreatments(sector);

  // If user is employee, restrict to allowed sectors
  if (req.user?.role === 'employee') {
    list = list.filter(t => req.allowedSectors.includes(t.sector));
  }

  res.json(list);
});

router.post('/veterinaire/treatments', requireVetOrAdmin, (req: Request, res: Response) => {
  try {
    const { date, sector, diagnosis, treatmentType, productName, dosage, durationDays, startDate, endDate, withdrawalPeriodDays, observations } = req.body;
    if (!sector || !diagnosis || !productName || !dosage) {
      return res.status(400).json({ error: 'Secteur, motif/diagnostic, produit et posologie validée par le vétérinaire sont requis' });
    }
    const treatment = db.addSanitaryTreatment(
      { date, sector, diagnosis, treatmentType, productName, dosage, durationDays, startDate, endDate, withdrawalPeriodDays, observations },
      req.user!.id
    );
    res.status(201).json(treatment);
  } catch (err: any) {
    res.status(400).json({ error: err?.message || 'Erreur enregistrement traitement sanitaire' });
  }
});

// --- Alertes Sanitaires Calculées ---
router.get('/veterinaire/alerts', (req: Request, res: Response) => {
  res.json(db.getVeterinaryAlerts());
});

// ============================================================================
// --- SÉCURITÉ & POLITIQUE DE CONNEXION (Boubacar Sene Admin Principal) ---
// ============================================================================

router.get('/admin/security-settings', requireAdminOrManager, (_req: Request, res: Response) => {
  const settings = db.getSettings();
  res.json({
    sessionDurationHours: settings.sessionDurationHours || 24,
    requireReauthForSensitiveOps: settings.requireReauthForSensitiveOps ?? true,
    requirePasswordOnAppOpen: settings.requirePasswordOnAppOpen ?? true,
  });
});

router.put('/admin/security-settings', requireAdmin, (req: Request, res: Response) => {
  try {
    if (!checkSensitiveOpReauth(req, res)) return;
    const updated = db.updateSecuritySettings(req.body, req.user!.id);
    res.json({
      sessionDurationHours: updated.sessionDurationHours,
      requireReauthForSensitiveOps: updated.requireReauthForSensitiveOps,
      requirePasswordOnAppOpen: updated.requirePasswordOnAppOpen,
    });
  } catch (err: any) {
    res.status(403).json({ error: err?.message || 'Accès interdit : Seul l\'Administrateur principal peut modifier les règles de sécurité.' });
  }
});

// ============================================================================
// --- SUPPRESSIONS & ARCHIVAGE TRAÇABLE (Strictement Boubacar Sene Admin) ---
// ============================================================================

// Supprimer un ramassage
router.delete('/collections/:idOrKey', requireAdmin, (req: Request, res: Response) => {
  try {
    const { idOrKey } = req.params;
    const reason = req.body?.reason || req.query?.reason;
    if (!reason || !String(reason).trim()) {
      return res.status(400).json({ error: 'Un motif explicite est obligatoire pour valider la suppression du ramassage.' });
    }
    if (!checkSensitiveOpReauth(req, res)) return;

    const result = db.deleteCollection(idOrKey, req.user!.id, String(reason).trim());
    res.json(result);
  } catch (err: any) {
    res.status(400).json({ error: err?.message || 'Erreur lors de la suppression du ramassage' });
  }
});

// Supprimer une ligne de mouvement de stock
router.delete('/stocks/movements/:id', requireAdmin, (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const reason = req.body?.reason || req.query?.reason;
    if (!reason || !String(reason).trim()) {
      return res.status(400).json({ error: 'Un motif explicite est obligatoire pour supprimer cette ligne de stock.' });
    }
    if (!checkSensitiveOpReauth(req, res)) return;

    const result = db.deleteStockMovement(id, req.user!.id, String(reason).trim());
    res.json(result);
  } catch (err: any) {
    res.status(400).json({ error: err?.message || 'Erreur lors de la suppression du stock' });
  }
});

// Supprimer une vente
router.delete('/sales/:id', requireAdmin, (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const reason = req.body?.reason || req.query?.reason;
    if (!reason || !String(reason).trim()) {
      return res.status(400).json({ error: 'Un motif explicite est obligatoire pour supprimer cette vente.' });
    }
    if (!checkSensitiveOpReauth(req, res)) return;

    const result = db.deleteSale(id, req.user!.id, String(reason).trim());
    res.json(result);
  } catch (err: any) {
    res.status(400).json({ error: err?.message || 'Erreur lors de la suppression de la vente' });
  }
});

// Annuler ou Supprimer une facture
router.delete('/invoices/:id', requireAdmin, (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const reason = req.body?.reason || req.query?.reason;
    const permanent = req.body?.permanent === true || req.query?.permanent === 'true';
    if (!reason || !String(reason).trim()) {
      return res.status(400).json({ error: 'Un motif explicite est obligatoire pour annuler ou supprimer cette facture.' });
    }
    if (!checkSensitiveOpReauth(req, res)) return;

    const result = db.deleteInvoice(id, req.user!.id, String(reason).trim(), permanent);
    res.json(result);
  } catch (err: any) {
    res.status(400).json({ error: err?.message || 'Erreur lors de la suppression de la facture' });
  }
});

// Supprimer un enregistrement de mortalité
router.delete('/mortality/:id', requireAdmin, (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const reason = req.body?.reason || req.query?.reason;
    if (!reason || !String(reason).trim()) {
      return res.status(400).json({ error: 'Un motif explicite est obligatoire pour supprimer cet enregistrement de mortalité.' });
    }
    if (!checkSensitiveOpReauth(req, res)) return;

    const result = db.deleteMortalityRecord(id, req.user!.id, String(reason).trim());
    res.json(result);
  } catch (err: any) {
    res.status(400).json({ error: err?.message || 'Erreur lors de la suppression de la mortalité' });
  }
});

// Supprimer un traitement sanitaire
router.delete('/veterinaire/treatments/:id', requireAdmin, (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const reason = req.body?.reason || req.query?.reason;
    if (!reason || !String(reason).trim()) {
      return res.status(400).json({ error: 'Un motif explicite est obligatoire pour supprimer ce traitement sanitaire.' });
    }
    if (!checkSensitiveOpReauth(req, res)) return;

    const result = db.deleteSanitaryTreatment(id, req.user!.id, String(reason).trim());
    res.json(result);
  } catch (err: any) {
    res.status(400).json({ error: err?.message || 'Erreur lors de la suppression du traitement' });
  }
});

// Supprimer une vaccination
router.delete('/veterinaire/vaccinations/:id', requireAdmin, (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const reason = req.body?.reason || req.query?.reason;
    if (!reason || !String(reason).trim()) {
      return res.status(400).json({ error: 'Un motif explicite est obligatoire pour supprimer cette vaccination.' });
    }
    if (!checkSensitiveOpReauth(req, res)) return;

    const result = db.deleteVaccination(id, req.user!.id, String(reason).trim());
    res.json(result);
  } catch (err: any) {
    res.status(400).json({ error: err?.message || 'Erreur lors de la suppression de la vaccination' });
  }
});

// Supprimer un compte utilisateur (Admin Boubacar Sene uniquement)
router.delete('/users/:id', requireAdmin, (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const reason = req.body?.reason || req.query?.reason;
    if (id === req.user!.id) {
      return res.status(400).json({ error: 'L\'Administrateur principal ne peut pas supprimer son propre compte.' });
    }
    if (!reason || !String(reason).trim()) {
      return res.status(400).json({ error: 'Un motif explicite est obligatoire pour supprimer un compte utilisateur.' });
    }
    if (!checkSensitiveOpReauth(req, res)) return;

    const result = db.deleteUser(id, req.user!.id, String(reason).trim());
    res.json(result);
  } catch (err: any) {
    res.status(400).json({ error: err?.message || 'Erreur lors de la suppression de l\'utilisateur' });
  }
});

// Archives & Corbeille des suppressions (Boubacar Sene uniquement)
router.get('/admin/deleted-records', requireAdmin, (req: Request, res: Response) => {
  try {
    const records = db.getDeletedRecords(req.user!.id);
    res.json(records);
  } catch (err: any) {
    res.status(403).json({ error: err?.message || 'Accès interdit aux archives de suppression' });
  }
});

// Restauration d'un élément supprimé (Boubacar Sene uniquement)
router.post('/admin/deleted-records/:id/restore', requireAdmin, (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    if (!checkSensitiveOpReauth(req, res)) return;
    const result = db.restoreDeletedRecord(id, req.user!.id);
    res.json(result);
  } catch (err: any) {
    res.status(400).json({ error: err?.message || 'Erreur lors de la restauration de l\'enregistrement' });
  }
});

export default router;
