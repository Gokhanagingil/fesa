import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Brackets, Repository } from 'typeorm';
import { PrivateLesson } from '../../database/entities/private-lesson.entity';
import { Athlete } from '../../database/entities/athlete.entity';
import { Coach } from '../../database/entities/coach.entity';
import { ChargeItem } from '../../database/entities/charge-item.entity';
import { AthleteCharge } from '../../database/entities/athlete-charge.entity';
import { AthleteChargeStatus, TrainingSessionStatus } from '../../database/enums';
import { CreatePrivateLessonDto } from './dto/create-private-lesson.dto';
import { UpdatePrivateLessonDto } from './dto/update-private-lesson.dto';
import { ListPrivateLessonsQueryDto } from './dto/list-private-lessons-query.dto';

@Injectable()
export class PrivateLessonService {
  constructor(
    @InjectRepository(PrivateLesson)
    private readonly privateLessons: Repository<PrivateLesson>,
    @InjectRepository(Athlete)
    private readonly athletes: Repository<Athlete>,
    @InjectRepository(Coach)
    private readonly coaches: Repository<Coach>,
    @InjectRepository(ChargeItem)
    private readonly chargeItems: Repository<ChargeItem>,
    @InjectRepository(AthleteCharge)
    private readonly athleteCharges: Repository<AthleteCharge>,
  ) {}

  private async loadAthlete(tenantId: string, athleteId: string): Promise<Athlete> {
    const athlete = await this.athletes.findOne({
      where: { id: athleteId, tenantId },
      relations: ['sportBranch', 'primaryGroup'],
    });
    if (!athlete) {
      throw new BadRequestException('Athlete not found');
    }
    return athlete;
  }

  private async loadCoach(tenantId: string, coachId: string): Promise<Coach> {
    const coach = await this.coaches.findOne({
      where: { id: coachId, tenantId },
      relations: ['sportBranch'],
    });
    if (!coach) {
      throw new BadRequestException('Coach not found');
    }
    return coach;
  }

  private async assertAthleteCoachCompatibility(tenantId: string, athleteId: string, coachId: string): Promise<void> {
    const athlete = await this.loadAthlete(tenantId, athleteId);
    const coach = await this.loadCoach(tenantId, coachId);
    if (coach.sportBranchId !== athlete.sportBranchId) {
      throw new BadRequestException('Coach must belong to the same sport branch as the athlete');
    }
  }

  private async loadChargeItem(tenantId: string, chargeItemId: string): Promise<ChargeItem> {
    const chargeItem = await this.chargeItems.findOne({ where: { id: chargeItemId, tenantId } });
    if (!chargeItem) {
      throw new BadRequestException('Charge item not found');
    }
    return chargeItem;
  }

  private async attachBilling(
    tenantId: string,
    lesson: PrivateLesson,
    dto: Pick<CreatePrivateLessonDto, 'chargeItemId' | 'chargeAmount' | 'chargeDueDate' | 'chargeNotes'>,
  ): Promise<void> {
    if (!dto.chargeItemId || dto.chargeAmount === undefined) {
      return;
    }

    await this.loadChargeItem(tenantId, dto.chargeItemId);

    const charge = this.athleteCharges.create({
      tenantId,
      athleteId: lesson.athleteId,
      chargeItemId: dto.chargeItemId,
      amount: dto.chargeAmount.toFixed(2),
      dueDate: dto.chargeDueDate ? new Date(dto.chargeDueDate) : null,
      status: AthleteChargeStatus.PENDING,
      notes: dto.chargeNotes ?? null,
      privateLessonId: lesson.id,
    });
    await this.athleteCharges.save(charge);
  }

  private async loadLesson(tenantId: string, id: string): Promise<PrivateLesson> {
    const lesson = await this.privateLessons.findOne({
      where: { id, tenantId },
      relations: ['athlete', 'athlete.primaryGroup', 'athlete.sportBranch', 'coach', 'charge', 'charge.chargeItem'],
    });
    if (!lesson) {
      throw new NotFoundException('Private lesson not found');
    }
    return lesson;
  }

  async create(tenantId: string, dto: CreatePrivateLessonDto): Promise<PrivateLesson> {
    const athlete = await this.loadAthlete(tenantId, dto.athleteId);
    await this.assertAthleteCoachCompatibility(tenantId, dto.athleteId, dto.coachId);

    const scheduledStart = new Date(dto.scheduledStart);
    const scheduledEnd = new Date(dto.scheduledEnd);
    if (!(scheduledEnd > scheduledStart)) {
      throw new BadRequestException('scheduledEnd must be after scheduledStart');
    }

    const lesson = await this.privateLessons.save(
      this.privateLessons.create({
        tenantId,
        athleteId: dto.athleteId,
        coachId: dto.coachId,
        sportBranchId: athlete.sportBranchId,
        focus: dto.focus ?? null,
        scheduledStart,
        scheduledEnd,
        location: dto.location ?? null,
        notes: dto.notes ?? null,
        status: dto.status ?? TrainingSessionStatus.PLANNED,
        attendanceStatus: dto.attendanceStatus ?? null,
      }),
    );

    await this.attachBilling(tenantId, lesson, dto);
    return this.loadLesson(tenantId, lesson.id);
  }

  async list(tenantId: string, query: ListPrivateLessonsQueryDto) {
    const limit = query.limit ?? 50;
    const offset = query.offset ?? 0;
    const qb = this.privateLessons
      .createQueryBuilder('lesson')
      .leftJoinAndSelect('lesson.athlete', 'athlete')
      .leftJoinAndSelect('athlete.primaryGroup', 'primaryGroup')
      .leftJoinAndSelect('lesson.coach', 'coach')
      .leftJoinAndSelect('lesson.charge', 'charge')
      .leftJoinAndSelect('charge.chargeItem', 'chargeItem')
      .where('lesson.tenantId = :tenantId', { tenantId });

    if (query.athleteId) {
      qb.andWhere('lesson.athleteId = :athleteId', { athleteId: query.athleteId });
    }
    if (query.coachId) {
      qb.andWhere('lesson.coachId = :coachId', { coachId: query.coachId });
    }
    if (query.status) {
      qb.andWhere('lesson.status = :status', { status: query.status });
    }
    if (query.from) {
      qb.andWhere('lesson.scheduledStart >= :from', { from: new Date(query.from) });
    }
    if (query.to) {
      qb.andWhere('lesson.scheduledStart <= :to', { to: new Date(query.to) });
    }
    if (query.needsFollowUp) {
      qb.andWhere(
        new Brackets((where) => {
          where
            .where('lesson.status IN (:...followStatuses)', { followStatuses: ['missed', 'cancelled'] })
            .orWhere('charge.id IS NOT NULL AND charge.status != :paidStatus', { paidStatus: AthleteChargeStatus.PAID });
        }),
      );
    }
    if (query.q?.trim()) {
      const term = `%${query.q.trim().toLowerCase()}%`;
      qb.andWhere(
        new Brackets((where) => {
          where
            .where('LOWER(COALESCE(athlete.firstName, \'\')) LIKE :term', { term })
            .orWhere('LOWER(COALESCE(athlete.lastName, \'\')) LIKE :term', { term })
            .orWhere('LOWER(COALESCE(coach.firstName, \'\')) LIKE :term', { term })
            .orWhere('LOWER(COALESCE(coach.lastName, \'\')) LIKE :term', { term })
            .orWhere('LOWER(COALESCE(lesson.location, \'\')) LIKE :term', { term })
            .orWhere('LOWER(COALESCE(lesson.notes, \'\')) LIKE :term', { term });
        }),
      );
    }

    const total = await qb.clone().getCount();
    const items = await qb.orderBy('lesson.scheduledStart', 'ASC').skip(offset).take(limit).getMany();
    return { items, total };
  }

  async findOne(tenantId: string, id: string): Promise<PrivateLesson> {
    return this.loadLesson(tenantId, id);
  }

  async update(tenantId: string, id: string, dto: UpdatePrivateLessonDto): Promise<PrivateLesson> {
    const lesson = await this.loadLesson(tenantId, id);

    if (dto.athleteId && dto.athleteId !== lesson.athleteId) {
      await this.loadAthlete(tenantId, dto.athleteId);
      lesson.athleteId = dto.athleteId;
    }
    if (dto.coachId && dto.coachId !== lesson.coachId) {
      await this.loadCoach(tenantId, dto.coachId);
      lesson.coachId = dto.coachId;
    }
    await this.assertAthleteCoachCompatibility(tenantId, lesson.athleteId, lesson.coachId);

    const scheduledStart = dto.scheduledStart ? new Date(dto.scheduledStart) : lesson.scheduledStart;
    const scheduledEnd = dto.scheduledEnd ? new Date(dto.scheduledEnd) : lesson.scheduledEnd;
    if (!(scheduledEnd > scheduledStart)) {
      throw new BadRequestException('scheduledEnd must be after scheduledStart');
    }

    lesson.scheduledStart = scheduledStart;
    lesson.scheduledEnd = scheduledEnd;
    if (dto.focus !== undefined) lesson.focus = dto.focus ?? null;
    if (dto.location !== undefined) lesson.location = dto.location ?? null;
    if (dto.notes !== undefined) lesson.notes = dto.notes ?? null;
    if (dto.status !== undefined) lesson.status = dto.status;
    if (dto.attendanceStatus !== undefined) lesson.attendanceStatus = dto.attendanceStatus ?? null;
    lesson.sportBranchId = (await this.loadAthlete(tenantId, lesson.athleteId)).sportBranchId;

    await this.privateLessons.save(lesson);
    return this.loadLesson(tenantId, id);
  }

  async remove(tenantId: string, id: string): Promise<void> {
    const lesson = await this.loadLesson(tenantId, id);
    const charge = await this.athleteCharges.findOne({ where: { tenantId, privateLessonId: lesson.id } });
    if (charge) {
      charge.privateLessonId = null;
      await this.athleteCharges.save(charge);
    }
    await this.privateLessons.delete({ id, tenantId });
  }
}
