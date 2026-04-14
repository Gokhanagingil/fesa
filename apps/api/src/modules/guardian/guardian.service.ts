import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Brackets, Repository } from 'typeorm';
import { Guardian } from '../../database/entities/guardian.entity';
import { AthleteGuardian } from '../../database/entities/athlete-guardian.entity';
import { Athlete } from '../../database/entities/athlete.entity';
import { CreateGuardianDto } from './dto/create-guardian.dto';
import { UpdateGuardianDto } from './dto/update-guardian.dto';
import { LinkAthleteGuardianDto } from './dto/link-athlete-guardian.dto';

@Injectable()
export class GuardianService {
  constructor(
    @InjectRepository(Guardian)
    private readonly guardians: Repository<Guardian>,
    @InjectRepository(AthleteGuardian)
    private readonly links: Repository<AthleteGuardian>,
    @InjectRepository(Athlete)
    private readonly athletes: Repository<Athlete>,
  ) {}

  async create(tenantId: string, dto: CreateGuardianDto): Promise<Guardian> {
    const g = this.guardians.create({
      tenantId,
      firstName: dto.firstName,
      lastName: dto.lastName,
      phone: dto.phone ?? null,
      email: dto.email ?? null,
      notes: dto.notes ?? null,
    });
    return this.guardians.save(g);
  }

  async list(
    tenantId: string,
    query: { q?: string; limit?: number; offset?: number },
  ): Promise<{ items: Guardian[]; total: number }> {
    const limit = query.limit ?? 50;
    const offset = query.offset ?? 0;
    const qb = this.guardians.createQueryBuilder('g').where('g.tenantId = :tenantId', { tenantId });
    if (query.q?.trim()) {
      const term = `%${query.q.trim().toLowerCase()}%`;
      qb.andWhere(
        new Brackets((w) => {
          w.where('LOWER(g.firstName) LIKE :term', { term }).orWhere('LOWER(g.lastName) LIKE :term', { term });
        }),
      );
    }
    const total = await qb.clone().getCount();
    const items = await qb.orderBy('g.lastName', 'ASC').addOrderBy('g.firstName', 'ASC').skip(offset).take(limit).getMany();
    return { items, total };
  }

  async findOne(tenantId: string, id: string): Promise<Guardian> {
    const g = await this.guardians.findOne({ where: { id, tenantId } });
    if (!g) throw new NotFoundException('Guardian not found');
    return g;
  }

  async update(tenantId: string, id: string, dto: UpdateGuardianDto): Promise<Guardian> {
    const g = await this.findOne(tenantId, id);
    Object.assign(g, {
      ...dto,
      phone: dto.phone !== undefined ? dto.phone ?? null : g.phone,
      email: dto.email !== undefined ? dto.email ?? null : g.email,
      notes: dto.notes !== undefined ? dto.notes ?? null : g.notes,
    });
    return this.guardians.save(g);
  }

  async listAthletesForGuardian(tenantId: string, guardianId: string) {
    await this.findOne(tenantId, guardianId);
    return this.links.find({
      where: { tenantId, guardianId },
      relations: ['athlete'],
      order: { isPrimaryContact: 'DESC', createdAt: 'ASC' },
    });
  }

  async remove(tenantId: string, id: string): Promise<void> {
    const res = await this.guardians.delete({ id, tenantId });
    if (!res.affected) throw new NotFoundException('Guardian not found');
  }

  async linkToAthlete(tenantId: string, athleteId: string, dto: LinkAthleteGuardianDto): Promise<AthleteGuardian> {
    const athlete = await this.athletes.findOne({ where: { id: athleteId, tenantId } });
    if (!athlete) throw new NotFoundException('Athlete not found');
    const guardian = await this.guardians.findOne({ where: { id: dto.guardianId, tenantId } });
    if (!guardian) throw new BadRequestException('Guardian not found for tenant');

    const existing = await this.links.findOne({ where: { tenantId, athleteId, guardianId: dto.guardianId } });
    if (existing) {
      if (dto.isPrimaryContact) {
        await this.links.update({ tenantId, athleteId }, { isPrimaryContact: false });
      }
      existing.relationshipType = dto.relationshipType;
      if (dto.isPrimaryContact !== undefined) existing.isPrimaryContact = dto.isPrimaryContact;
      if (dto.notes !== undefined) existing.notes = dto.notes ?? null;
      return this.links.save(existing);
    }

    if (dto.isPrimaryContact) {
      await this.links.update({ tenantId, athleteId }, { isPrimaryContact: false });
    }

    const link = this.links.create({
      tenantId,
      athleteId,
      guardianId: dto.guardianId,
      relationshipType: dto.relationshipType,
      isPrimaryContact: dto.isPrimaryContact ?? false,
      notes: dto.notes ?? null,
    });
    return this.links.save(link);
  }

  async unlinkFromAthlete(tenantId: string, athleteId: string, linkId: string): Promise<void> {
    const res = await this.links.delete({ id: linkId, tenantId, athleteId });
    if (!res.affected) throw new NotFoundException('Link not found');
  }
}
