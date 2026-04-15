import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PrivateLesson } from '../../database/entities/private-lesson.entity';
import { Athlete } from '../../database/entities/athlete.entity';
import { Coach } from '../../database/entities/coach.entity';
import { ChargeItem } from '../../database/entities/charge-item.entity';
import { AthleteCharge } from '../../database/entities/athlete-charge.entity';
import { PrivateLessonController } from './private-lesson.controller';
import { PrivateLessonService } from './private-lesson.service';

@Module({
  imports: [TypeOrmModule.forFeature([PrivateLesson, Athlete, Coach, ChargeItem, AthleteCharge])],
  controllers: [PrivateLessonController],
  providers: [PrivateLessonService],
  exports: [PrivateLessonService],
})
export class PrivateLessonModule {}
