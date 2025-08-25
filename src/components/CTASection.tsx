import { Button } from "@/components/ui/enhanced-button";
import { ArrowRight, CheckCircle } from "lucide-react";

const benefits = [
  "Free 14-day trial",
  "No credit card required",
  "Cancel anytime",
  "24/7 support included",
];

const CTASection = () => {
  return (
    <section className="py-20 px-6 bg-gradient-hero">
      <div className="max-w-4xl mx-auto text-center">
        <h2 className="text-4xl md:text-5xl font-bold mb-6">
          Ready to Get Started?
        </h2>
        <p className="text-xl text-muted-foreground mb-8 max-w-2xl mx-auto">
          Join thousands of developers who are already building amazing applications with our platform. 
          Start your journey today.
        </p>
        
        <div className="flex flex-wrap justify-center gap-6 mb-8">
          {benefits.map((benefit, index) => (
            <div key={index} className="flex items-center gap-2 text-foreground">
              <CheckCircle className="h-5 w-5 text-primary" />
              <span className="font-medium">{benefit}</span>
            </div>
          ))}
        </div>
        
        <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
          <Button variant="hero" size="xl" className="group">
            Start Free Trial
            <ArrowRight className="ml-2 h-5 w-5 group-hover:translate-x-1 transition-transform" />
          </Button>
          
          <Button variant="outline" size="xl">
            Contact Sales
          </Button>
        </div>
        
        <p className="text-sm text-muted-foreground mt-6">
          No spam, unsubscribe at any time. Read our{" "}
          <a href="#" className="text-primary hover:underline">privacy policy</a>.
        </p>
      </div>
    </section>
  );
};

export default CTASection;