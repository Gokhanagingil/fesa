import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Brackets, Repository } from 'typeorm';
import { ChargeItem } from '../../database/entities/charge-item.entity';
import { AthleteCharge } from '../../database/entities/athlete-charge.entity';
import { Athlete } from '../../database/entities/athlete.entity';
import { AthleteChargeStatus } from '../../database/enums';
import { CreateChargeItemDto } from './dto/create-charge-item.dto';
import { UpdateChargeItemDto } from './dto/update-charge-item.dto';
import { ListChargeItemsQueryDto } from './dto/list-charge-items-query.dto';
import { CreateAthleteChargeDto } from './dto/create-athlete-charge.dto';
import { UpdateAthleteChargeDto } from './dto/update-athlete-charge.dto';
import { ListAthleteChargesQueryDto } from './dto/list-athlete-charges-query.dto';

@Injectable()
export class FinanceService {
  constructor(
    @InjectRepository(ChargeItem)
    private readonly chargeItems: Repository<ChargeItem>,
    @InjectRepository(AthleteCharge)
    private readonly athleteCharges: Repository<AthleteCharge>,
    @InjectRepository(Athlete)
    private readonly athletes: Repository<Athlete>,
  ) {}

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
    const res = await this.chargeItems.delete({ id, tenantId });
    if (!res.affected) throw new NotFoundException('Charge item not found');
  }

  async createAthleteCharge(tenantId: string, dto: CreateAthleteChargeDto): Promise<AthleteCharge> {
    const athlete = await this.athletes.findOne({ where: { id: dto.athleteId, tenantId } });
    if (!athlete) throw new BadRequestException('Athlete not found');
    const item = await this.chargeItems.findOne({ where: { id: dto.chargeItemId, tenantId } });
    if (!item) throw new BadRequestException('Charge item not found');

    const row = this.athleteCharges.create({
      tenantId,
      athleteId: dto.athleteId,
      chargeItemId: dto.chargeItemId,
      amount: dto.amount.toFixed(2),
      dueDate: dto.dueDate ? new Date(dto.dueDate) : null,
      status: dto.status ?? AthleteChargeStatus.PENDING,
      notes: dto.notes ?? null,
    });
    return this.athleteCharges.save(row);
  }

  async listAthleteCharges(tenantId: string, query: ListAthleteChargesQueryDto) {
    const limit = query.limit ?? 50;
    const offset = query.offset ?? 0;
    const qb = this.athleteCharges
      .createQueryBuilder('ac')
      .leftJoinAndSelect('ac.chargeItem', 'chargeItem')
      .where('ac.tenantId = :tenantId', { tenantId });
    if (query.athleteId) qb.andWhere('ac.athleteId = :athleteId', { athleteId: query.athleteId });
    if (query.status) qb.andWhere('ac.status = :status', { status: query.status });
    const total = await qb.clone().getCount();
    const items = await qb.orderBy('ac.createdAt', 'DESC').skip(offset).take(limit).getMany();
    return { items, total };
  }

  async getAthleteCharge(tenantId: string, id: string): Promise<AthleteCharge> {
    const row = await this.athleteCharges.findOne({
      where: { id, tenantId },
      relations: ['chargeItem'],
    });
    if (!row) throw new NotFoundException('Athlete charge not found');
    return row;
  }

  async updateAthleteCharge(tenantId: string, id: string, dto: UpdateAthleteChargeDto): Promise<AthleteCharge> {
    const row = await this.getAthleteCharge(tenantId, id);
    if (dto.athleteId !== undefined && dto.athleteId !== row.athleteId) {
      const athlete = await this.athletes.findOne({ where: { id: dto.athleteId, tenantId } });
      if (!athlete) throw new BadRequestException('Athlete not found');
      row.athleteId = dto.athleteId;
    }
    if (dto.chargeItemId !== undefined && dto.chargeItemId !== row.chargeItemId) {
      const item = await this.chargeItems.findOne({ where: { id: dto.chargeItemId, tenantId } });
      if (!item) throw new BadRequestException('Charge item not found');
      row.chargeItemId = dto.chargeItemId;
    }
    if (dto.amount !== undefined) row.amount = dto.amount.toFixed(2);
    if (dto.dueDate !== undefined) row.dueDate = dto.dueDate ? new Date(dto.dueDate) : null;
    if (dto.status !== undefined) row.status = dto.status;
    if (dto.notes !== undefined) row.notes = dto.notes ?? null;
    return this.athleteCharges.save(row);
  }

  async removeAthleteCharge(tenantId: string, id: string): Promise<void> {
    const res = await this.athleteCharges.delete({ id, tenantId });
    if (!res.affected) throw new NotFoundException('Athlete charge not found');
  }
}
