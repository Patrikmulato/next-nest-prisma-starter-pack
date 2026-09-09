import { Body, Controller, Get, Header, Inject, Post, ValidationPipe } from '@nestjs/common';
import { ApiResponseMessage } from '../../common/decorators/api-response.decorator.js';
import { DataService } from './data.service.js';
import { FilterRequestDto } from './dto/filter-request.dto.js';
import { FilterResponseDto } from './dto/filter-response.dto.js';

@Controller('data')
export class DataController {
  constructor(@Inject(DataService) private readonly dataService: DataService) {}

  @Get('geojson')
  @Header('Cache-Control', 'public, max-age=3600, stale-while-revalidate=86400')
  getGeoJson() {
    return this.dataService.getGeoJson();
  }

  @Get('map')
  @Header('Cache-Control', 'public, max-age=3600, stale-while-revalidate=86400')
  getMapData() {
    return this.dataService.getMapData();
  }

  @Get('car-meta')
  @Header('Cache-Control', 'public, max-age=86400, stale-while-revalidate=604800')
  getCarMetaData() {
    return this.dataService.getCarMetaData();
  }

  @Post('filter')
  @ApiResponseMessage('Filtered countries generated')
  getFilteredCountries(
    @Body(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
        expectedType: FilterRequestDto,
      })
    )
    body: FilterRequestDto
  ): FilterResponseDto {
    return this.dataService.getFilteredCountries(body);
  }
}
