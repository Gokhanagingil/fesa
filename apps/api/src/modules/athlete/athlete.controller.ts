import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  NotFoundException,
  Param,
  Patch,
  Post,
  Query,
  Req,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Request, Response } from 'express';
import { memoryStorage } from 'multer';
import { TenantGuard } from '../core/tenant.guard';
import { AthleteService } from './athlete.service';
import { CreateAthleteDto } from './dto/create-athlete.dto';
import { UpdateAthleteDto } from './dto/update-athlete.dto';
import { ListAthletesQueryDto } from './dto/list-athletes-query.dto';
import { LinkAthleteGuardianDto } from '../guardian/dto/link-athlete-guardian.dto';
import { GuardianService } from '../guardian/guardian.service';
import { AddTeamMembershipDto } from './dto/add-team-membership.dto';
import { FamilyActionService } from '../family-action/family-action.service';
import { BulkUpdateAthletesDto } from './dto/bulk-update-athletes.dto';
import {
  MAX_PHOTO_SIZE_BYTES,
  MediaStorageService,
} from '../media/media-storage.service';

@Controller('athletes')
@UseGuards(TenantGuard)
export class AthleteController {
  constructor(
    private readonly athletes: AthleteService,
    private readonly guardians: GuardianService,
    private readonly familyActions: FamilyActionService,
    private readonly media: MediaStorageService,
  ) {}

  @Get()
  list(@Req() req: Request, @Query() query: ListAthletesQueryDto) {
    return this.athletes.list(req.tenantId!, query);
  }

  @Post()
  create(@Req() req: Request, @Body() dto: CreateAthleteDto) {
    return this.athletes.create(req.tenantId!, dto);
  }

  @Patch('bulk')
  bulkUpdate(@Req() req: Request, @Body() dto: BulkUpdateAthletesDto) {
    return this.athletes.bulkUpdate(req.tenantId!, dto);
  }

  @Get(':id')
  get(@Req() req: Request, @Param('id') id: string) {
    return this.athletes.findOne(req.tenantId!, id);
  }

  @Patch(':id')
  update(@Req() req: Request, @Param('id') id: string, @Body() dto: UpdateAthleteDto) {
    return this.athletes.update(req.tenantId!, id, dto);
  }

  @Delete(':id')
  remove(@Req() req: Request, @Param('id') id: string) {
    return this.athletes.remove(req.tenantId!, id);
  }

  @Get(':id/guardians')
  listGuardians(@Req() req: Request, @Param('id') athleteId: string) {
    return this.athletes.listGuardiansForAthlete(req.tenantId!, athleteId);
  }

  @Get(':id/family-readiness')
  getFamilyReadiness(@Req() req: Request, @Param('id') athleteId: string) {
    return this.familyActions.getAthleteReadiness(req.tenantId!, athleteId);
  }

  @Post(':id/guardians')
  linkGuardian(
    @Req() req: Request,
    @Param('id') athleteId: string,
    @Body() dto: LinkAthleteGuardianDto,
  ) {
    return this.guardians.linkToAthlete(req.tenantId!, athleteId, dto);
  }

  @Delete(':id/guardians/:linkId')
  unlinkGuardian(
    @Req() req: Request,
    @Param('id') athleteId: string,
    @Param('linkId') linkId: string,
  ) {
    return this.guardians.unlinkFromAthlete(req.tenantId!, athleteId, linkId);
  }

  @Get(':id/teams')
  listTeams(@Req() req: Request, @Param('id') athleteId: string) {
    return this.athletes.listTeamsForAthlete(req.tenantId!, athleteId);
  }

  @Post(':id/teams')
  addTeam(
    @Req() req: Request,
    @Param('id') athleteId: string,
    @Body() dto: AddTeamMembershipDto,
  ) {
    return this.athletes.addTeamMembership(req.tenantId!, athleteId, dto.teamId);
  }

  @Post(':id/teams/:membershipId/end')
  endTeam(
    @Req() req: Request,
    @Param('id') athleteId: string,
    @Param('membershipId') membershipId: string,
  ) {
    return this.athletes.endTeamMembership(req.tenantId!, athleteId, membershipId);
  }

  /**
   * Wave 16 — Athlete Photo & Media Foundation v1.
   *
   * Upload (or replace) the athlete profile photo.  Multer is configured
   * with in-memory storage so the buffer can be validated and routed
   * through {@link MediaStorageService} which owns disk + tenant rules.
   *
   * The endpoint accepts a `file` form field (multipart/form-data) and
   * returns the updated athlete row including `photoUploadedAt` so the UI
   * can cache-bust immediately.
   */
  @Post(':id/photo')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: MAX_PHOTO_SIZE_BYTES, files: 1 },
    }),
  )
  uploadPhoto(
    @Req() req: Request,
    @Param('id') athleteId: string,
    @UploadedFile() file: Express.Multer.File | undefined,
  ) {
    if (!file) {
      throw new BadRequestException('No photo file received.');
    }
    const contentType = this.media.assertValidPhoto(file.buffer, file.mimetype);
    return this.athletes.setAthletePhoto(req.tenantId!, athleteId, file.buffer, contentType);
  }

  @Delete(':id/photo')
  removePhoto(@Req() req: Request, @Param('id') athleteId: string) {
    return this.athletes.removeAthletePhoto(req.tenantId!, athleteId);
  }

  /**
   * Stream the current athlete profile photo.  Tenant scoping is enforced
   * by the service load and the on-disk path is sandboxed inside the
   * per-tenant media root, so a forged athleteId can never read another
   * tenant's file.  The response includes a long, immutable cache header
   * because the URL is changed (via `?v=<photoUploadedAt>`) on replace.
   */
  @Get(':id/photo')
  async getPhoto(
    @Req() req: Request,
    @Param('id') athleteId: string,
    @Res() res: Response,
  ): Promise<void> {
    const photo = await this.athletes.getAthletePhotoFile(req.tenantId!, athleteId);
    if (!photo) {
      throw new NotFoundException('Athlete photo not found');
    }
    res.setHeader('Content-Type', photo.contentType);
    if (photo.sizeBytes != null) {
      res.setHeader('Content-Length', String(photo.sizeBytes));
    }
    res.setHeader('Cache-Control', 'private, max-age=86400, immutable');
    if (photo.uploadedAt) {
      res.setHeader('Last-Modified', photo.uploadedAt.toUTCString());
    }
    const stream = this.media.createReadStream(photo.absolutePath);
    stream.on('error', () => {
      if (!res.headersSent) {
        res.status(500).end();
      } else {
        res.destroy();
      }
    });
    stream.pipe(res);
  }
}
