import { z } from "zod";

import { createTRPCRouter, publicProcedure } from "../trpc";

export const personRouter = createTRPCRouter({
  getAll: publicProcedure.query(async ({ ctx }) => {
    return await ctx.prisma.person.findMany();
  }),
  create: publicProcedure
    .input(
      z.object({ firstName: z.string(), lastName: z.string(), age: z.number() })
    )
    .mutation(async ({ input, ctx }) => {
      return ctx.prisma.person.create({ data: input });
    }),
  update: publicProcedure
    .input(
      z.object({
        id: z.string().cuid(),
        data: z.object({
          field: z.enum(["firstName", "lastName", "age"]),
          value: z.string().or(z.number()),
        }),
      })
    )
    .mutation(async ({ ctx, input }) => {
      return await ctx.prisma.person.update({
        where: { id: input.id },
        data: { [input.data.field]: input.data.value },
      });
    }),
});
