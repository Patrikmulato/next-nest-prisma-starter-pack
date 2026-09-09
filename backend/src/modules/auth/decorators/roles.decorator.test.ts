import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import 'reflect-metadata';
import { ROLES_KEY, Roles } from './roles.decorator.js';

class TestController {
  handler(): void {
    // no-op test method
  }
}

describe('Roles decorator', () => {
  it('stores role metadata for class targets', () => {
    Roles('ADMIN', 'CREATOR')(TestController);

    const metadata = Reflect.getMetadata(ROLES_KEY, TestController) as
      Array<'USER' | 'CREATOR' | 'ADMIN'> | undefined;

    assert.deepEqual(metadata, ['ADMIN', 'CREATOR']);
  });

  it('stores role metadata for method targets', () => {
    const descriptor = Object.getOwnPropertyDescriptor(TestController.prototype, 'handler');
    assert.ok(descriptor);

    Roles('USER')(TestController.prototype, 'handler', descriptor);

    const metadata = Reflect.getMetadata(ROLES_KEY, descriptor.value) as
      Array<'USER' | 'CREATOR' | 'ADMIN'> | undefined;

    assert.deepEqual(metadata, ['USER']);
  });
});
