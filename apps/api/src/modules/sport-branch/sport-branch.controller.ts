import { Controller, Get, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SportBranch } from '../../database/entities/sport-branch.entity';
import { TenantGuard } from '../core/tenant.guard';

@Controller('sport-branches')
@UseGuards(TenantGuard)
export class SportBranchController {
  constructor(
    @InjectRepository(SportBranch)
    private readonly branches: Repository<SportBranch>,
  ) {}

  @Get()
  list(@Req() req: Request) {
    return this.branches.find({
      where: { tenantId: req.tenantId! },
      order: { name: 'ASC' },
    });
  }
}
