import {
  Body,
  Controller,
  Delete,
  Get,
  Inject,
  Param,
  Post,
  UseGuards,
  ValidationPipe,
} from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { Roles } from '../auth/decorators/roles.decorator.js';
import { RolesGuard } from '../auth/roles.guard.js';
import { CreateUserDto } from './dto/create-user.dto.js';
import { UserDto } from './dto/user.dto.js';
import { UsersService } from './users.service.js';

@Controller('users')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
export class UsersController {
  private readonly usersService: UsersService;

  constructor(@Inject(UsersService) usersService: UsersService) {
    this.usersService = usersService;
  }

  @Post()
  async createUser(
    // The global ValidationPipe can't infer the @Body() metatype in this build
    // (no emitted design:paramtypes metadata), so it silently skips validation
    // unless the expected type is passed explicitly here.
    @Body(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
        expectedType: CreateUserDto,
      })
    )
    body: CreateUserDto
  ): Promise<UserDto> {
    return this.usersService.createUser(body);
  }

  @Get()
  async listUsers(): Promise<UserDto[]> {
    return this.usersService.listUsers();
  }

  @Get(':id')
  async getUserById(@Param('id') id: string): Promise<UserDto> {
    return this.usersService.getUserById(id);
  }

  @Delete(':id')
  async deleteUserById(
    @Param('id') id: string,
    @CurrentUser('sub') actorUserId: string
  ): Promise<{ id: string; deleted: true }> {
    return this.usersService.deleteUserById(id, actorUserId);
  }
}
