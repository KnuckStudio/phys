import {
  JsonController,
  Body,
  Param,
  Post,
  Put,
  Get,
  OnUndefined,
  NotFoundError,
  Delete,
  UseBefore
} from 'routing-controllers';

import { injector } from '@/server';
import { ModulesService } from '@/db/services/modules.service';
import { ModuleCreationInfo, ModuleEditionInfo } from '@/db/models/Module';
import {
  simpleErrorHandler,
  alreadyExistsErrorHandler,
  haveDependenciesErrorHandler
} from '../errors';
import { RestrictMiddleware } from '@/middlewares/restrict.middleware';

@JsonController()
export class ModulesController {
  private modules: ModulesService = injector.get(ModulesService);

  @Get('/modules')
  public async getAll() {
    return await this.modules.getAll().catch(simpleErrorHandler);
  }

  @Get('/module/:id')
  @OnUndefined(NotFoundError)
  public async getSingle(@Param('id') id: any) {
    return await this.modules.getSingle(id).catch(simpleErrorHandler);
  }

  @Post('/module')
  @UseBefore(RestrictMiddleware)
  public async create(@Body() data: ModuleCreationInfo) {
    const [id] = await this.modules
      .create(data)
      .catch(alreadyExistsErrorHandler);
    return id;
  }

  @Put('/module')
  @UseBefore(RestrictMiddleware)
  public async update(@Body() data: ModuleEditionInfo) {
    await this.modules.update(data).catch(alreadyExistsErrorHandler);
    return {};
  }

  @Delete('/module/:id')
  @UseBefore(RestrictMiddleware)
  public async remove(@Param('id') id: any) {
    await this.modules.remove(id).catch(haveDependenciesErrorHandler);
    return {};
  }
}
