CREATE TYPE "PromotionDiscountType" AS ENUM ('PRECO_FIXO', 'PERCENTUAL');

ALTER TABLE "itens_promocao_produto"
ADD COLUMN "tipo_desconto" "PromotionDiscountType" NOT NULL DEFAULT 'PRECO_FIXO',
ADD COLUMN "percentual_desconto" DECIMAL(5,2);

ALTER TABLE "itens_promocao_produto"
ALTER COLUMN "preco_promocional" DROP NOT NULL;

