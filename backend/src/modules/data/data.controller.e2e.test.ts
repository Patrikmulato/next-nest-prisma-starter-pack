import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { AppModule } from '../../app.module.js';
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';

const validPayload = {
  sideFilter: 'all',
  lineFilter: 'all',
  euPlateFilter: 'all',
  cameraGenFilter: 'all',
  coverageYearFilter: 'all',
  carColorFilter: 'all',
  vehicleTypeFilter: 'all',
};

describe('DataController /api/data/filter validation (e2e)', () => {
  let app: NestFastifyApplication;

  before(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication<NestFastifyApplication>(new FastifyAdapter());
    app.setGlobalPrefix('api');
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      })
    );
    await app.init();
    await app.getHttpAdapter().getInstance().ready();
  });

  after(async () => {
    await app.close();
  });

  it('accepts valid payload', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/data/filter',
      payload: validPayload,
    });
    assert.equal(res.statusCode, 201);
    const body = res.json();

    assert.ok(Array.isArray(body.countries));
  });

  it('rejects unknown properties', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/data/filter',
      payload: { ...validPayload, unknownField: 'x' },
    });
    assert.equal(res.statusCode, 400);
    const body = res.json();

    assert.ok(Array.isArray(body.message));
    assert.ok(body.message.some((m: string) => m.includes('unknownField')));
  });

  it('rejects invalid enum values', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/data/filter',
      payload: { ...validPayload, cameraGenFilter: '9' },
    });
    assert.equal(res.statusCode, 400);
    const body = res.json();

    assert.ok(Array.isArray(body.message));
    assert.ok(body.message.some((m: string) => m.includes('cameraGenFilter')));
  });

  it('rejects malformed coverageYearFilter', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/data/filter',
      payload: { ...validPayload, coverageYearFilter: '20xx' },
    });
    assert.equal(res.statusCode, 400);
    const body = res.json();

    assert.ok(Array.isArray(body.message));
    assert.ok(body.message.some((m: string) => m.includes('coverageYearFilter')));
  });

  it('GET /api/data/geojson returns a valid GeoJSON FeatureCollection', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/data/geojson' });
    assert.equal(res.statusCode, 200);
    const body = res.json();

    assert.equal(body.type, 'FeatureCollection');
    assert.ok(Array.isArray(body.features));
    assert.ok(body.features.length > 0);
  });

  it('GET /api/data/map returns all expected top-level keys', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/data/map' });
    assert.equal(res.statusCode, 200);
    const body = res.json();

    const expectedKeys = [
      'aliases',
      'geoguessrCountries',
      'drivingSideData',
      'roadLinesData',
      'linePatternLabels',
      'linePatternColors',
      'euPlateData',
      'cameraGenData',
      'coverageYearsData',
      'carColorData',
      'vehicleTypeData',
      'tooltipHtmlByCountry',
    ];
    for (const key of expectedKeys) {
      assert.ok(key in body, `missing key: ${key}`);
    }
  });

  it('POST /api/data/filter with a missing required field returns 400', async () => {
    const payloadWithoutSideFilter = Object.fromEntries(
      Object.entries(validPayload).filter(([key]) => key !== 'sideFilter')
    );

    const res = await app.inject({
      method: 'POST',
      url: '/api/data/filter',
      payload: payloadWithoutSideFilter,
    });
    assert.equal(res.statusCode, 400);
    const body = res.json();

    assert.ok(Array.isArray(body.message));
  });

  it('POST /api/data/filter returns identical results on repeated calls (cache correctness)', async () => {
    const first = await app.inject({
      method: 'POST',
      url: '/api/data/filter',
      payload: validPayload,
    });
    assert.equal(first.statusCode, 201);
    const firstBody = first.json();

    const second = await app.inject({
      method: 'POST',
      url: '/api/data/filter',
      payload: validPayload,
    });
    assert.equal(second.statusCode, 201);
    const secondBody = second.json();

    assert.deepEqual(firstBody.countries, secondBody.countries);
  });
});
