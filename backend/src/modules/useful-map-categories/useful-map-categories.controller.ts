import {
  Body,
  Controller,
  Delete,
  Get,
  Header,
  Inject,
  Param,
  Post,
  Put,
  UseGuards,
  ValidationPipe,
} from '@nestjs/common';
import { ApiResponseMessage } from '../../common/decorators/api-response.decorator.js';
import { RateLimit } from '../../common/rate-limit/rate-limit.decorator.js';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { Roles } from '../auth/decorators/roles.decorator.js';
import { RolesGuard } from '../auth/roles.guard.js';
import type { AccessTokenPayload } from '../auth/auth.types.js';
import { CreateUsefulMapCategoryDto } from './dto/create-useful-map-category.dto.js';
import { UpdateUsefulMapCategoryDto } from './dto/update-useful-map-category.dto.js';
import {
  UsefulMapCategoryAdminDto,
  UsefulMapCategoryMutationResponseDto,
} from './dto/useful-map-category-admin.dto.js';
import { UsefulMapCategoriesService } from './useful-map-categories.service.js';

@Controller('useful-map-categories')
export class UsefulMapCategoriesController {
  constructor(
    @Inject(UsefulMapCategoriesService)
    private readonly usefulMapCategoriesService: UsefulMapCategoriesService
  ) {}

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @Get()
  @Header('Cache-Control', 'private, no-store')
  @RateLimit(60, 60_000)
  @ApiResponseMessage('Useful map categories admin list loaded')
  async listCategories(): Promise<UsefulMapCategoryAdminDto[]> {
    return this.usefulMapCategoriesService.listCategories();
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @Post()
  @Header('Cache-Control', 'private, no-store')
  @RateLimit(30, 60_000)
  @ApiResponseMessage('Useful map category created')
  async createCategory(
    @CurrentUser() user: AccessTokenPayload,
    @Body(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
        expectedType: CreateUsefulMapCategoryDto,
      })
    )
    dto: CreateUsefulMapCategoryDto
  ): Promise<UsefulMapCategoryAdminDto> {
    return this.usefulMapCategoriesService.createCategory(user.sub, dto);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @Put(':id')
  @Header('Cache-Control', 'private, no-store')
  @RateLimit(30, 60_000)
  @ApiResponseMessage('Useful map category updated')
  async updateCategory(
    @Param('id') id: string,
    @CurrentUser() user: AccessTokenPayload,
    @Body(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
        expectedType: UpdateUsefulMapCategoryDto,
      })
    )
    dto: UpdateUsefulMapCategoryDto
  ): Promise<UsefulMapCategoryAdminDto> {
    return this.usefulMapCategoriesService.updateCategory(id, user.sub, dto);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @Delete(':id')
  @Header('Cache-Control', 'private, no-store')
  @RateLimit(30, 60_000)
  @ApiResponseMessage('Useful map category deleted')
  async deleteCategory(
    @Param('id') id: string,
    @CurrentUser() user: AccessTokenPayload
  ): Promise<UsefulMapCategoryMutationResponseDto> {
    return this.usefulMapCategoriesService.deleteCategory(id, user.sub);
  }
}
