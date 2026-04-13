import { PartialType } from '@nestjs/mapped-types';
import { CreateChargeItemDto } from './create-charge-item.dto';

export class UpdateChargeItemDto extends PartialType(CreateChargeItemDto) {}
