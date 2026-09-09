import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { DataService, escapeHtml } from './data.service.js';
import { LoggerService } from '../../common/logger/logger.service.js';

const service = new DataService(new LoggerService());

describe('escapeHtml', () => {
  it('escapes HTML-significant characters', () => {
    assert.equal(escapeHtml('<img onerror="x">'), '&lt;img onerror=&quot;x&quot;&gt;');
    assert.equal(escapeHtml("O'Brien & Co"), 'O&#39;Brien &amp; Co');
  });

  it('leaves safe strings unchanged', () => {
    assert.equal(escapeHtml('France'), 'France');
  });
});

describe('DataService.getFilteredCountries', () => {
  it('returns many countries for all filters', () => {
    const res = service.getFilteredCountries({
      sideFilter: 'all',
      lineFilter: 'all',
      euPlateFilter: 'all',
      cameraGenFilter: 'all',
      coverageYearFilter: 'all',
      carColorFilter: 'all',
      vehicleTypeFilter: 'all',
    });

    assert.ok(res.countries.length > 50);
    assert.ok(res.countries.includes('Canada'));
  });

  it('applies driving side filter', () => {
    const res = service.getFilteredCountries({
      sideFilter: 'left',
      lineFilter: 'all',
      euPlateFilter: 'all',
      cameraGenFilter: 'all',
      coverageYearFilter: 'all',
      carColorFilter: 'all',
      vehicleTypeFilter: 'all',
    });

    assert.ok(res.countries.includes('Australia'));
    assert.ok(!res.countries.includes('Canada'));
  });

  it('applies EU plate and camera generation filters together', () => {
    const res = service.getFilteredCountries({
      sideFilter: 'all',
      lineFilter: 'all',
      euPlateFilter: 'yes',
      cameraGenFilter: '4',
      coverageYearFilter: 'all',
      carColorFilter: 'all',
      vehicleTypeFilter: 'all',
    });

    assert.ok(res.countries.includes('France'));
    assert.ok(!res.countries.includes('El Salvador')); // no euPlate entry → excluded by euPlate:yes filter
  });

  it('applies vehicle and color filters', () => {
    const trucks = service.getFilteredCountries({
      sideFilter: 'all',
      lineFilter: 'all',
      euPlateFilter: 'all',
      cameraGenFilter: 'all',
      coverageYearFilter: 'all',
      carColorFilter: 'all',
      vehicleTypeFilter: 'truck',
    });

    assert.ok(trucks.countries.includes('Namibia'));
    assert.ok(!trucks.countries.includes('Japan'));

    const reds = service.getFilteredCountries({
      sideFilter: 'all',
      lineFilter: 'all',
      euPlateFilter: 'all',
      cameraGenFilter: 'all',
      coverageYearFilter: 'all',
      carColorFilter: 'red',
      vehicleTypeFilter: 'all',
    });

    assert.ok(reds.countries.includes('Belgium'));
    assert.ok(!reds.countries.includes('Canada'));
  });

  it('applies road line pattern filter', () => {
    // 'yellow-white' pattern: Australia has it, Albania does not
    const res = service.getFilteredCountries({
      sideFilter: 'all',
      lineFilter: 'yellow-white',
      euPlateFilter: 'all',
      cameraGenFilter: 'all',
      coverageYearFilter: 'all',
      carColorFilter: 'all',
      vehicleTypeFilter: 'all',
    });

    assert.ok(res.countries.includes('Australia'));
    assert.ok(!res.countries.includes('Albania'));
  });

  it('applies coverage year filter', () => {
    // Albania has 2019 in its coverage range; Bosnia and Herzegovina does not
    const res = service.getFilteredCountries({
      sideFilter: 'all',
      lineFilter: 'all',
      euPlateFilter: 'all',
      cameraGenFilter: 'all',
      coverageYearFilter: '2019',
      carColorFilter: 'all',
      vehicleTypeFilter: 'all',
    });

    assert.ok(res.countries.includes('Albania'));
    assert.ok(!res.countries.includes('Bosnia and Herzegovina'));
  });

  it('excludes country with no cameraGenData entry when cameraGenFilter is specific', () => {
    // El Salvador has no entry in cameraGenData → missing data = excluded
    const res = service.getFilteredCountries({
      sideFilter: 'all',
      lineFilter: 'all',
      euPlateFilter: 'all',
      cameraGenFilter: '1',
      coverageYearFilter: 'all',
      carColorFilter: 'all',
      vehicleTypeFilter: 'all',
    });

    assert.ok(!res.countries.includes('El Salvador'));
  });

  it('excludes country with no euPlateData entry when euPlateFilter is yes', () => {
    // El Salvador has no entry in euPlateData → typeof val !== 'boolean' → excluded
    const res = service.getFilteredCountries({
      sideFilter: 'all',
      lineFilter: 'all',
      euPlateFilter: 'yes',
      cameraGenFilter: 'all',
      coverageYearFilter: 'all',
      carColorFilter: 'all',
      vehicleTypeFilter: 'all',
    });

    assert.ok(!res.countries.includes('El Salvador'));
  });

  it('returns the intersection when combining sideFilter left and euPlateFilter yes', () => {
    // Australia: left + EU plate yes → included
    // Albania: right + EU plate yes → excluded by sideFilter
    // Canada: right + no EU plate → excluded by both filters
    const res = service.getFilteredCountries({
      sideFilter: 'left',
      lineFilter: 'all',
      euPlateFilter: 'yes',
      cameraGenFilter: 'all',
      coverageYearFilter: 'all',
      carColorFilter: 'all',
      vehicleTypeFilter: 'all',
    });

    assert.ok(res.countries.includes('Australia'));
    assert.ok(!res.countries.includes('Albania'));
    assert.ok(!res.countries.includes('Canada'));
  });
});
