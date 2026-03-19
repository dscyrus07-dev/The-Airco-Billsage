import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, CheckCircle, BarChart3, FileText, Shield } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
 import logo from '../../favicon_io/logo.png';

export default function Landing() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      {/* Header */}
      <header className="border-b bg-white/80 backdrop-blur-sm">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <img src={logo} alt="The Airco Billsage" className="h-10 w-10 rounded-lg object-contain bg-white" />
              <div>
                <h1 className="text-xl font-bold text-foreground">The Airco Billsage</h1>
                <p className="text-sm text-muted-foreground">Smart Business Management</p>
              </div>
            </div>
            <nav className="flex items-center space-x-4">
              <Button variant="ghost" asChild>
                <Link to="/auth/login">Login</Link>
              </Button>
              <Button asChild>
                <Link to="/auth/signup">Create account</Link>
              </Button>
            </nav>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="container mx-auto px-6 py-20">
        <div className="max-w-4xl mx-auto text-center space-y-8">
          <div className="space-y-4">
            <h1 className="text-5xl font-bold tracking-tight text-foreground">
              Smart Business Management for Purchases, Sales, and GST Compliance
            </h1>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              Streamline your financial operations with intelligent invoice processing, automated GST reconciliation, and real-time business analytics.
            </p>
          </div>
          
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button size="lg" className="text-base px-8 py-3" asChild>
              <Link to="/auth/login">
                Login
                <ArrowRight className="ml-2 h-5 w-5" />
              </Link>
            </Button>
            <Button size="lg" variant="outline" className="text-base px-8 py-3" asChild>
              <Link to="/auth/signup">Create account</Link>
            </Button>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="container mx-auto px-6 py-20">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold text-foreground mb-4">
              Everything you need for financial compliance
            </h2>
            <p className="text-lg text-muted-foreground">
              Streamline your financial operations with our comprehensive suite
            </p>
          </div>
          
          <div className="grid md:grid-cols-3 gap-8">
            <Card className="border-0 shadow-lg hover:shadow-xl transition-shadow">
              <CardContent className="p-8">
                <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center mb-6">
                  <Shield className="h-6 w-6 text-primary" />
                </div>
                <h3 className="text-xl font-semibold mb-4">
                  Automated extraction + validation
                </h3>
                <p className="text-muted-foreground leading-relaxed">
                  Smart OCR technology automatically extracts invoice data and validates it against GST rules, 
                  ensuring accuracy and compliance from day one.
                </p>
              </CardContent>
            </Card>

            <Card className="border-0 shadow-lg hover:shadow-xl transition-shadow">
              <CardContent className="p-8">
                <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center mb-6">
                  <BarChart3 className="h-6 w-6 text-primary" />
                </div>
                <h3 className="text-xl font-semibold mb-4">
                  Real-time analysis dashboard
                </h3>
                <p className="text-muted-foreground leading-relaxed">
                  Monitor your financial health with live KPIs, trend analysis, and predictive insights 
                  that help you make informed business decisions.
                </p>
              </CardContent>
            </Card>

            <Card className="border-0 shadow-lg hover:shadow-xl transition-shadow">
              <CardContent className="p-8">
                <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center mb-6">
                  <FileText className="h-6 w-6 text-primary" />
                </div>
                <h3 className="text-xl font-semibold mb-4">
                  Export-ready audit and GST reports
                </h3>
                <p className="text-muted-foreground leading-relaxed">
                  Generate compliant reports in multiple formats with one click. Perfect for audits, 
                  tax filings, and business reviews.
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Trust indicators */}
      <section className="bg-slate-900 text-white py-16">
        <div className="container mx-auto px-6">
          <div className="max-w-4xl mx-auto text-center space-y-8">
            <h3 className="text-2xl font-semibold">Trusted by leading enterprises</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
              {['ISO Compliant', 'GDPR Ready', 'SOC 2 Type II', 'AES-256 Encrypted'].map((item) => (
                <div key={item} className="flex items-center justify-center space-x-2">
                  <CheckCircle className="h-5 w-5 text-green-400" />
                  <span className="text-sm">{item}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t bg-white">
        <div className="container mx-auto px-6 py-8">
          <div className="flex flex-col md:flex-row justify-between items-center space-y-4 md:space-y-0">
            <div className="flex items-center space-x-3">
              <img src={logo} alt="The Airco Billsage" className="h-8 w-8 rounded-lg object-contain bg-white" />
              <span className="text-sm text-muted-foreground">© 2024 The Airco Billsage - Smart Business Management</span>
            </div>
            <div className="flex space-x-6 text-sm">
              <Button variant="link" className="text-muted-foreground hover:text-foreground p-0 h-auto">
                Privacy Policy
              </Button>
              <Button variant="link" className="text-muted-foreground hover:text-foreground p-0 h-auto">
                Terms of Service
              </Button>
              <Button variant="link" className="text-muted-foreground hover:text-foreground p-0 h-auto">
                Contact Support
              </Button>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
