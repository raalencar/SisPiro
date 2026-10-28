import {
  BadRequestException,
  Controller,
  Get,
  Header,
  Param,
  ParseIntPipe,
  ParseUUIDPipe,
  Query,
  StreamableFile,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiProduces,
  ApiTags,
} from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { Roles } from '../../auth/auth.decorators.js';
import {
  SupplierCatalogCategoriesQueryDto,
  SupplierCatalogQueryDto,
} from './supplier-catalog.dto.js';
import { SupplierCatalogImagesService } from './supplier-catalog-images.service.js';
import { SupplierCatalogService } from './supplier-catalog.service.js';

// ESTOQUE também lê: o vínculo item→produto acontece em POST /inventory/products
// e a imageUrl dos produtos aponta para a rota de imagem deste controller.
@ApiTags('Compras e fornecedores')
@ApiBearerAuth()
@Roles(UserRole.COMPRAS, UserRole.ESTOQUE)
@Controller('procurement/supplier-catalog')
export class SupplierCatalogController {
  constructor(
    private readonly catalog: SupplierCatalogService,
    private readonly images: SupplierCatalogImagesService,
  ) {}

  @Get()
  @ApiOperation({
    summary:
      'Lista itens do catálogo de fornecedores (staging, sem dados PCE) com filtros e paginação.',
  })
  list(@Query() query: SupplierCatalogQueryDto) {
    return this.catalog.list(query);
  }

  @Get('categories')
  @ApiOperation({ summary: 'Lista as categorias distintas do catálogo.' })
  listCategories(@Query() query: SupplierCatalogCategoriesQueryDto) {
    return this.catalog.listCategories(query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Consulta um item do catálogo de fornecedor.' })
  @ApiParam({ name: 'id', format: 'uuid' })
  get(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.catalog.get(id);
  }

  @Get(':id/images/:index')
  @ApiOperation({ summary: 'Retorna o arquivo de imagem do item do catálogo.' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiParam({ name: 'index', type: Number })
  @ApiProduces('image/jpeg', 'image/png', 'image/webp')
  @Header('Cache-Control', 'private, max-age=86400')
  @Header('X-Content-Type-Options', 'nosniff')
  image(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Param(
      'index',
      new ParseIntPipe({
        exceptionFactory: () =>
          new BadRequestException('Índice de imagem inválido.'),
      }),
    )
    index: number,
  ): Promise<StreamableFile> {
    return this.images.open(id, index);
  }
}
