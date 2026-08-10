import { useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import Seo, { SITE_URL } from '../components/common/Seo';
import LandingHeader from '../components/landing/LandingHeader';
import Hero from '../components/landing/Hero';
import ProblemSection from '../components/landing/ProblemSection';
import HowItWorks from '../components/landing/HowItWorks';
import FeaturesSection from '../components/landing/FeaturesSection';
import PricingSection from '../components/landing/PricingSection';
import FAQSection from '../components/landing/FAQSection';
import LandingFooter from '../components/landing/LandingFooter';

const DESCRIPTION = 'Checklists digitais com QR Code para condomínios: organize limpeza, zeladoria e manutenção por ambiente, com fotos, histórico e transparência total para os moradores.';

const ORGANIZATION_JSON_LD = {
  '@context': 'https://schema.org',
  '@type': 'Organization',
  name: 'Cond-Informa',
  url: SITE_URL,
  logo: `${SITE_URL}/logo-icon.png`,
  description: DESCRIPTION,
};

export default function LandingPage() {
  const [searchParams] = useSearchParams();

  useEffect(() => {
    const target = searchParams.get('scrollTo');
    if (!target) return;
    // pequeno delay pra garantir que a seção já montou/tem layout antes do scroll
    const t = setTimeout(() => {
      document.getElementById(target)?.scrollIntoView({ behavior: 'smooth' });
    }, 150);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="landing-scope" style={{ background: 'var(--navy-950)' }}>
      <Seo
        title="Cond-Informa — Checklists digitais com QR Code para condomínios"
        description={DESCRIPTION}
        path="/"
        jsonLd={ORGANIZATION_JSON_LD}
      />
      <LandingHeader />
      <Hero />
      <ProblemSection />
      <HowItWorks />
      <FeaturesSection />
      <PricingSection />
      <FAQSection />
      <LandingFooter />
    </div>
  );
}
