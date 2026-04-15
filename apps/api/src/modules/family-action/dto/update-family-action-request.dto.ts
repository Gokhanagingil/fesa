import { PartialType } from '@nestjs/mapped-types';
import { CreateFamilyActionRequestDto } from './create-family-action-request.dto';

export class UpdateFamilyActionRequestDto extends PartialType(CreateFamilyActionRequestDto) {}
