import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Brackets, In, QueryFailedError, Repository } from 'typeorm';
import { ChargeItem } from '../../database/entities/charge-item.entity';
import { AthleteCharge } from '../../database/entities/athlete-charge.entity';
import { Athlete } from '../../database/entities/athlete.entity';
import { Payment } from '../../database/entities/payment.entity';
import { PaymentAllocation } from '../../database/entities/payment-allocation.entity';
import { AthleteChargeStatus } from '../../database/enums';
import { CreateChargeItemDto } from './dto/create-charge-item.dto';
import { UpdateChargeItemDto } from './dto/update-charge-item.dto';
import { ListChargeItemsQueryDto } from './dto/list-charge-items-query.dto';
import { CreateAthleteChargeDto } from './dto/create-athlete-charge.dto';
import { UpdateAthleteChargeDto } from './dto/update-athlete-charge.dto';
import { ListAthleteChargesQueryDto } from './dto/list-athlete-charges-query.dto';
import { CreateBulkAthleteChargesDto } from './dto/create-bulk-athlete-charges.dto';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { ListPaymentsQueryDto } from './dto/list-payments-query.dto';
import { ListAthleteFinanceSummaryQueryDto } from './dto/list-athlete-finance-summary-query.dto';

@Injectable()
export class FinanceService {
  constructor(
    @InjectRepository(ChargeItem)
    private readonly chargeItems: Repository<ChargeItem>,
    @InjectRepository(AthleteCharge)
    private readonly athleteCharges: Repository<AthleteCharge>,
    @InjectRepository(Athlete)
    private readonly athletes: Repository<Athlete>,
    @InjectRepository(Payment)
    private readonly payments: Repository<Payment>,
    @InjectRepository(PaymentAllocation)
    private readonly paymentAllocations: Repository<PaymentAllocation>,
  ) {}

  private getChargeRemaining(amount: string | number, allocatedAmount: number): number {
    return Math.max(Number(amount) - allocatedAmount, 0);
  }

  private deriveChargeStatus(charge: AthleteCharge, allocatedAmount: number): AthleteChargeStatus {
    if (charge.status === AthleteChargeStatus.CANCELLED) {
      return AthleteChargeStatus.CANCELLED;
    }

    if (allocatedAmount <= 0) {
      return AthleteChargeStatus.PENDING;
    }

    if (allocatedAmount >= Number(charge.amount)) {
      return AthleteChargeStatus.PAID;
    }

    return AthleteChargeStatus.PARTIALLY_PAID;
  }

  private async syncChargeStatus(charge: AthleteCharge): Promise<AthleteCharge> {
    if (charge.status === AthleteChargeStatus.CANCELLED) {
      return this.athleteCharges.save(charge);
    }

    const allocationSum = await this.paymentAllocations
      .createQueryBuilder('allocation')
      .select('COALESCE(SUM(allocation.amount), 0)', 'total')
      .where('allocation.tenantId = :tenantId', { tenantId: charge.tenantId })
      .andWhere('allocation.athleteChargeId = :athleteChargeId', { athleteChargeId: charge.id })
      .getRawOne<{ total: string }>();

    charge.status = this.deriveChargeStatus(charge, Number(allocationSum?.total ?? 0));
    return this.athleteCharges.save(charge);
  }

  private async syncChargeStatuses(chargeIds: string[]): Promise<void> {
    const uniqueIds = Array.from(new Set(chargeIds));
    if (uniqueIds.length === 0) return;
    const charges = await this.athleteCharges.find({ where: { id: In(uniqueIds) } });
    for (const charge of charges) {
      await this.syncChargeStatus(charge);
    }
  }

  private async buildChargeSummaries(tenantId: string, charges: AthleteCharge[]) {
    const chargeIds = charges.map((charge) => charge.id);
    const allocationMap = new Map<string, number>();

    if (chargeIds.length > 0) {
      const allocations = await this.paymentAllocations
        .createQueryBuilder('allocation')
        .select('allocation.athleteChargeId', 'athleteChargeId')
        .addSelect('COALESCE(SUM(allocation.amount), 0)', 'allocatedAmount')
        .where('allocation.tenantId = :tenantId', { tenantId })
        .andWhere('allocation.athleteChargeId IN (:...chargeIds)', { chargeIds })
        .groupBy('allocation.athleteChargeId')
        .getRawMany<{ athleteChargeId: string; allocatedAmount: string }>();

      for (const row of allocations) {
        allocationMap.set(row.athleteChargeId, Number(row.allocatedAmount));
      }
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    return charges.map((charge) => {
      const allocatedAmount = allocationMap.get(charge.id) ?? 0;
      const remainingAmount = this.getChargeRemaining(charge.amount, allocatedAmount);
      const derivedStatus = this.deriveChargeStatus(charge, allocatedAmount);
      const dueDate = charge.dueDate ? new Date(charge.dueDate) : null;
      const isOverdue =
        derivedStatus !== AthleteChargeStatus.PAID &&
        derivedStatus !== AthleteChargeStatus.CANCELLED &&
        dueDate !== null &&
        dueDate < today;

      return {
        ...charge,
        allocatedAmount: allocatedAmount.toFixed(2),
        remainingAmount: remainingAmount.toFixed(2),
        derivedStatus,
        isOverdue,
      };
    });
  }

  private async getAthleteOrFail(tenantId: string, athleteId: string): Promise<Athlete> {
    const athlete = await this.athletes.findOne({ where: { id: athleteId, tenantId } });
    if (!athlete) throw new BadRequestException('Athlete not found');
    return athlete;
  }

  async createChargeItem(tenantId: string, dto: CreateChargeItemDto): Promise<ChargeItem> {
    const row = this.chargeItems.create({
      tenantId,
      name: dto.name,
      category: dto.category,
      defaultAmount: dto.defaultAmount.toFixed(2),
      currency: dto.currency.toUpperCase(),
      isActive: dto.isActive ?? true,
    });
    return this.chargeItems.save(row);
  }

  async listChargeItems(tenantId: string, query: ListChargeItemsQueryDto) {
    const limit = query.limit ?? 50;
    const offset = query.offset ?? 0;
    const qb = this.chargeItems.createQueryBuilder('c').where('c.tenantId = :tenantId', { tenantId });
    if (query.isActive !== undefined) {
      qb.andWhere('c.isActive = :isActive', { isActive: query.isActive });
    }
    if (query.q?.trim()) {
      const term = `%${query.q.trim().toLowerCase()}%`;
      qb.andWhere(
        new Brackets((w) => {
          w.where('LOWER(c.name) LIKE :term', { term }).orWhere('LOWER(c.category) LIKE :term', { term });
        }),
      );
    }
    const total = await qb.clone().getCount();
    const items = await qb.orderBy('c.name', 'ASC').skip(offset).take(limit).getMany();
    return { items, total };
  }

  async getChargeItem(tenantId: string, id: string): Promise<ChargeItem> {
    const c = await this.chargeItems.findOne({ where: { id, tenantId } });
    if (!c) throw new NotFoundException('Charge item not found');
    return c;
  }

  async updateChargeItem(tenantId: string, id: string, dto: UpdateChargeItemDto): Promise<ChargeItem> {
    const c = await this.getChargeItem(tenantId, id);
    if (dto.defaultAmount !== undefined) c.defaultAmount = dto.defaultAmount.toFixed(2);
    if (dto.currency !== undefined) c.currency = dto.currency.toUpperCase();
    if (dto.name !== undefined) c.name = dto.name;
    if (dto.category !== undefined) c.category = dto.category;
    if (dto.isActive !== undefined) c.isActive = dto.isActive;
    return this.chargeItems.save(c);
  }

  async removeChargeItem(tenantId: string, id: string): Promise<void> {
    try {
      const res = await this.chargeItems.delete({ id, tenantId });
      if (!res.affected) throw new NotFoundException('Charge item not found');
    } catch (error) {
      const maybeCode =
        error instanceof QueryFailedError
          ? (error as QueryFailedError & { driverError?: { code?: string } }).driverError?.code
          : undefined;
      if (maybeCode === '23503') {
        throw new BadRequestException('Charge item cannot be deleted while athlete charges still use it');
      }
      throw error;
    }
  }

  async createAthleteCharge(tenantId: string, dto: CreateAthleteChargeDto): Promise<AthleteCharge> {
    await this.getAthleteOrFail(tenantId, dto.athleteId);
    const item = await this.chargeItems.findOne({ where: { id: dto.chargeItemId, tenantId } });
    if (!item) throw new BadRequestException('Charge item not found');

    const row = this.athleteCharges.create({
      tenantId,
      athleteId: dto.athleteId,
      chargeItemId: dto.chargeItemId,
      amount: dto.amount.toFixed(2),
      dueDate: dto.dueDate ? new Date(dto.dueDate) : null,
      status: dto.status === AthleteChargeStatus.CANCELLED ? AthleteChargeStatus.CANCELLED : AthleteChargeStatus.PENDING,
      notes: dto.notes ?? null,
    });
    return this.syncChargeStatus(await this.athleteCharges.save(row));
  }

  async listAthleteCharges(tenantId: string, query: ListAthleteChargesQueryDto) {
    const limit = query.limit ?? 50;
    const offset = query.offset ?? 0;
    const qb = this.athleteCharges
      .createQueryBuilder('ac')
      .leftJoinAndSelect('ac.chargeItem', 'chargeItem')
      .leftJoinAndSelect('ac.athlete', 'athlete')
      .where('ac.tenantId = :tenantId', { tenantId });
    if (query.athleteId) qb.andWhere('ac.athleteId = :athleteId', { athleteId: query.athleteId });
    if (query.q?.trim()) {
      const term = `%${query.q.trim().toLowerCase()}%`;
      qb.andWhere(
        new Brackets((w) => {
          w.where('LOWER(chargeItem.name) LIKE :term', { term })
            .orWhere('LOWER(chargeItem.category) LIKE :term', { term })
            .orWhere('LOWER(athlete.firstName) LIKE :term', { term })
            .orWhere('LOWER(athlete.lastName) LIKE :term', { term })
            .orWhere("LOWER(CONCAT(athlete.firstName, ' ', athlete.lastName)) LIKE :term", { term })
            .orWhere("LOWER(CONCAT(athlete.lastName, ' ', athlete.firstName)) LIKE :term", { term });
        }),
      );
    }
    const total = await qb.clone().getCount();
    const items = query.status
      ? await qb.orderBy('ac.createdAt', 'DESC').getMany()
      : await qb.orderBy('ac.createdAt', 'DESC').skip(offset).take(limit).getMany();
    const summaries = await this.buildChargeSummaries(tenantId, items);
    const filtered = query.status ? summaries.filter((item) => item.derivedStatus === query.status) : summaries;
    return {
      items: query.status ? filtered.slice(offset, offset + limit) : filtered,
      total: query.status ? filtered.length : total,
    };
  }

  async getAthleteCharge(tenantId: string, id: string): Promise<AthleteCharge> {
    const row = await this.athleteCharges.findOne({
      where: { id, tenantId },
      relations: ['chargeItem', 'athlete'],
    });
    if (!row) throw new NotFoundException('Athlete charge not found');
    await this.syncChargeStatus(row);
    const [summary] = await this.buildChargeSummaries(tenantId, [row]);
    return summary as AthleteCharge;
  }

  async createBulkAthleteCharges(tenantId: string, dto: CreateBulkAthleteChargesDto): Promise<AthleteCharge[]> {
    const athleteIds = Array.from(new Set(dto.athleteIds));
    const athletes = await this.athletes.find({ where: athleteIds.map((id) => ({ id, tenantId })) });
    if (athletes.length !== athleteIds.length) {
      throw new BadRequestException('One or more athletes were not found for this tenant');
    }

    const item = await this.chargeItems.findOne({ where: { id: dto.chargeItemId, tenantId } });
    if (!item) throw new BadRequestException('Charge item not found');

    const amount = dto.amount ?? Number(item.defaultAmount);
    const rows = athleteIds.map((athleteId) =>
      this.athleteCharges.create({
        tenantId,
        athleteId,
        chargeItemId: dto.chargeItemId,
        amount: amount.toFixed(2),
        dueDate: dto.dueDate ? new Date(dto.dueDate) : null,
        status: dto.status === AthleteChargeStatus.CANCELLED ? AthleteChargeStatus.CANCELLED : AthleteChargeStatus.PENDING,
        notes: dto.notes ?? null,
      }),
    );
    const saved = await this.athleteCharges.save(rows);
    await this.syncChargeStatuses(saved.map((row) => row.id));
    return saved;
  }

  async updateAthleteCharge(tenantId: string, id: string, dto: UpdateAthleteChargeDto): Promise<AthleteCharge> {
    const row = await this.getAthleteCharge(tenantId, id);
    if (dto.athleteId !== undefined && dto.athleteId !== row.athleteId) {
      await this.getAthleteOrFail(tenantId, dto.athleteId);
      row.athleteId = dto.athleteId;
    }
    if (dto.chargeItemId !== undefined && dto.chargeItemId !== row.chargeItemId) {
      const item = await this.chargeItems.findOne({ where: { id: dto.chargeItemId, tenantId } });
      if (!item) throw new BadRequestException('Charge item not found');
      row.chargeItemId = dto.chargeItemId;
    }
    if (dto.amount !== undefined) row.amount = dto.amount.toFixed(2);
    if (dto.dueDate !== undefined) row.dueDate = dto.dueDate ? new Date(dto.dueDate) : null;
    if (dto.status !== undefined) {
      if (dto.status === AthleteChargeStatus.CANCELLED) {
        row.status = AthleteChargeStatus.CANCELLED;
      } else {
        row.status = AthleteChargeStatus.PENDING;
      }
    }
    if (dto.notes !== undefined) row.notes = dto.notes ?? null;
    return this.syncChargeStatus(await this.athleteCharges.save(row));
  }

  async removeAthleteCharge(tenantId: string, id: string): Promise<void> {
    const res = await this.athleteCharges.delete({ id, tenantId });
    if (!res.affected) throw new NotFoundException('Athlete charge not found');
  }

  async createPayment(tenantId: string, dto: CreatePaymentDto) {
    const athlete = await this.getAthleteOrFail(tenantId, dto.athleteId);
    const totalAllocated = dto.allocations.reduce((sum, allocation) => sum + allocation.amount, 0);
    if (Number(totalAllocated.toFixed(2)) !== Number(dto.amount.toFixed(2))) {
      throw new BadRequestException('Payment amount must equal the sum of allocations');
    }

    const chargeIds = Array.from(new Set(dto.allocations.map((allocation) => allocation.athleteChargeId)));
    const charges = await this.athleteCharges.find({
      where: chargeIds.map((chargeId) => ({ id: chargeId, tenantId })),
      relations: ['chargeItem', 'athlete'],
    });
    if (charges.length !== chargeIds.length) {
      throw new BadRequestException('One or more athlete charges were not found');
    }

    for (const charge of charges) {
      if (charge.athleteId !== athlete.id) {
        throw new BadRequestException('Payments can only be allocated to charges for the selected athlete');
      }
      if (charge.status === AthleteChargeStatus.CANCELLED) {
        throw new BadRequestException('Cancelled charges cannot receive payments');
      }
      if (charge.chargeItem?.currency && charge.chargeItem.currency !== dto.currency.toUpperCase()) {
        throw new BadRequestException('Payment currency must match each charge currency');
      }
    }

    const summaries = await this.buildChargeSummaries(tenantId, charges);
    const summaryMap = new Map(summaries.map((charge) => [charge.id, charge]));
    for (const allocation of dto.allocations) {
      const charge = summaryMap.get(allocation.athleteChargeId);
      if (!charge) continue;
      if (allocation.amount > Number(charge.remainingAmount)) {
        throw new BadRequestException('Allocation amount cannot exceed remaining balance on a charge');
      }
    }

    return this.payments.manager.transaction(async (manager) => {
      const paymentRepo = manager.getRepository(Payment);
      const allocationRepo = manager.getRepository(PaymentAllocation);
      const chargeRepo = manager.getRepository(AthleteCharge);

      const payment = await paymentRepo.save(
        paymentRepo.create({
          tenantId,
          athleteId: athlete.id,
          amount: dto.amount.toFixed(2),
          currency: dto.currency.toUpperCase(),
          paidAt: new Date(dto.paidAt),
          method: dto.method ?? null,
          reference: dto.reference ?? null,
          notes: dto.notes ?? null,
        }),
      );

      await allocationRepo.save(
        dto.allocations.map((allocation) =>
          allocationRepo.create({
            tenantId,
            paymentId: payment.id,
            athleteChargeId: allocation.athleteChargeId,
            amount: allocation.amount.toFixed(2),
          }),
        ),
      );

      const touchedCharges = await chargeRepo.find({ where: chargeIds.map((chargeId) => ({ id: chargeId, tenantId })) });
      for (const charge of touchedCharges) {
        const allocationSum = await allocationRepo
          .createQueryBuilder('allocation')
          .select('COALESCE(SUM(allocation.amount), 0)', 'total')
          .where('allocation.tenantId = :tenantId', { tenantId })
          .andWhere('allocation.athleteChargeId = :athleteChargeId', { athleteChargeId: charge.id })
          .getRawOne<{ total: string }>();
        charge.status = this.deriveChargeStatus(charge, Number(allocationSum?.total ?? 0));
        await chargeRepo.save(charge);
      }

      return paymentRepo.findOneOrFail({
        where: { id: payment.id, tenantId },
        relations: ['athlete'],
      });
    });
  }

  async listPayments(tenantId: string, query: ListPaymentsQueryDto) {
    const limit = query.limit ?? 50;
    const offset = query.offset ?? 0;
    const qb = this.payments
      .createQueryBuilder('payment')
      .leftJoinAndSelect('payment.athlete', 'athlete')
      .where('payment.tenantId = :tenantId', { tenantId });

    if (query.athleteId) {
      qb.andWhere('payment.athleteId = :athleteId', { athleteId: query.athleteId });
    }

    const total = await qb.clone().getCount();
    const items = await qb.orderBy('payment.paidAt', 'DESC').skip(offset).take(limit).getMany();
    return { items, total };
  }

  async listAthleteFinanceSummaries(tenantId: string, query: ListAthleteFinanceSummaryQueryDto) {
    const chargeQuery = this.athleteCharges
      .createQueryBuilder('ac')
      .leftJoinAndSelect('ac.chargeItem', 'chargeItem')
      .leftJoinAndSelect('ac.athlete', 'athlete')
      .where('ac.tenantId = :tenantId', { tenantId });

    if (query.athleteId) {
      chargeQuery.andWhere('ac.athleteId = :athleteId', { athleteId: query.athleteId });
    }

    const charges = await chargeQuery.orderBy('ac.dueDate', 'ASC').addOrderBy('ac.createdAt', 'DESC').getMany();
    const chargeSummaries = await this.buildChargeSummaries(tenantId, charges);

    const paymentQuery = this.payments
      .createQueryBuilder('payment')
      .leftJoinAndSelect('payment.athlete', 'athlete')
      .where('payment.tenantId = :tenantId', { tenantId });

    if (query.athleteId) {
      paymentQuery.andWhere('payment.athleteId = :athleteId', { athleteId: query.athleteId });
    }

    const payments = await paymentQuery.orderBy('payment.paidAt', 'DESC').take(20).getMany();

    const totals = chargeSummaries.reduce(
      (acc, charge) => {
        if (charge.derivedStatus !== AthleteChargeStatus.CANCELLED) {
          acc.totalCharged += Number(charge.amount);
          acc.totalCollected += Number(charge.allocatedAmount);
          acc.totalOutstanding += Number(charge.remainingAmount);
          if (charge.isOverdue) {
            acc.totalOverdue += Number(charge.remainingAmount);
          }
        }
        return acc;
      },
      {
        totalCharged: 0,
        totalCollected: 0,
        totalOutstanding: 0,
        totalOverdue: 0,
      },
    );

    const athleteMap = new Map<
      string,
      {
        athlete: Athlete;
        totalCharged: number;
        totalCollected: number;
        totalOutstanding: number;
        totalOverdue: number;
        unpaidCount: number;
        partialCount: number;
        overdueCount: number;
      }
    >();

    for (const charge of chargeSummaries) {
      if (!charge.athlete) continue;
      const current =
        athleteMap.get(charge.athlete.id) ??
        {
          athlete: charge.athlete,
          totalCharged: 0,
          totalCollected: 0,
          totalOutstanding: 0,
          totalOverdue: 0,
          unpaidCount: 0,
          partialCount: 0,
          overdueCount: 0,
        };

      if (charge.derivedStatus !== AthleteChargeStatus.CANCELLED) {
        current.totalCharged += Number(charge.amount);
        current.totalCollected += Number(charge.allocatedAmount);
        current.totalOutstanding += Number(charge.remainingAmount);
        if (charge.derivedStatus === AthleteChargeStatus.PENDING) current.unpaidCount += 1;
        if (charge.derivedStatus === AthleteChargeStatus.PARTIALLY_PAID) current.partialCount += 1;
        if (charge.isOverdue) {
          current.overdueCount += 1;
          current.totalOverdue += Number(charge.remainingAmount);
        }
      }

      athleteMap.set(charge.athlete.id, current);
    }

    return {
      totals: {
        totalCharged: totals.totalCharged.toFixed(2),
        totalCollected: totals.totalCollected.toFixed(2),
        totalOutstanding: totals.totalOutstanding.toFixed(2),
        totalOverdue: totals.totalOverdue.toFixed(2),
      },
      charges: chargeSummaries,
      recentPayments: payments,
      athletes: Array.from(athleteMap.values()).sort((a, b) => b.totalOutstanding - a.totalOutstanding),
    };
  }

  async getDashboardSummary(tenantId: string) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayIso = today.toISOString();

    const [athletes, attendanceRows, financeSummary] = await Promise.all([
      this.athletes.count({ where: { tenantId } }),
      this.payments.manager.query(
        `SELECT status, COUNT(*)::int AS count
         FROM attendances
         WHERE "tenantId" = $1
         GROUP BY status`,
        [tenantId],
      ),
      this.listAthleteFinanceSummaries(tenantId, {}),
    ]);

    const sessionsAgg = await this.payments.manager.query(
      `SELECT
          COUNT(*)::int AS total,
          COUNT(*) FILTER (WHERE "scheduledStart" >= $2)::int AS upcoming,
          COUNT(*) FILTER (WHERE status = 'cancelled')::int AS cancelled
       FROM training_sessions
       WHERE "tenantId" = $1`,
      [tenantId, todayIso],
    );

    const groupDistribution = await this.payments.manager.query(
      `SELECT g.name, COUNT(a.id)::int AS count
       FROM athletes a
       LEFT JOIN club_groups g ON g.id = a."primaryGroupId"
       WHERE a."tenantId" = $1
       GROUP BY g.name
       ORDER BY count DESC, g.name ASC
       LIMIT 5`,
      [tenantId],
    );

    const upcomingByGroup = await this.payments.manager.query(
      `SELECT g.name, COUNT(s.id)::int AS count
       FROM training_sessions s
       INNER JOIN club_groups g ON g.id = s."groupId"
       WHERE s."tenantId" = $1 AND s."scheduledStart" >= $2
       GROUP BY g.name
       ORDER BY count DESC, g.name ASC
       LIMIT 5`,
      [tenantId, todayIso],
    );

    return {
      stats: {
        athletes,
        upcomingSessions: Number(sessionsAgg[0]?.upcoming ?? 0),
        totalSessions: Number(sessionsAgg[0]?.total ?? 0),
        cancelledSessions: Number(sessionsAgg[0]?.cancelled ?? 0),
        outstandingTotal: financeSummary.totals.totalOutstanding,
        overdueTotal: financeSummary.totals.totalOverdue,
        collectedTotal: financeSummary.totals.totalCollected,
      },
      attendance: attendanceRows.reduce<Record<string, number>>((acc, row: { status: string; count: number }) => {
        acc[row.status] = Number(row.count);
        return acc;
      }, {}),
      groupDistribution,
      upcomingByGroup,
      recentPayments: financeSummary.recentPayments.slice(0, 5),
      topOutstandingAthletes: financeSummary.athletes.slice(0, 5),
    };
  }
}
