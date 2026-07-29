import LandingHeader from '../components/landing/LandingHeader';
import Hero from '../components/landing/Hero';
import ProblemSection from '../components/landing/ProblemSection';
import HowItWorks from '../components/landing/HowItWorks';
import FeaturesSection from '../components/landing/FeaturesSection';
import PricingSection from '../components/landing/PricingSection';
import FAQSection from '../components/landing/FAQSection';
import LandingFooter from '../components/landing/LandingFooter';

export default function LandingPage() {
  return (
    <div style={{ background: 'var(--navy-950)' }}>
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
