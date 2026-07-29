import { motion } from 'framer-motion';
import { Button } from '@mantine/core';
import { QrCode, CheckCircle2, ArrowRight, Camera, Sparkles } from 'lucide-react';
import { scrollToSection } from '../../lib/scrollToSection';

export default function Hero() {
  return (
    <section style={{ position: 'relative', overflow: 'hidden', padding: '96px 0 72px' }}>
      <div className="blob" style={{ width: 480, height: 480, top: -220, left: -160, background: 'radial-gradient(circle, rgba(51,85,232,0.4), transparent 70%)' }} />
      <div className="blob" style={{ width: 420, height: 420, top: -120, right: -140, background: 'radial-gradient(circle, rgba(124,108,246,0.32), transparent 70%)' }} />

      <div className="container hero-grid" style={{ position: 'relative', zIndex: 1, display: 'grid', gridTemplateColumns: '1.1fr 0.9fr', gap: 56, alignItems: 'center' }}>
        <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}>
          <span className="pill" style={{ background: 'var(--on-navy-chip-bg)', color: 'var(--on-navy-accent)', border: '1px solid var(--on-navy-border)', marginBottom: 20 }}>
            <QrCode size={14} /> Checklists digitais com QR Code
          </span>
          <h1 style={{ fontSize: 'clamp(30px, 4.2vw, 48px)', fontWeight: 800, lineHeight: 1.12, margin: '0 0 20px', color: 'var(--on-navy-text)' }}>
            Evite tarefas <span className="gradient-text" style={{ backgroundImage: 'var(--gradient-brand-onnavy)' }}>esquecidas</span> na limpeza e zeladoria do seu condomínio
          </h1>
          <p style={{ fontSize: 17.5, color: 'var(--on-navy-muted)', lineHeight: 1.65, marginBottom: 30, maxWidth: 480 }}>
            O colaborador escaneia o QR Code, executa o checklist e registra fotos.
            Você acompanha tudo em relatórios, com status visível para os moradores.
          </p>
          <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
            <Button component="a" href="#planos" onClick={scrollToSection('planos')} size="lg" className="btn-glow" rightSection={<ArrowRight size={17} />}
              style={{ boxShadow: 'var(--shadow-brand)' }}>
              Assinar agora
            </Button>
            <Button component="a" href="#como-funciona" onClick={scrollToSection('como-funciona')} size="lg" variant="white">
              Ver como funciona
            </Button>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 26 }}>
            <div style={{ display: 'flex' }}>
              {['#3355e8', '#7c6cf6', '#12b76a'].map((c, i) => (
                <span key={c} style={{
                  width: 26, height: 26, borderRadius: '50%', background: c, border: '2.5px solid var(--navy-950)',
                  marginLeft: i === 0 ? 0 : -8, boxShadow: '0 2px 6px rgba(0,0,0,0.3)',
                }} />
              ))}
            </div>
            <p style={{ fontSize: 13, color: 'var(--on-navy-muted)', margin: 0 }}>
              Ideal para condomínios, administradoras e equipes de limpeza ou zeladoria.
            </p>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 30, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.8, delay: 0.15, ease: [0.16, 1, 0.3, 1] }}
          style={{ position: 'relative' }}
        >
          <div style={{
            background: '#fff', border: '1px solid var(--border)', borderRadius: 'var(--radius-xl)',
            padding: 30, boxShadow: 'var(--shadow-lg)', position: 'relative', zIndex: 1,
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
              <span className="font-display" style={{ fontWeight: 800, fontSize: 15.5, color: 'var(--text)', letterSpacing: '-0.01em' }}>Hall Social — Torre A</span>
              <span className="pill" style={{ background: 'var(--green-light)', color: 'var(--green)', fontSize: 11 }}>
                Ambiente ativo
              </span>
            </div>
            <div style={{
              width: 156, height: 156, margin: '0 auto 20px', borderRadius: 16, position: 'relative',
              background: '#fff', border: '1px solid var(--border)', display: 'flex', alignItems: 'center',
              justifyContent: 'center', boxShadow: 'var(--shadow-sm)',
            }}>
              <div style={{
                width: 128, height: 128, borderRadius: 10,
                backgroundImage: 'repeating-conic-gradient(#10142c 0% 25%, transparent 0% 50%)',
                backgroundSize: '14px 14px', opacity: 0.92,
              }} />
              <div style={{
                position: 'absolute', width: 40, height: 40, background: '#fff', borderRadius: 8,
                display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 0 0 4px #fff',
              }}>
                <QrCode size={20} color="var(--blue)" />
              </div>
            </div>
            <div className="font-display" style={{ display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'center', color: 'var(--green)', fontWeight: 800, fontSize: 15 }}>
              <CheckCircle2 size={18} /> Checklist concluído
            </div>
            <p style={{ textAlign: 'center', fontSize: 12.5, color: 'var(--text-muted)', marginTop: 6, fontWeight: 500 }}>
              Hall Social — 09:15
            </p>
          </div>

          <motion.div
            className="float"
            style={{
              position: 'absolute', top: -22, right: -18, background: '#fff', borderRadius: 16,
              padding: '12px 16px', boxShadow: 'var(--shadow-md)', border: '1px solid var(--border)',
              display: 'flex', alignItems: 'center', gap: 8, zIndex: 2,
            }}
          >
            <span className="icon-tile" style={{ width: 30, height: 30, borderRadius: 9, background: 'var(--blue-light)' }}>
              <Camera size={15} color="var(--blue)" />
            </span>
            <div>
              <p className="font-display" style={{ margin: 0, fontWeight: 800, fontSize: 13, color: 'var(--text)' }}>Foto anexada</p>
              <p style={{ margin: 0, fontSize: 10.5, color: 'var(--text-muted)', fontWeight: 500 }}>evidência registrada</p>
            </div>
          </motion.div>

          <motion.div
            className="float-slow"
            style={{
              position: 'absolute', bottom: 8, left: -34, background: 'var(--gradient-brand)', color: '#fff', borderRadius: 16,
              padding: '12px 16px', boxShadow: 'var(--shadow-brand)', display: 'flex', alignItems: 'center', gap: 8, zIndex: 2,
            }}
          >
            <Sparkles size={16} color="#ffd166" />
            <div>
              <p className="font-display" style={{ margin: 0, fontWeight: 800, fontSize: 13 }}>100% sem falhas</p>
              <p style={{ margin: 0, fontSize: 10.5, opacity: 0.8, fontWeight: 500 }}>últimos 30 dias</p>
            </div>
          </motion.div>
        </motion.div>
      </div>
      <style>{`
        @media (max-width: 900px) {
          .hero-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </section>
  );
}
