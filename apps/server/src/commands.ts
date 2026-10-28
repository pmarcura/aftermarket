import { z } from 'zod';
import { products, type ProductId } from '../../../packages/simulation/src/model';

// Comandos aceitos pela API; cada tipo de Command do motor precisa estar aqui (tests/server-commands.test.ts).
export const product = z.enum(Object.keys(products) as [ProductId, ...ProductId[]]);
const id = z.string().min(1).max(100),
  amount = z.number().int().positive();
const supplyPolicy = z
  .object({
    reserveOrders: z.boolean().optional(),
    enabled: z.boolean(),
    dailyBudget: amount.max(1e9),
    cashReserve: z.number().int().min(0).max(1e9),
    source: z.enum(['internal-first', 'internal-only', 'market']),
    purchaseMode: z.enum(['immediate', 'request']),
    maxDistanceKm: z.number().min(1).max(6000),
    minQuality: z.number().int().min(0).max(100),
    maxFreightPerUnit: z.number().int().min(0).max(1e9),
    carrierId: id,
    rules: z
      .array(
        z
          .object({
            originId: id.optional(),
            product,
            minimum: z.number().int().min(0).max(1000000),
            target: amount.max(1000000),
            maxBuy: amount.max(1000000),
            maxPrice: z.number().int().min(0).max(1e9),
            maxFreightPerUnit: z.number().int().min(0).max(1e9).optional(),
          })
          .strict(),
      )
      .max(10),
  })
  .strict();
export const commandSchema = z.discriminatedUnion('type', [
  z
    .object({
      type: z.literal('installBusiness'),
      establishmentId: id,
      recipeId: id.optional(),
      lines: amount.max(100),
    })
    .strict(),
  z
    .object({
      type: z.literal('takeRecoveryLoan'),
      state: z.string().length(2),
      amount: amount.max(1e9),
    })
    .strict(),
  z.object({ type: z.literal('payObligations'), amount: amount.max(1e9) }).strict(),
  z.object({ type: z.literal('repayLoan'), loanId: id, amount: amount.max(1e9) }).strict(),
  z.object({ type: z.literal('mothball'), establishmentId: id, enabled: z.boolean() }).strict(),
  z.object({ type: z.literal('sellVehicle'), vehicleId: id }).strict(),
  z
    .object({ type: z.literal('configureSupply'), establishmentId: id, policy: supplyPolicy })
    .strict(),
  z
    .object({
      type: z.literal('transferStock'),
      originId: id,
      destinationId: id,
      product,
      quantity: amount.max(1000000),
      carrierId: id,
      expectedFreight: amount.optional(),
    })
    .strict(),
  z
    .object({
      type: z.literal('createPurchaseRequest'),
      reserveFunds: z.boolean().optional(),
      destinationId: id,
      product,
      quantity: amount.max(1000000),
      unitPrice: amount.max(1e9),
      maxFreight: amount.max(1e9),
      deliveryDays: amount.max(14),
    })
    .strict(),
  z
    .object({
      type: z.literal('proposeOrder'),
      orderId: id,
      establishmentId: id.optional(),
      unitPrice: amount.max(1e9),
      quantity: amount.max(1000000),
      maxFreight: amount.max(1e9),
      deliveryDays: amount.max(14),
      carrierId: id,
    })
    .strict(),
  z.object({ type: z.literal('acceptProposal'), orderId: id, proposalId: id }).strict(),
  z
    .object({
      type: z.literal('bidInfrastructure'),
      contractId: id,
      establishmentId: id,
      carrierId: id,
      unitPrice: amount.max(1e9),
    })
    .strict(),
  z.object({ type: z.literal('trainWorkforce'), establishmentId: id }).strict(),
  z
    .object({ type: z.literal('buyProperty'), propertyId: id, name: z.string().min(3).max(70) })
    .strict(),
  z
    .object({
      type: z.literal('trade'),
      offerId: id,
      quantity: amount.max(1000000),
      destinationId: id,
      carrierId: id,
      expectedTotal: amount.optional(),
    })
    .strict(),
  z
    .object({
      type: z.literal('produce'),
      establishmentId: id,
      recipeId: id,
      cycles: amount.max(100),
    })
    .strict(),
  z.object({ type: z.literal('extract'), establishmentId: id, quantity: amount.max(100) }).strict(),
  z
    .object({
      type: z.literal('setPrice'),
      establishmentId: id,
      product,
      price: amount.max(100000000),
    })
    .strict(),
  z
    .object({
      type: z.literal('publishOffer'),
      establishmentId: id,
      product,
      price: amount.max(100000000),
    })
    .strict(),
  z.object({ type: z.literal('toggleOperation'), establishmentId: id }).strict(),
  z
    .object({ type: z.literal('setAutomation'), establishmentId: id, enabled: z.boolean() })
    .strict(),
  z
    .object({
      type: z.literal('buyVehicle'),
      model: z.enum(['truckHeavy', 'truckLight']).optional(),
      sellerEstablishmentId: id.optional(),
    })
    .strict(),
  z.object({ type: z.literal('scrapVehicle'), vehicleId: id }).strict(),
  z
    .object({
      type: z.literal('setWorkforce'),
      establishmentId: id,
      employees: z.number().int().min(0).max(1000),
    })
    .strict(),
  z
    .object({
      type: z.literal('configureProduction'),
      establishmentId: id,
      recipeId: id,
      cycles: amount.max(100),
      dailyBudget: amount.max(1000000000),
      enabled: z.boolean(),
    })
    .strict(),
  z
    .object({
      type: z.literal('requestOrder'),
      reserveFunds: z.boolean().optional(),
      offerId: id,
      destinationId: id,
      quantity: amount.max(1000000),
      carrierId: id,
      maxFreight: amount.max(1000000000),
      deliveryDays: amount.max(14),
      expectedUnitPrice: amount.optional(),
    })
    .strict(),
  z.object({ type: z.literal('acceptOrder'), orderId: id }).strict(),
  z.object({ type: z.literal('rejectOrder'), orderId: id }).strict(),
  z
    .object({
      type: z.literal('fulfillInfrastructure'),
      contractId: id,
      establishmentId: id,
      carrierId: id,
      expectedFreight: amount,
    })
    .strict(),
]);
