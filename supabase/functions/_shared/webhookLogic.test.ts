import { describe, it, expect } from 'vitest';
import { resolveStatusFromEvent, parseExternalReference, shouldLogPlanChange, ACTIVE_EVENTS, INACTIVE_EVENTS } from './webhookLogic.ts';

describe('resolveStatusFromEvent', () => {
  it.each([...ACTIVE_EVENTS])('marca %s como "ativo"', (event) => {
    expect(resolveStatusFromEvent(event)).toBe('ativo');
  });

  it.each([...INACTIVE_EVENTS])('marca %s como "inativo"', (event) => {
    expect(resolveStatusFromEvent(event)).toBe('inativo');
  });

  it('devolve null pra evento desconhecido (não mexe no status da conta)', () => {
    expect(resolveStatusFromEvent('PAYMENT_CREATED')).toBeNull();
    expect(resolveStatusFromEvent('')).toBeNull();
  });
});

describe('parseExternalReference', () => {
  it('separa account_id e planName (minúsculo)', () => {
    expect(parseExternalReference('35b418ac-4d89-4a38-9c3d-803a1ff234da:Pro')).toEqual({
      accountId: '35b418ac-4d89-4a38-9c3d-803a1ff234da',
      planKey: 'pro',
    });
  });

  it('devolve nulls quando não tem separador ":"', () => {
    expect(parseExternalReference('sem-separador')).toEqual({ accountId: null, planKey: null });
  });

  it('devolve nulls quando undefined/null', () => {
    expect(parseExternalReference(undefined)).toEqual({ accountId: null, planKey: null });
    expect(parseExternalReference(null)).toEqual({ accountId: null, planKey: null });
  });

  it('usa só o primeiro ":" como separador (account_id nunca tem ":")', () => {
    expect(parseExternalReference('conta-1:Business:extra')).toEqual({
      accountId: 'conta-1',
      planKey: 'business:extra',
    });
  });
});

describe('shouldLogPlanChange (idempotência do webhook)', () => {
  it('loga quando o plano realmente mudou', () => {
    expect(shouldLogPlanChange('start', 'pro')).toBe(true);
    expect(shouldLogPlanChange(null, 'start')).toBe(true);
  });

  it('não loga quando o evento é uma reentrega do mesmo plano já aplicado', () => {
    // Este é o caso central de idempotência: o Asaas reenvia o mesmo evento
    // PAYMENT_CONFIRMED (ex.: falha de rede na entrega original e retry) —
    // aplicar de novo o MESMO plano não pode gerar uma segunda entrada no
    // audit_log nem qualquer efeito colateral duplicado.
    expect(shouldLogPlanChange('pro', 'pro')).toBe(false);
  });
});
