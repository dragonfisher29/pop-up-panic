import { handle, type Env } from './api';

export const onRequest = (ctx: { request: Request; env: Env }) => handle(ctx.request, ctx.env, Date.now());
