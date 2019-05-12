import 'reflect-metadata';
import Koa from 'koa';
import {
  createKoaServer,
  useContainer,
  InternalServerError
} from 'routing-controllers';
import { ReflectiveInjector } from 'injection-js';
import { Container } from 'typedi';

import * as dotenv from 'dotenv';
dotenv.config();

import { config } from './config';

import { UsersService } from './db/services/users.service';
import { GroupsService } from './db/services/groups.service';
import { ClassroomsService } from './db/services/classrooms.service';
import { DisciplinesService } from './db/services/disciplines.service';
import { SemestersService } from './db/services/semesters.service';

import { AuthController } from './controllers/auth.controller';
import { UsersController } from './controllers/users.controller';
import { GroupsController } from './controllers/groups.controller';
import { ClassroomsController } from './controllers/classroom.controller';
import { DisciplinesController } from './controllers/disciplines.controller';
import { SemestersController } from './controllers/semester.controller';

import { ErrorMiddleware } from './middlewares/error.middleware';
import { LoggingMiddleware } from './middlewares/logging.middleware';

export const injector = ReflectiveInjector.resolveAndCreate([
  UsersService,
  GroupsService,
  ClassroomsService,
  DisciplinesService,
  SemestersService
]);
useContainer(Container);

const app: Koa = createKoaServer({
  routePrefix: '/api',
  defaultErrorHandler: false,
  controllers: [
    AuthController,
    UsersController,
    GroupsController,
    ClassroomsController,
    DisciplinesController,
    SemestersController
  ],
  middlewares: [ErrorMiddleware, LoggingMiddleware]
});

app.listen(config.port);

console.log(`Server is running on port ${config.port}`);
