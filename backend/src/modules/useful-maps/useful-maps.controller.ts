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
  Query,
  UseGuards,
  ValidationPipe,
} from '@nestjs/common';
import { ApiResponseMessage } from '../../common/decorators/api-response.decorator.js';
import { RateLimit } from '../../common/rate-limit/rate-limit.decorator.js';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { Roles } from '../auth/decorators/roles.decorator.js';
import { RolesGuard } from '../auth/roles.guard.js';
import { CreateUsefulMapDto } from './dto/create-useful-map.dto.js';
import { IssueUsefulMapUploadTicketDto } from './dto/issue-upload-ticket.dto.js';
import { ListPublicUsefulMapsQueryDto } from './dto/list-public-useful-maps-query.dto.js';
import { UpdateUsefulMapDto } from './dto/update-useful-map.dto.js';
import { CleanupUsefulMapBlobDto } from './dto/cleanup-useful-map-blob.dto.js';
import {
  UsefulMapAdminDto,
  UsefulMapBlobCleanupRetryResultDto,
  PaginatedUsefulMapAdminDto,
  UsefulMapMutationResponseDto,
  UsefulMapUploadTicketDto,
} from './dto/useful-map-admin.dto.js';
import { PaginatedUsefulMapsDto } from './dto/useful-map.dto.js';
import { UsefulMapCategoryDto } from './dto/useful-map-category.dto.js';
import { UsefulMapsService } from './useful-maps.service.js';

@Controller('useful-maps')
export class UsefulMapsController {
  constructor(@Inject(UsefulMapsService) private readonly usefulMapsService: UsefulMapsService) {}

  @Get('categories')
  @Header('Cache-Control', 'no-store')
  @RateLimit(60, 60_000)
  @ApiResponseMessage('Useful map categories loaded')
  async listCategories(
    @Query(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
        expectedType: ListPublicUsefulMapsQueryDto,
      })
    )
    query: ListPublicUsefulMapsQueryDto
  ): Promise<UsefulMapCategoryDto[]> {
    return this.usefulMapsService.listCategories(query.onlyWithImages);
  }

  @Get('public')
  @Header('Cache-Control', 'public, max-age=120, stale-while-revalidate=3600')
  @RateLimit(120, 60_000)
  @ApiResponseMessage('Useful maps loaded')
  async listPublicUsefulMaps(
    @Query(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
        expectedType: ListPublicUsefulMapsQueryDto,
      })
    )
    query: ListPublicUsefulMapsQueryDto
  ): Promise<PaginatedUsefulMapsDto> {
    return this.usefulMapsService.listPublicUsefulMaps(query);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @Get('admin')
  @Header('Cache-Control', 'private, no-store')
  @RateLimit(60, 60_000)
  @ApiResponseMessage('Useful maps admin list loaded')
  async listAdminUsefulMaps(
    @Query(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
        expectedType: ListPublicUsefulMapsQueryDto,
      })
    )
    query: ListPublicUsefulMapsQueryDto
  ): Promise<PaginatedUsefulMapAdminDto> {
    return this.usefulMapsService.listAdminUsefulMaps(query);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @Post('upload-ticket')
  @ApiResponseMessage('Useful map upload ticket issued')
  async issueUploadTicket(
    // See auth controller: this build needs explicit expectedType because the
    // emitted design:paramtypes metadata is incomplete under tsx.
    @Body(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
        expectedType: IssueUsefulMapUploadTicketDto,
      })
    )
    body: IssueUsefulMapUploadTicketDto,
    @CurrentUser('sub') requesterUserId: string
  ): Promise<UsefulMapUploadTicketDto> {
    return this.usefulMapsService.issueUploadTicket(requesterUserId, body);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @Post()
  @ApiResponseMessage('Useful map created')
  async createUsefulMap(
    @Body(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
        expectedType: CreateUsefulMapDto,
      })
    )
    body: CreateUsefulMapDto,
    @CurrentUser('sub') requesterUserId: string
  ): Promise<UsefulMapAdminDto> {
    return this.usefulMapsService.createUsefulMap(requesterUserId, body);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @Put(':id')
  @ApiResponseMessage('Useful map updated')
  async updateUsefulMap(
    @Param('id') id: string,
    @Body(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
        expectedType: UpdateUsefulMapDto,
      })
    )
    body: UpdateUsefulMapDto,
    @CurrentUser('sub') requesterUserId: string
  ): Promise<UsefulMapAdminDto> {
    return this.usefulMapsService.updateUsefulMap(id, requesterUserId, body);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @Post('cleanup')
  @ApiResponseMessage('Useful map blob cleanup completed')
  async cleanupUploadedBlob(
    @Body(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
        expectedType: CleanupUsefulMapBlobDto,
      })
    )
    body: CleanupUsefulMapBlobDto,
    @CurrentUser('sub') requesterUserId: string
  ): Promise<UsefulMapMutationResponseDto> {
    return this.usefulMapsService.cleanupUploadedBlob(requesterUserId, body);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @Post('cleanup/retry')
  @ApiResponseMessage('Useful map blob cleanup retry completed')
  async retryBlobCleanup(
    @CurrentUser('sub') requesterUserId: string
  ): Promise<UsefulMapBlobCleanupRetryResultDto> {
    return this.usefulMapsService.retryBlobCleanup(requesterUserId);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @Delete(':id')
  @ApiResponseMessage('Useful map deleted')
  async deleteUsefulMap(
    @Param('id') id: string,
    @CurrentUser('sub') requesterUserId: string
  ): Promise<UsefulMapMutationResponseDto> {
    return this.usefulMapsService.deleteUsefulMap(id, requesterUserId);
  }
}
