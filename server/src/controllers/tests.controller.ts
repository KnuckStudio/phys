import {
  JsonController,
  Body,
  Param,
  Post,
  Put,
  Get,
  OnUndefined,
  NotFoundError,
  Delete
} from 'routing-controllers';

import { injector } from '@/server';
import { TestsService } from '@/db/services/tests.service';
import { TestCreationInfo, TestEditionInfo } from '@/db/models/Test';
import {
  AlreadyExistsError,
  simpleErrorHandler,
  alreadyExistsErrorHandler,
  haveDependenciesErrorHandler
} from '../errors';

@JsonController()
export class TestsController {
  private tests: TestsService = injector.get(TestsService);

  @Get('/tests')
  public async getAll() {
    return await this.tests.getAll().catch(simpleErrorHandler);
  }

  @Get('/test/:id')
  @OnUndefined(NotFoundError)
  public async getSingle(@Param('id') id: any) {
    return await this.tests.getSingle(id).catch(simpleErrorHandler);
  }

  @Post('/test')
  @OnUndefined(AlreadyExistsError)
  public async create(@Body() data: TestCreationInfo) {
    const [id] = await this.tests.create(data).catch(alreadyExistsErrorHandler);
    return id;
  }

  @Put('/test')
  public async update(@Body() data: TestEditionInfo) {
    await this.tests.update(data).catch(alreadyExistsErrorHandler);
    return {};
  }

  @Delete('/test/:id')
  public async remove(@Param('id') id: any) {
    await this.tests.remove(id).catch(haveDependenciesErrorHandler);
    return {};
  }
}
