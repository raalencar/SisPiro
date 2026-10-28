import { Injectable, NotFoundException, StreamableFile } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createReadStream } from 'node:fs';
import { realpath, stat } from 'node:fs/promises';
import { extname, resolve, sep } from 'node:path';
import { PrismaService } from '../../../database/prisma.service.js';

const CONTENT_TYPES: Record<string, string> = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
};

function imageNotFound(): never {
  throw new NotFoundException('Imagem do catálogo não encontrada.');
}

function isInside(baseDir: string, target: string) {
  return target.startsWith(baseDir + sep);
}

@Injectable()
export class SupplierCatalogImagesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  async open(id: string, index: number): Promise<StreamableFile> {
    const item = await this.prisma.supplierCatalogItem.findUnique({
      where: { id },
      select: { imagePaths: true },
    });
    const relativePath = item?.imagePaths[index];
    if (!relativePath || index < 0) {
      imageNotFound();
    }
    const contentType = CONTENT_TYPES[extname(relativePath).toLowerCase()];
    if (!contentType) {
      imageNotFound();
    }

    const baseDir = resolve(this.config.getOrThrow<string>('SUPPLIER_CATALOG_DIR'));
    const candidate = resolve(baseDir, relativePath);
    if (!isInside(baseDir, candidate)) {
      imageNotFound();
    }
    // O caminho lexical pode estar dentro da base e ainda assim apontar para fora via symlink.
    let realFile: string;
    try {
      const [realBase, realTarget] = await Promise.all([
        realpath(baseDir),
        realpath(candidate),
      ]);
      if (!isInside(realBase, realTarget)) {
        imageNotFound();
      }
      realFile = realTarget;
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      imageNotFound();
    }
    const info = await stat(realFile);
    if (!info.isFile()) {
      imageNotFound();
    }

    return new StreamableFile(createReadStream(realFile), {
      type: contentType,
      length: info.size,
    });
  }
}
