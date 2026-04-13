import { PartialType } from '@nestjs/mapped-types';
import { CreateAthleteChargeDto } from './create-athlete-charge.dto';

export class UpdateAthleteChargeDto extends PartialType(CreateAthleteChargeDto) {}
