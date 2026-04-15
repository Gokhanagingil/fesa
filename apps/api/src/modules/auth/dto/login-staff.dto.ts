import { IsEmail, IsString, MinLength, MaxLength } from 'class-validator';

export class LoginStaffDto {
  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(8)
  @MaxLength(128)
  password!: string;
}
