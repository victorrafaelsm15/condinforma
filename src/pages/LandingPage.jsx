import { useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import LandingHeader from '../components/landing/LandingHeader';
import Hero from '../components/landing/Hero';
import ProblemSection from '../components/landing/ProblemSection';
import HowItWorks from '../components/landing/HowItWorks';
import FeaturesSection from '../components/landing/FeaturesSection';
import PricingSection from '../components/landing/PricingSection';
import FAQSection from '../components/landing/FAQSection';
import LandingFooter from '../components/landing/LandingFooter';

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
