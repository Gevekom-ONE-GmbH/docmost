import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  UseGuards,
} from '@nestjs/common';
import { PagePermissionService } from './page-permission.service';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { AuthUser } from '../../../common/decorators/auth-user.decorator';
import { User } from '@docmost/db/types/entity.types';
import {
  AddPagePermissionDto,
  ListPagePermissionsDto,
  PagePermissionPageIdDto,
  RemovePagePermissionDto,
  UpdatePagePermissionRoleDto,
} from './dto/page-permission.dto';

@UseGuards(JwtAuthGuard)
@Controller()
export class PagePermissionController {
  constructor(private readonly service: PagePermissionService) {}

  @HttpCode(HttpStatus.OK)
  @Post('pages/permission-info')
  async info(
    @Body() dto: PagePermissionPageIdDto,
    @AuthUser() user: User,
  ) {
    return this.service.getPermissionInfo(dto.pageId, user);
  }

  @HttpCode(HttpStatus.OK)
  @Post('pages/permissions')
  async list(@Body() dto: ListPagePermissionsDto, @AuthUser() user: User) {
    return this.service.listPermissions(dto, user);
  }

  @HttpCode(HttpStatus.OK)
  @Post('pages/restrict')
  async restrict(
    @Body() dto: PagePermissionPageIdDto,
    @AuthUser() user: User,
  ) {
    return this.service.restrictPage(dto.pageId, user);
  }

  @HttpCode(HttpStatus.OK)
  @Post('pages/remove-restriction')
  async removeRestriction(
    @Body() dto: PagePermissionPageIdDto,
    @AuthUser() user: User,
  ) {
    return this.service.removeRestriction(dto.pageId, user);
  }

  @HttpCode(HttpStatus.OK)
  @Post('pages/add-permission')
  async add(@Body() dto: AddPagePermissionDto, @AuthUser() user: User) {
    return this.service.addPermissions(dto, user);
  }

  @HttpCode(HttpStatus.OK)
  @Post('pages/update-permission')
  async update(
    @Body() dto: UpdatePagePermissionRoleDto,
    @AuthUser() user: User,
  ) {
    return this.service.updatePermissionRole(dto, user);
  }

  @HttpCode(HttpStatus.OK)
  @Post('pages/remove-permission')
  async remove(@Body() dto: RemovePagePermissionDto, @AuthUser() user: User) {
    return this.service.removePermission(dto, user);
  }
}
