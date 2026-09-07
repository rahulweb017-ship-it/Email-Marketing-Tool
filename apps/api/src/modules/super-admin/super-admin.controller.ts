import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import { authenticate, requireSuperAdmin } from '../auth/auth.middleware.js';
import * as superAdminService from './super-admin.service.js';
import * as authService from '../auth/auth.service.js';
import {
  createTenantSchema,
  updateTenantSchema,
  updateTenantStatusSchema,
  createPlanSchema,
  updatePlanSchema,
  resetUserPasswordSchema,
  updateUserStatusSchema,
} from './super-admin.schema.js';
import { parsePagination, paginatedResponse } from '../../shared/utils/pagination.js';

export const superAdminRouter = Router();

// All routes require super admin auth
superAdminRouter.use(authenticate, requireSuperAdmin);

// ============================================================
// DASHBOARD
// ============================================================
superAdminRouter.get('/dashboard', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const stats = await superAdminService.getDashboardStats();
    res.json(stats);
  } catch (err) {
    next(err);
  }
});

// ============================================================
// TENANT MANAGEMENT
// ============================================================
superAdminRouter.get('/tenants', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const pagination = parsePagination(req);
    const filters = {
      status: req.query.status as string | undefined,
      plan_id: req.query.plan_id as string | undefined,
      search: req.query.search as string | undefined,
    };
    const { data, total } = await superAdminService.listTenants(pagination, filters);
    res.json(paginatedResponse(data, total, pagination));
  } catch (err) {
    next(err);
  }
});

superAdminRouter.get('/tenants/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenant = await superAdminService.getTenant(req.params.id);
    res.json(tenant);
  } catch (err) {
    next(err);
  }
});

superAdminRouter.post('/tenants', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const input = createTenantSchema.parse(req.body);
    const result = await superAdminService.createTenant(input);

    await superAdminService.logAudit(
      req.user!.id, 'tenant.created', result.id,
      { org_name: input.org_name, admin_email: input.admin_email },
      req.ip,
    );

    res.status(201).json(result);
  } catch (err) {
    next(err);
  }
});

superAdminRouter.patch('/tenants/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const input = updateTenantSchema.parse(req.body);
    const result = await superAdminService.updateTenant(req.params.id, input);

    await superAdminService.logAudit(
      req.user!.id, 'tenant.updated', req.params.id,
      { changes: input },
      req.ip,
    );

    res.json(result);
  } catch (err) {
    next(err);
  }
});

superAdminRouter.patch('/tenants/:id/status', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const input = updateTenantStatusSchema.parse(req.body);
    const result = await superAdminService.updateTenantStatus(req.params.id, input);

    await superAdminService.logAudit(
      req.user!.id, `tenant.${input.status}`, req.params.id,
      { status: input.status, reason: input.reason },
      req.ip,
    );

    res.json(result);
  } catch (err) {
    next(err);
  }
});

superAdminRouter.get('/tenants/:id/users', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const users = await superAdminService.listTenantUsers(req.params.id);
    res.json({ data: users });
  } catch (err) {
    next(err);
  }
});

superAdminRouter.get('/tenants/:id/usage', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const usage = await superAdminService.getTenantUsageHistory(req.params.id);
    res.json({ data: usage });
  } catch (err) {
    next(err);
  }
});

// ============================================================
// TENANT USER MANAGEMENT
// ============================================================
superAdminRouter.post('/tenants/:id/users/:userId/reset-password', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const input = resetUserPasswordSchema.parse(req.body);
    const result = await superAdminService.resetTenantUserPassword(req.params.id, req.params.userId, input);

    await superAdminService.logAudit(
      req.user!.id, 'user.password_reset', req.params.id,
      { target_user_id: req.params.userId },
      req.ip,
    );

    res.json(result);
  } catch (err) {
    next(err);
  }
});

superAdminRouter.patch('/tenants/:id/users/:userId/status', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const input = updateUserStatusSchema.parse(req.body);
    const result = await superAdminService.updateTenantUserStatus(req.params.id, req.params.userId, input);

    await superAdminService.logAudit(
      req.user!.id, input.is_active ? 'user.activated' : 'user.deactivated', req.params.id,
      { target_user_id: req.params.userId },
      req.ip,
    );

    res.json(result);
  } catch (err) {
    next(err);
  }
});

// ============================================================
// TENANT DELETION
// ============================================================
superAdminRouter.delete('/tenants/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    await superAdminService.deleteTenant(req.params.id);

    await superAdminService.logAudit(
      req.user!.id, 'tenant.deleted', null,
      { deleted_org_id: req.params.id },
      req.ip,
    );

    res.json({ message: 'Tenant deleted' });
  } catch (err) {
    next(err);
  }
});

// ============================================================
// IMPERSONATION
// ============================================================
superAdminRouter.post('/tenants/:id/impersonate', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await authService.impersonate(req.user!.id, req.params.id);

    await superAdminService.logAudit(
      req.user!.id, 'tenant.impersonated', req.params.id,
      { target_user_id: result.user.id, target_email: result.user.email },
      req.ip,
    );

    res.json(result);
  } catch (err) {
    next(err);
  }
});

// ============================================================
// PLAN MANAGEMENT
// ============================================================
superAdminRouter.get('/plans', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const plans = await superAdminService.listPlans();
    res.json({ data: plans });
  } catch (err) {
    next(err);
  }
});

superAdminRouter.post('/plans', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const input = createPlanSchema.parse(req.body);
    const plan = await superAdminService.createPlan(input);

    await superAdminService.logAudit(
      req.user!.id, 'plan.created', null,
      { plan_name: input.name },
      req.ip,
    );

    res.status(201).json(plan);
  } catch (err) {
    next(err);
  }
});

superAdminRouter.patch('/plans/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const input = updatePlanSchema.parse(req.body);
    const plan = await superAdminService.updatePlan(req.params.id, input);

    await superAdminService.logAudit(
      req.user!.id, 'plan.updated', null,
      { plan_id: req.params.id, changes: input },
      req.ip,
    );

    res.json(plan);
  } catch (err) {
    next(err);
  }
});

superAdminRouter.delete('/plans/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    await superAdminService.deletePlan(req.params.id);

    await superAdminService.logAudit(
      req.user!.id, 'plan.deleted', null,
      { plan_id: req.params.id },
      req.ip,
    );

    res.json({ message: 'Plan deleted' });
  } catch (err) {
    next(err);
  }
});

// ============================================================
// AUDIT LOGS
// ============================================================
superAdminRouter.get('/audit-logs', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const pagination = parsePagination(req);
    const { data, total } = await superAdminService.listAuditLogs(pagination);
    res.json(paginatedResponse(data, total, pagination));
  } catch (err) {
    next(err);
  }
});
