import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from './access-token.guard';
import { OwnerAccessGuard } from './owner-access.guard';
import { UsersService } from './users.service';
import {
  UpdateUserDto,
  UpdateUserProfileDto,
  UpdateUserSettingsDto,
} from './dto';

@Controller('users')
@UseGuards(JwtAuthGuard, OwnerAccessGuard)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get(':id')
  getUser(@Param('id') userId: string) {
    return this.usersService.getByIdOrThrow(userId);
  }

  @Patch(':id')
  updateUser(@Param('id') userId: string, @Body() body: UpdateUserDto) {
    return this.usersService.update(userId, body);
  }

  @Delete(':id')
  async deleteUser(@Param('id') userId: string) {
    await this.usersService.softDelete(userId);
    return {
      status: 'ok',
      deleted: true,
    };
  }

  @Get(':id/profile')
  async getProfile(@Param('id') userId: string) {
    const user = await this.usersService.getByIdOrThrow(userId);
    return user.profile;
  }

  @Patch(':id/profile')
  updateProfile(@Param('id') userId: string, @Body() body: UpdateUserProfileDto) {
    return this.usersService.updateProfile(userId, body);
  }

  @Get(':id/settings')
  async getSettings(@Param('id') userId: string) {
    const user = await this.usersService.getByIdOrThrow(userId);
    return user.settings;
  }

  @Patch(':id/settings')
  updateSettings(@Param('id') userId: string, @Body() body: UpdateUserSettingsDto) {
    return this.usersService.updateSettings(userId, body);
  }
}

